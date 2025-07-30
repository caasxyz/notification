import { Env, NotificationChannel } from '../../types';
import { ValidationError } from '../../utils/errors';
import { Logger } from '../../utils/logger';
import { getDb, notificationTemplatesV2, templateContents } from '../../db';
import { eq, and, sql } from 'drizzle-orm';

const logger = Logger.getInstance();

// Helper function to safely stringify JSON
function safeJsonStringify(value: any): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    logger.error('Failed to stringify JSON', { value, error });
    return '[]'; // 返回空数组而不是 null
  }
}

// Helper function to get current timestamp in ISO format
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// 获取所有模板
export async function getTemplatesHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const templateKey = url.searchParams.get('key');
    const includeInactive = url.searchParams.get('include_inactive') === 'true';
    
    const db = getDb(env);
    
    if (templateKey) {
      // 获取单个模板详情
      const templates = await db
        .select()
        .from(notificationTemplatesV2)
        .where(
          includeInactive 
            ? eq(notificationTemplatesV2.template_key, templateKey)
            : and(
                eq(notificationTemplatesV2.template_key, templateKey),
                eq(notificationTemplatesV2.is_active, true)
              )
        )
        .limit(1);
      
      if (templates.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Template not found',
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      
      const template = templates[0];
      
      // 获取该模板的所有渠道内容
      const contents = await db
        .select()
        .from(templateContents)
        .where(eq(templateContents.template_key, templateKey));
      
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            template,
            contents,
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } else {
      // 获取所有模板列表
      const templates = await db
        .select()
        .from(notificationTemplatesV2)
        .where(includeInactive ? sql`1=1` : eq(notificationTemplatesV2.is_active, true));
      
      // 为每个模板获取支持的渠道
      const templatesWithChannels = await Promise.all(
        templates.map(async (template) => {
          const contents = await db
            .select({ channel_type: templateContents.channel_type })
            .from(templateContents)
            .where(eq(templateContents.template_key, template.template_key));
          
          return {
            ...template,
            supported_channels: contents.map((c) => c.channel_type),
          };
        })
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          data: templatesWithChannels,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    logger.error('Failed to get templates', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to get templates',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// 创建或更新模板
export async function upsertTemplateHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  let templateKey: string | null = null;
  
  try {
    const url = new URL(request.url);
    templateKey = url.searchParams.get('key');
    
    if (!templateKey) {
      throw new ValidationError('Template key is required');
    }
    
    // 验证模板键的格式
    if (!/^[a-zA-Z0-9_-]+$/.test(templateKey)) {
      throw new ValidationError('Template key must contain only alphanumeric characters, underscores, and hyphens');
    }
    
    // 验证模板键的长度
    if (templateKey.length > 100) {
      throw new ValidationError('Template key must not exceed 100 characters');
    }
    
    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body');
    }
    
    const typedBody = body as {
      name?: string;
      description?: string;
      variables?: string[];
      contents?: Record<string, {
        subject_template?: string;
        content_template: string;
        content_type?: string;
      }>;
    };
    
    const { name, description, variables, contents } = typedBody;
    
    const db = getDb(env);
    
    // 验证 variables 数组
    if (variables && !Array.isArray(variables)) {
      throw new ValidationError('Variables must be an array');
    }
    
    // 验证 contents 对象
    if (contents && (typeof contents !== 'object' || Array.isArray(contents))) {
      throw new ValidationError('Contents must be an object');
    }
    
    // 日志记录请求信息
    logger.info('Creating/updating template', {
      templateKey,
      hasVariables: !!variables,
      variablesCount: variables?.length || 0,
      channelCount: contents ? Object.keys(contents).length : 0,
    });
    
    // 检查模板是否存在
    const existingTemplates = await db
      .select()
      .from(notificationTemplatesV2)
      .where(eq(notificationTemplatesV2.template_key, templateKey))
      .limit(1);
    
    try {
      if (existingTemplates.length > 0) {
        // 更新现有模板
        const existingTemplate = existingTemplates[0]!;
        await db
          .update(notificationTemplatesV2)
          .set({
            template_name: name || existingTemplate.template_name,
            description: description !== undefined ? description : existingTemplate.description,
            variables: variables ? safeJsonStringify(variables) : existingTemplate.variables,
            is_active: true, // 确保模板被激活（可能之前被软删除）
            updated_at: getCurrentTimestamp(),
          })
          .where(eq(notificationTemplatesV2.template_key, templateKey));
      } else {
        // 创建新模板
        const newTemplate = {
          template_key: templateKey,
          template_name: name || templateKey,
          description: description || null,
          variables: variables ? safeJsonStringify(variables) : '[]',
          is_active: true,
          created_at: getCurrentTimestamp(),
          updated_at: getCurrentTimestamp(),
        };
        
        logger.info('Creating new template with values', {
          templateKey,
          is_active: newTemplate.is_active,
          is_active_type: typeof newTemplate.is_active,
        });
        
        await db
          .insert(notificationTemplatesV2)
          .values(newTemplate);
          
        // 验证插入后的值
        const inserted = await db
          .select()
          .from(notificationTemplatesV2)
          .where(eq(notificationTemplatesV2.template_key, templateKey))
          .limit(1);
          
        if (inserted.length > 0) {
          logger.info('Template created, verifying is_active', {
            templateKey,
            is_active: inserted[0]!.is_active,
            is_active_raw: inserted[0]!['is_active'],
          });
        }
      }
    } catch (dbError) {
      logger.error('Database operation failed', {
        templateKey,
        operation: existingTemplates.length > 0 ? 'update' : 'insert',
        error: dbError instanceof Error ? dbError.message : 'Unknown error'
      });
      throw dbError;
    }
    
    // 更新模板内容
    logger.info('Processing template contents', {
      templateKey,
      hasContents: !!contents,
      contentsType: typeof contents,
      channelCount: contents ? Object.keys(contents).length : 0,
      channels: contents ? Object.keys(contents) : [],
    });
    
    if (contents && typeof contents === 'object') {
      for (const [channel, content] of Object.entries(contents)) {
        logger.info(`Processing channel content: ${channel}`, {
          templateKey,
          channel,
          hasContent: !!content,
          contentKeys: content ? Object.keys(content) : [],
        });
        
        if (!isValidChannel(channel)) {
          logger.warn(`Skipping invalid channel: ${channel}`);
          continue;
        }
        
        const { subject_template, content_template, content_type } = content;
        
        // 验证 content_template 是必需的
        if (!content_template || typeof content_template !== 'string') {
          logger.warn(`Skipping channel ${channel}: content_template is required and must be a string`);
          continue;
        }
        
        // 删除旧内容
        await db
          .delete(templateContents)
          .where(
            and(
              eq(templateContents.template_key, templateKey),
              eq(templateContents.channel_type, channel)
            )
          );
        
        // 插入新内容
        if (content_template) {
          try {
            logger.info('Inserting template content', {
              templateKey,
              channel,
              hasSubject: !!subject_template,
              contentType: content_type || 'text',
            });
            
            await db
              .insert(templateContents)
              .values({
                template_key: templateKey,
                channel_type: channel,
                subject_template: subject_template || null,
                content_template,
                content_type: content_type || 'text',
                created_at: getCurrentTimestamp(),
                updated_at: getCurrentTimestamp(),
              });
              
            logger.info('Template content inserted successfully', {
              templateKey,
              channel,
            });
          } catch (error) {
            logger.error('Failed to insert template content', {
              templateKey,
              channel,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
          }
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Template saved successfully',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    logger.error('Failed to upsert template', { 
      templateKey, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (error instanceof ValidationError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to save template',
        details: errorMessage, // 始终提供错误信息以便调试
        hint: errorMessage.includes('UNIQUE constraint') ? 'Template may already exist' : 
              errorMessage.includes('NOT NULL constraint') ? 'Required field is missing' :
              errorMessage.includes('FOREIGN KEY constraint') ? 'Referenced resource not found' :
              errorMessage.includes('no such table') ? 'Database tables may not be initialized' :
              undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// 删除模板
export async function deleteTemplateHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const templateKey = url.searchParams.get('key');
    
    if (!templateKey) {
      throw new ValidationError('Template key is required');
    }
    
    const db = getDb(env);
    
    // 软删除：将模板标记为非活动
    await db
      .update(notificationTemplatesV2)
      .set({
        is_active: false,
        updated_at: getCurrentTimestamp(),
      })
      .where(eq(notificationTemplatesV2.template_key, templateKey));
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Template deleted successfully',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    logger.error('Failed to delete template', error);
    
    if (error instanceof ValidationError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to delete template',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// Helper function to validate channel
function isValidChannel(channel: string): channel is NotificationChannel {
  return ['webhook', 'telegram', 'lark', 'slack', 'email', 'sms'].includes(channel);
}
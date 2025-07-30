import { Env, NotificationChannel } from '../types';
import { getDb, notificationTemplatesV2, templateContents } from '../db';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { ValidationUtils } from '../utils/validation';
import { SecurityUtils } from '../utils/security';

export interface RenderedTemplate {
  subject?: string;
  content: string;
  content_type: string;
}

export interface TemplateContent {
  channel_type: NotificationChannel;
  subject_template?: string | null;
  content_template: string;
  content_type?: string;
}

export class TemplateEngineV2 {
  private static logger = Logger.getInstance();
  
  static async renderTemplate(
    templateKey: string,
    channel: NotificationChannel,
    variables: Record<string, unknown>,
    env: Env,
  ): Promise<RenderedTemplate> {
    // 验证输入
    ValidationUtils.validateTemplateKey(templateKey);
    ValidationUtils.validateChannel(channel);
    
    // 获取模板内容
    const templateContent = await this.getTemplateContent(templateKey, channel, env);
    
    if (!templateContent) {
      throw new Error(`Template content not found for ${templateKey}/${channel}`);
    }
    
    // 渲染模板
    const rendered = this.render(templateContent, variables);
    
    return rendered;
  }
  
  static async renderTemplateForChannels(
    templateKey: string,
    channels: NotificationChannel[],
    variables: Record<string, unknown>,
    env: Env,
  ): Promise<Map<NotificationChannel, RenderedTemplate>> {
    const results = new Map<NotificationChannel, RenderedTemplate>();
    
    for (const channel of channels) {
      try {
        const rendered = await this.renderTemplate(templateKey, channel, variables, env);
        results.set(channel, rendered);
      } catch (error) {
        this.logger.warn('Failed to render template for channel', {
          templateKey,
          channel,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    return results;
  }
  
  static async renderTemplateForChannelsWithCache(
    templateKey: string,
    channels: NotificationChannel[],
    variables: Record<string, unknown> | undefined,
    env: Env,
  ): Promise<Map<NotificationChannel, RenderedTemplate>> {
    const results = new Map<NotificationChannel, RenderedTemplate>();
    
    this.logger.info('Rendering template for channels', {
      templateKey,
      channels,
      hasVariables: !!variables,
    });
    
    // 批量获取所有模板内容
    const templateContentsMap = await this.getTemplateContentsForChannels(templateKey, channels, env);
    
    this.logger.info('Template contents found', {
      templateKey,
      foundChannels: Array.from(templateContentsMap.keys()),
      requestedChannels: channels,
    });
    
    for (const [channel, content] of templateContentsMap) {
      try {
        const rendered = this.render(content, variables || {});
        results.set(channel, rendered);
        this.logger.info('Template rendered successfully', {
          templateKey,
          channel,
          hasSubject: !!rendered.subject,
          contentLength: rendered.content.length,
        });
      } catch (error) {
        this.logger.warn('Failed to render template for channel', {
          templateKey,
          channel,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    return results;
  }
  
  private static async getTemplateContent(
    templateKey: string,
    channel: NotificationChannel,
    env: Env,
  ): Promise<TemplateContent | null> {
    const db = getDb(env);
    
    // 查询模板和内容
    const results = await db
      .select({
        channel_type: templateContents.channel_type,
        subject_template: templateContents.subject_template,
        content_template: templateContents.content_template,
        content_type: templateContents.content_type,
      })
      .from(templateContents)
      .innerJoin(
        notificationTemplatesV2,
        eq(templateContents.template_key, notificationTemplatesV2.template_key)
      )
      .where(
        and(
          eq(notificationTemplatesV2.template_key, templateKey),
          eq(notificationTemplatesV2.is_active, true),
          eq(templateContents.channel_type, channel)
        )
      )
      .limit(1);
    
    if (results.length === 0) {
      return null;
    }
    
    return results[0] as TemplateContent;
  }
  
  private static async getTemplateContentsForChannels(
    templateKey: string,
    channels: NotificationChannel[],
    env: Env,
  ): Promise<Map<NotificationChannel, TemplateContent>> {
    const db = getDb(env);
    
    // 先查询模板是否存在和激活
    const template = await db
      .select()
      .from(notificationTemplatesV2)
      .where(eq(notificationTemplatesV2.template_key, templateKey))
      .limit(1);
    
    this.logger.info('Template lookup result', {
      templateKey,
      found: template.length > 0,
      isActive: template[0]?.is_active,
    });
    
    // 批量查询所有渠道的模板内容
    const results = await db
      .select({
        channel_type: templateContents.channel_type,
        subject_template: templateContents.subject_template,
        content_template: templateContents.content_template,
        content_type: templateContents.content_type,
      })
      .from(templateContents)
      .innerJoin(
        notificationTemplatesV2,
        eq(templateContents.template_key, notificationTemplatesV2.template_key)
      )
      .where(
        and(
          eq(notificationTemplatesV2.template_key, templateKey),
          eq(notificationTemplatesV2.is_active, true)
        )
      );
    
    const contentMap = new Map<NotificationChannel, TemplateContent>();
    
    // 如果没有通过 JOIN 查询到结果，尝试直接查询 template_contents
    if (results.length === 0) {
      this.logger.warn('No contents found with JOIN, trying direct query', {
        templateKey,
      });
      
      const directResults = await db
        .select()
        .from(templateContents)
        .where(eq(templateContents.template_key, templateKey));
      
      this.logger.info('Direct query results', {
        templateKey,
        count: directResults.length,
        channels: directResults.map(r => r.channel_type),
      });
    }
    
    for (const result of results) {
      if (channels.includes(result.channel_type as NotificationChannel)) {
        contentMap.set(result.channel_type as NotificationChannel, result as TemplateContent);
      }
    }
    
    return contentMap;
  }
  
  private static render(
    template: TemplateContent,
    variables: Record<string, unknown>,
  ): RenderedTemplate {
    let subject: string | undefined;
    let content: string = template.content_template;
    
    // 渲染主题（如果有）
    if (template.subject_template) {
      subject = this.replaceVariables(template.subject_template, variables);
    }
    
    // 渲染内容
    content = this.replaceVariables(content, variables);
    
    const result: RenderedTemplate = {
      content,
      content_type: template.content_type || 'text',
    };
    
    if (subject !== undefined) {
      result.subject = subject;
    }
    
    return result;
  }
  
  private static replaceVariables(
    template: string,
    variables: Record<string, unknown>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      
      if (value === undefined) {
        return match; // 保留原始占位符
      }
      
      // 对值进行清理和限制
      return SecurityUtils.sanitizeTemplateValue(value);
    });
  }
  
  static async validateTemplate(
    templateKey: string,
    channel: NotificationChannel,
    env: Env,
  ): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      const content = await this.getTemplateContent(templateKey, channel, env);
      
      if (!content) {
        return {
          valid: false,
          errors: [`Template not found for ${templateKey}/${channel}`],
        };
      }
      
      const errors: string[] = [];
      
      // 验证模板语法
      const variables = this.extractVariables(content.content_template);
      if (content.subject_template) {
        const subjectVars = this.extractVariables(content.subject_template);
        variables.push(...subjectVars);
      }
      
      // 检查变量名是否合法
      for (const variable of variables) {
        if (!ValidationUtils.isValidVariableName(variable)) {
          errors.push(`Invalid variable name: ${variable}`);
        }
      }
      
      const result: { valid: boolean; errors?: string[] } = {
        valid: errors.length === 0,
      };
      
      if (errors.length > 0) {
        result.errors = errors;
      }
      
      return result;
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }
  
  private static extractVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g) || [];
    return matches.map(match => match.replace(/\{\{|\}\}/g, ''));
  }
}
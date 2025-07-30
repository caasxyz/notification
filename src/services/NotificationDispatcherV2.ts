import { eq, and, inArray } from 'drizzle-orm';
import { getDb, userConfigs, notificationLogs } from '../db';
import {
  Env,
  SendNotificationRequest,
  NotificationResult,
  PreparedNotification,
  NotificationChannel,
  NotificationSystemError,
} from '../types';
import { WebhookAdapter, TelegramAdapter, LarkAdapter, SlackAdapter } from '../adapters';
import { TemplateEngineV2 } from './TemplateEngineV2';
import { RetryScheduler } from './RetryScheduler';
import { IdempotencyManager } from './IdempotencyManager';
import { Logger } from '../utils/logger';
import { CryptoUtils } from '../utils/crypto';

interface ParsedUserConfig {
  id: number;
  user_id: string;
  channel_type: string;
  config_data: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class NotificationDispatcherV2 {
  private static logger = Logger.getInstance();

  static async sendNotification(
    request: SendNotificationRequest,
    env: Env,
  ): Promise<NotificationResult[]> {
    const { user_id, channels, template_key, variables, custom_content, idempotency_key } = request;

    // 检查幂等性
    const duplicateResult = await IdempotencyManager.checkDuplicate(
      idempotency_key,
      user_id,
      env,
    );
    
    if (duplicateResult.isDuplicate && duplicateResult.results) {
      this.logger.info('Duplicate request detected', {
        userId: user_id,
        idempotencyKey: idempotency_key,
      });
      return duplicateResult.results;
    }

    // 获取用户配置
    const userConfigRecords = await this.getUserConfigs(user_id, channels, env);

    // 准备通知
    const notifications = await this.prepareNotifications(
      user_id,
      channels,
      template_key,
      variables,
      custom_content,
      userConfigRecords,
      env,
    );

    // 批量发送
    const results = await this.batchSendNotifications(notifications, env);

    // 记录幂等键
    if (idempotency_key) {
      const messageIds = results.map((r) => r.messageId);
      await IdempotencyManager.recordIdempotencyKey(
        idempotency_key,
        user_id,
        messageIds,
        env,
      );
    }

    return results;
  }

  private static async getUserConfigs(
    userId: string,
    channels: NotificationChannel[],
    env: Env,
  ): Promise<ParsedUserConfig[]> {
    try {
      const db = getDb(env);
      const results = await db
        .select()
        .from(userConfigs)
        .where(
          and(
            eq(userConfigs.user_id, userId),
            inArray(userConfigs.channel_type, channels),
            eq(userConfigs.is_active, true)
          )
        );

      // Parse config_data for each config
      return results.map(config => ({
        ...config,
        config_data: JSON.parse(config.config_data),
      }));
    } catch (error) {
      this.logger.error('Failed to fetch user configs', error, {
        userId,
        channels,
      });
      throw new NotificationSystemError(
        'Failed to fetch user configurations',
        'DB_ERROR',
        true,
      );
    }
  }

  private static async prepareNotifications(
    userId: string,
    channels: NotificationChannel[],
    templateKey: string | undefined,
    variables: Record<string, unknown> | undefined,
    customContent: { subject?: string; content: string } | undefined,
    userConfigRecords: ParsedUserConfig[],
    env: Env,
  ): Promise<PreparedNotification[]> {
    const notifications: PreparedNotification[] = [];

    // 如果使用模板，一次性获取所有渠道的渲染结果
    let templateResults: Map<NotificationChannel, any> | null = null;
    if (templateKey && !customContent) {
      // 过滤出有效配置的渠道
      const activeChannels = channels.filter(channel => 
        userConfigRecords.some(c => c.channel_type === channel && c.is_active)
      );
      
      templateResults = await TemplateEngineV2.renderTemplateForChannelsWithCache(
        templateKey,
        activeChannels,
        variables,
        env,
      );
    }

    // 为每个渠道创建通知
    for (const channel of channels) {
      const userConfig = userConfigRecords.find((c) => c.channel_type === channel);
      
      if (!userConfig || !userConfig.is_active) {
        this.logger.warn('User has no active config for channel', {
          userId,
          channel,
        });
        continue;
      }

      let subject: string | undefined;
      let content: string | undefined;

      if (customContent) {
        // 使用自定义内容
        subject = customContent.subject;
        content = customContent.content;
      } else if (templateKey && templateResults) {
        // 使用模板渲染结果
        const rendered = templateResults.get(channel);
        if (!rendered) {
          this.logger.warn('Template not available for channel', {
            templateKey,
            channel,
          });
          continue;
        }
        subject = rendered.subject;
        content = rendered.content;
      }

      if (!content) {
        this.logger.warn('No content generated', {
          userId,
          channel,
        });
        continue;
      }

      const notification: PreparedNotification = {
        user_id: userId,
        channel_type: channel,
        config: userConfig.config_data,
        content,
      };
      
      if (subject !== undefined) {
        notification.subject = subject;
      }
      if (templateKey !== undefined) {
        notification.template_key = templateKey;
      }

      notifications.push(notification);
    }

    return notifications;
  }

  private static async batchSendNotifications(
    notifications: PreparedNotification[],
    env: Env,
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    const promises: Promise<NotificationResult>[] = [];

    for (const notification of notifications) {
      promises.push(this.sendSingleNotification(notification, env));
    }

    const promiseResults = await Promise.allSettled(promises);

    for (let i = 0; i < promiseResults.length; i++) {
      const result = promiseResults[i]!;
      const notification = notifications[i]!;

      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const messageId = CryptoUtils.generateMessageId();
        const error = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
        
        this.logger.error('Failed to send notification', error, {
          userId: notification.user_id,
          channel: notification.channel_type,
        });

        results.push({
          messageId,
          userId: notification.user_id,
          channelType: notification.channel_type,
          status: 'failed',
          error: error.message,
        });

        // 记录失败日志
        await this.logNotification(
          messageId,
          notification.user_id,
          notification.channel_type,
          notification.template_key,
          notification.subject,
          notification.content,
          'failed',
          0,
          error.message,
          env,
        );
      }
    }

    return results;
  }

  private static async sendSingleNotification(
    notification: PreparedNotification,
    env: Env,
  ): Promise<NotificationResult> {
    const messageId = CryptoUtils.generateMessageId();
    const adapter = this.getAdapter(notification.channel_type);

    try {
      const result = await adapter.send(
        notification.config,
        notification.content,
        notification.subject,
      );

      await this.logNotification(
        messageId,
        notification.user_id,
        notification.channel_type,
        notification.template_key,
        notification.subject,
        notification.content,
        'sent',
        0,
        undefined,
        env,
      );

      return {
        messageId,
        userId: notification.user_id,
        channelType: notification.channel_type,
        status: 'sent',
        details: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRetryable = error instanceof NotificationSystemError ? error.retryable : true;

      if (isRetryable) {
        try {
          // 先记录到数据库以获取 logId
          const db = getDb(env);
          const logResults = await db
            .insert(notificationLogs)
            .values({
              message_id: messageId,
              user_id: notification.user_id,
              channel_type: notification.channel_type,
              template_key: notification.template_key || null,
              subject: notification.subject || null,
              content: notification.content,
              status: 'retry',
              retry_count: 0,
              error: errorMessage,
            })
            .returning({ id: notificationLogs.id });

          const logResult = logResults[0];
          if (logResult?.id) {
            await RetryScheduler.scheduleRetry(
              logResult.id,
              0,
              errorMessage,
              env,
            );
          }

          return {
            messageId,
            userId: notification.user_id,
            channelType: notification.channel_type,
            status: 'retry',
            error: errorMessage,
          };
        } catch (retryError) {
          this.logger.error('Failed to schedule retry', retryError, {
            messageId,
          });
        }
      }

      await this.logNotification(
        messageId,
        notification.user_id,
        notification.channel_type,
        notification.template_key,
        notification.subject,
        notification.content,
        'failed',
        0,
        errorMessage,
        env,
      );

      return {
        messageId,
        userId: notification.user_id,
        channelType: notification.channel_type,
        status: 'failed',
        error: errorMessage,
      };
    }
  }

  private static getAdapter(channelType: NotificationChannel) {
    switch (channelType) {
      case 'webhook':
        return new WebhookAdapter();
      case 'telegram':
        return new TelegramAdapter();
      case 'lark':
        return new LarkAdapter();
      case 'slack':
        return new SlackAdapter();
      default:
        throw new NotificationSystemError(
          `Unsupported channel type: ${channelType}`,
          'INVALID_CHANNEL',
          false,
        );
    }
  }

  private static async logNotification(
    messageId: string,
    userId: string,
    channelType: NotificationChannel,
    templateKey: string | undefined,
    subject: string | undefined,
    content: string,
    status: 'pending' | 'sent' | 'failed' | 'retry',
    retryCount: number,
    errorMessage: string | undefined,
    env: Env,
  ): Promise<void> {
    try {
      const db = getDb(env);
      await db
        .insert(notificationLogs)
        .values({
          message_id: messageId,
          user_id: userId,
          channel_type: channelType,
          template_key: templateKey || null,
          subject: subject || null,
          content: content,
          status: status,
          retry_count: retryCount,
          error: errorMessage || null,
          sent_at: status === 'sent' ? new Date().toISOString() : null,
        });
    } catch (error) {
      this.logger.error('Failed to log notification', error, {
        messageId,
        userId,
        channelType,
      });
    }
  }

  static async sendPreparedNotification(
    notification: PreparedNotification,
    env: Env,
  ): Promise<NotificationResult> {
    return await this.sendSingleNotification(notification, env);
  }

  static async getNotificationResults(
    messageIds: string[],
    env: Env,
  ): Promise<NotificationResult[]> {
    if (messageIds.length === 0) {
      return [];
    }

    try {
      const db = getDb(env);
      const results = await db
        .select({
          id: notificationLogs.id,
          message_id: notificationLogs.message_id,
          user_id: notificationLogs.user_id,
          channel_type: notificationLogs.channel_type,
          status: notificationLogs.status,
          error: notificationLogs.error,
        })
        .from(notificationLogs)
        .where(inArray(notificationLogs.message_id, messageIds));

      return results.map((log) => {
        const notificationResult: NotificationResult = {
          channelType: log.channel_type as NotificationChannel,
          status: log.status === 'retry' ? 'retry_scheduled' : log.status as any,
          messageId: log.message_id,
          userId: log.user_id,
          logId: log.id,
        };
        
        if (log.error) {
          notificationResult.error = log.error;
        }
        
        return notificationResult;
      });
    } catch (error) {
      this.logger.error('Failed to get notification results', error, {
        messageIds,
      });
      return [];
    }
  }
}
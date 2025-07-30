import { eq, and, gte, sql } from 'drizzle-orm';
import { getDb, notificationLogs, userConfigs } from '../db';
import { Env, RetryMessage, PreparedNotification, NotificationChannel } from '../types';
import { NotificationDispatcherV2 } from './NotificationDispatcherV2';
import { RetryScheduler } from './RetryScheduler';
import { Logger } from '../utils/logger';
import { ValidationUtils } from '../utils/validation';

interface NotificationWithConfig {
  id: number;
  message_id: string;
  user_id: string;
  channel_type: string;
  template_key: string | null;
  subject: string | null;
  content: string | null;
  status: string;
  sent_at: string | null;
  error: string | null;
  retry_count: number;
  request_id: string | null;
  variables: string | null;
  created_at: string;
  config_data: string;
  is_active: boolean;
}

export class QueueProcessorV2 {
  private static logger = Logger.getInstance();

  static async processRetryQueue(
    message: { body: RetryMessage; ack: () => void; retry: () => void },
    env: Env,
  ): Promise<void> {
    const { logId, retryCount } = message.body;

    try {
      this.logger.info('Processing retry message', {
        logId,
        retryCount,
      });

      const notificationData = await this.getNotificationWithConfig(logId, env);
      
      if (!notificationData) {
        this.logger.warn('Notification or config not found for retry', { logId });
        message.ack();
        return;
      }

      const notification: PreparedNotification = {
        user_id: notificationData.user_id,
        channel_type: notificationData.channel_type as NotificationChannel,
        config: ValidationUtils.parseJsonSafe(notificationData.config_data) || {},
        content: notificationData.content || '',
      };
      
      if (notificationData.subject) {
        notification.subject = notificationData.subject;
      }
      if (notificationData.template_key) {
        notification.template_key = notificationData.template_key;
      }

      // Use the public method from NotificationDispatcherV2
      await NotificationDispatcherV2.sendPreparedNotification(notification, env);
      
      await this.updateNotificationSuccess(logId, env);
      
      this.logger.info('Retry notification sent successfully', {
        logId,
        userId: notificationData.user_id,
        channel: notificationData.channel_type,
      });
      
      message.ack();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Retry failed', error, {
        logId,
        retryCount,
      });

      const scheduled = await RetryScheduler.scheduleRetry(
        logId,
        retryCount,
        errorMessage,
        env,
      );

      if (!scheduled) {
        this.logger.error('Max retries reached or scheduling failed', undefined, {
          logId,
          retryCount,
        });
      }
      
      message.ack();
    }
  }

  static async processDeadLetterQueue(
    message: { body: RetryMessage; ack: () => void },
    env: Env,
  ): Promise<void> {
    const { logId, retryCount } = message.body;

    try {
      this.logger.error('Processing dead letter queue message', undefined, {
        logId,
        retryCount,
      });

      const db = getDb(env);
      
      // Update notification status to failed
      await db
        .update(notificationLogs)
        .set({
          status: 'failed',
          error: 'Maximum retries exceeded - moved to DLQ',
        })
        .where(eq(notificationLogs.id, logId));

      // Get notification details for logging
      const results = await db
        .select({
          user_id: notificationLogs.user_id,
          channel_type: notificationLogs.channel_type,
          message_id: notificationLogs.message_id,
        })
        .from(notificationLogs)
        .where(eq(notificationLogs.id, logId))
        .limit(1);

      const log = results[0];
      if (log) {
        this.logger.error('Notification permanently failed', undefined, {
          logId,
          userId: log.user_id,
          channel: log.channel_type,
          messageId: log.message_id,
        });
      }

      message.ack();
    } catch (error) {
      this.logger.error('Failed to process DLQ message', error, { logId });
      message.ack();
    }
  }

  private static async getNotificationWithConfig(
    logId: number,
    env: Env,
  ): Promise<NotificationWithConfig | null> {
    try {
      const db = getDb(env);
      
      // Join notification logs with user configs
      const results = await db
        .select({
          id: notificationLogs.id,
          message_id: notificationLogs.message_id,
          user_id: notificationLogs.user_id,
          channel_type: notificationLogs.channel_type,
          template_key: notificationLogs.template_key,
          subject: notificationLogs.subject,
          content: notificationLogs.content,
          status: notificationLogs.status,
          sent_at: notificationLogs.sent_at,
          error: notificationLogs.error,
          retry_count: notificationLogs.retry_count,
          request_id: notificationLogs.request_id,
          variables: notificationLogs.variables,
          created_at: notificationLogs.created_at,
          config_data: userConfigs.config_data,
          is_active: userConfigs.is_active,
        })
        .from(notificationLogs)
        .innerJoin(
          userConfigs,
          and(
            eq(notificationLogs.user_id, userConfigs.user_id),
            eq(notificationLogs.channel_type, userConfigs.channel_type)
          )
        )
        .where(
          and(
            eq(notificationLogs.id, logId),
            eq(userConfigs.is_active, true)
          )
        )
        .limit(1);

      return results[0] || null;
    } catch (error) {
      this.logger.error('Failed to get notification with config', error, { logId });
      return null;
    }
  }

  private static async updateNotificationSuccess(logId: number, env: Env): Promise<void> {
    try {
      const db = getDb(env);
      
      await db
        .update(notificationLogs)
        .set({
          status: 'sent',
          error: null,
          sent_at: new Date().toISOString(),
        })
        .where(eq(notificationLogs.id, logId));
    } catch (error) {
      this.logger.error('Failed to update notification success', error, { logId });
    }
  }

  static async getQueueStats(env: Env): Promise<{
    retryQueueSize: number;
    dlqSize: number;
    processingRate: number;
  }> {
    try {
      const db = getDb(env);
      
      // Count retry notifications
      const retryCountResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(notificationLogs)
        .where(eq(notificationLogs.status, 'retry'));
      
      const retryCount = retryCountResult[0]?.count ?? 0;

      // Count failed notifications (DLQ)
      const failedCountResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(notificationLogs)
        .where(
          and(
            eq(notificationLogs.status, 'failed'),
            gte(notificationLogs.retry_count, 2)
          )
        );
      
      const failedCount = failedCountResult[0]?.count ?? 0;

      // Count recently processed
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recentProcessedResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(notificationLogs)
        .where(gte(notificationLogs.sent_at, oneHourAgo));
      
      const recentProcessed = recentProcessedResult[0]?.count ?? 0;

      return {
        retryQueueSize: retryCount,
        dlqSize: failedCount,
        processingRate: recentProcessed,
      };
    } catch (error) {
      this.logger.error('Failed to get queue stats', error);
      return {
        retryQueueSize: 0,
        dlqSize: 0,
        processingRate: 0,
      };
    }
  }
}
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getDb, notificationLogs } from '../db';
import { Env, RetryMessage } from '../types';
import { Logger } from '../utils/logger';

interface NotificationLogRecord {
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
}

export class RetryScheduler {
  private static readonly RETRY_INTERVALS = [10, 30]; // seconds
  private static readonly MAX_RETRY_COUNT = 2;
  private static logger = Logger.getInstance();

  static async scheduleRetry(
    logId: number,
    retryCount: number,
    errorMessage: string,
    env: Env,
  ): Promise<boolean> {
    if (retryCount >= this.MAX_RETRY_COUNT) {
      await this.markAsFailed(logId, errorMessage, env);
      
      await this.sendToDeadLetterQueue(logId, retryCount, env);
      
      this.logger.info('Max retries reached, marked as failed', {
        logId,
        retryCount,
        errorMessage,
      });
      
      return false;
    }

    const delaySeconds = this.RETRY_INTERVALS[retryCount] || this.RETRY_INTERVALS[this.RETRY_INTERVALS.length - 1];
    
    this.logger.info(`Scheduling retry ${retryCount + 1}`, {
      logId,
      delaySeconds,
      nextRetryCount: retryCount + 1,
    });

    const retryMessage: RetryMessage = {
      logId,
      retryCount: retryCount + 1,
      type: 'retry_notification',
      scheduledAt: Date.now(),
      expectedProcessAt: Date.now() + (delaySeconds ?? 0) * 1000,
    };

    try {
      const sendOptions: Record<string, unknown> = {};
      if (delaySeconds !== undefined) {
        sendOptions['delaySeconds'] = delaySeconds;
      }
      
      await env.RETRY_QUEUE.send(retryMessage, sendOptions as any);
      
      this.logger.info('Retry message sent to queue', {
        logId,
        retryCount: retryCount + 1,
        delaySeconds,
        queueName: 'RETRY_QUEUE',
      });

      await this.updateRetryStatus(logId, retryCount + 1, errorMessage, env);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to schedule retry', error, {
        logId,
        retryCount,
      });
      
      await this.markAsFailed(logId, `Failed to schedule retry: ${error instanceof Error ? error.message : String(error)}`, env);
      
      return false;
    }
  }

  private static async updateRetryStatus(
    logId: number,
    retryCount: number,
    errorMessage: string,
    env: Env,
  ): Promise<void> {
    try {
      const db = getDb(env);
      
      await db
        .update(notificationLogs)
        .set({
          status: 'retry',
          retry_count: retryCount,
          error: errorMessage,
        })
        .where(eq(notificationLogs.id, logId));
    } catch (error) {
      this.logger.error('Failed to update retry status', error, { logId });
    }
  }

  private static async markAsFailed(
    logId: number,
    errorMessage: string,
    env: Env,
  ): Promise<void> {
    try {
      const db = getDb(env);
      
      await db
        .update(notificationLogs)
        .set({
          status: 'failed',
          error: errorMessage,
        })
        .where(eq(notificationLogs.id, logId));
    } catch (error) {
      this.logger.error('Failed to mark notification as failed', error, { logId });
    }
  }

  private static async sendToDeadLetterQueue(
    logId: number,
    retryCount: number,
    env: Env,
  ): Promise<void> {
    try {
      const message: RetryMessage = {
        logId,
        retryCount,
        type: 'retry_notification',
        scheduledAt: Date.now(),
        expectedProcessAt: Date.now(),
      };

      await env.FAILED_QUEUE.send(message);
      
      this.logger.info('Message sent to dead letter queue', { logId });
    } catch (error) {
      this.logger.error('Failed to send to dead letter queue', error, { logId });
    }
  }

  static async getRetryableNotification(
    logId: number,
    env: Env,
  ): Promise<NotificationLogRecord | null> {
    try {
      const db = getDb(env);
      
      const results = await db
        .select()
        .from(notificationLogs)
        .where(
          and(
            eq(notificationLogs.id, logId),
            inArray(notificationLogs.status, ['pending', 'retry'])
          )
        )
        .limit(1);

      return results[0] || null;
    } catch (error) {
      this.logger.error('Failed to fetch retryable notification', error, { logId });
      return null;
    }
  }

  static calculateNextRetryTime(retryCount: number): number {
    const delaySeconds = this.RETRY_INTERVALS[retryCount] || this.RETRY_INTERVALS[this.RETRY_INTERVALS.length - 1];
    return Date.now() + (delaySeconds ?? 0) * 1000;
  }

  static isRetryable(errorCode?: string): boolean {
    const nonRetryableErrors = [
      'INVALID_REQUEST',
      'INVALID_USER_ID',
      'INVALID_CHANNELS',
      'INVALID_CHANNEL_TYPE',
      'INVALID_TEMPLATE_KEY',
      'INVALID_VARIABLES',
      'INVALID_CUSTOM_CONTENT',
      'INVALID_CONTENT',
      'INVALID_SUBJECT',
      'MISSING_CONTENT',
      'INVALID_IDEMPOTENCY_KEY',
      'INVALID_CONFIG',
      'MISSING_WEBHOOK_URL',
      'INVALID_WEBHOOK_URL',
      'MISSING_BOT_TOKEN',
      'MISSING_CHAT_ID',
      'UNSUPPORTED_CHANNEL',
      'MISSING_SIGNATURE',
      'INVALID_TIMESTAMP',
      'REQUEST_EXPIRED',
    ];

    return !errorCode || !nonRetryableErrors.includes(errorCode);
  }

  static async getRetryStats(userId: string, env: Env): Promise<{
    totalRetries: number;
    failedAfterRetries: number;
    pendingRetries: number;
  }> {
    try {
      const db = getDb(env);
      
      // Use raw SQL for complex aggregation
      const result = await db.get<{
        totalRetries: number;
        failedAfterRetries: number;
        pendingRetries: number;
      }>(sql`
        SELECT 
          COUNT(CASE WHEN retry_count > 0 THEN 1 END) as totalRetries,
          COUNT(CASE WHEN status = 'failed' AND retry_count >= ${this.MAX_RETRY_COUNT} THEN 1 END) as failedAfterRetries,
          COUNT(CASE WHEN status = 'retry' THEN 1 END) as pendingRetries
        FROM notification_logs
        WHERE user_id = ${userId}
      `);

      return result || { totalRetries: 0, failedAfterRetries: 0, pendingRetries: 0 };
    } catch (error) {
      this.logger.error('Failed to get retry stats', error, { userId });
      return { totalRetries: 0, failedAfterRetries: 0, pendingRetries: 0 };
    }
  }
}
import { Env, RetryMessage } from '../../types';
import { Logger } from '../../utils/logger';
import { getDb } from '../../db/index';
import { notificationLogs } from '../../db/schema';
import { and, eq, lt, desc } from 'drizzle-orm';

const logger = Logger.getInstance();

export async function triggerRetryHandler(
  _request: Request,
  env: Env,
): Promise<Response> {
  try {
    // 获取所有需要重试的失败通知 - 使用 Drizzle ORM
    const db = getDb(env);
    const failedNotifications = await db
      .select({
        id: notificationLogs.id,
        user_id: notificationLogs.user_id,
        channel_type: notificationLogs.channel_type,
        retry_count: notificationLogs.retry_count,
      })
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.status, 'failed'),
          lt(notificationLogs.retry_count, 2)
        )
      )
      .orderBy(desc(notificationLogs.created_at))
      .limit(100);
    
    if (!failedNotifications || failedNotifications.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            queued: 0,
            message: 'No failed notifications to retry',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    
    // 将失败的通知加入重试队列
    let queuedCount = 0;
    for (const notification of failedNotifications) {
      const retryMessage: RetryMessage = {
        logId: notification.id,
        retryCount: notification.retry_count + 1,
        type: 'retry_notification',
        scheduledAt: Date.now(),
        expectedProcessAt: Date.now() + 10000, // 10秒后处理
      };
      
      try {
        await env.RETRY_QUEUE.send(retryMessage, { delaySeconds: 10 });
        
        // 更新状态为重试中 - 使用 Drizzle ORM
        await db
          .update(notificationLogs)
          .set({
            status: 'retry',
            retry_count: notification.retry_count + 1,
          })
          .where(eq(notificationLogs.id, notification.id));
        
        queuedCount++;
      } catch (error) {
        logger.error('Failed to queue retry for notification', { 
          error, 
          notificationId: notification.id 
        });
      }
    }
    
    logger.info('Manually triggered retry processing', {
      totalFailed: failedNotifications.length,
      queued: queuedCount,
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          total_failed: failedNotifications.length,
          queued: queuedCount,
          message: `Queued ${queuedCount} notifications for retry`,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    logger.error('Failed to trigger retry', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
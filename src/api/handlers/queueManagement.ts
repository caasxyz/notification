import { Env } from '../../types';
import { Logger } from '../../utils/logger';
import { getDb, notificationLogs } from '../../db';
import { eq, and, lt, inArray } from 'drizzle-orm';

const logger = Logger.getInstance();

interface QueueInfo {
  name: string;
  size: number;
  messages?: any[];
}

/**
 * Get queue status and information
 */
export async function getQueueStatusHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const queues: QueueInfo[] = [];
    
    // Get retry queue info
    try {
      // Note: Cloudflare Queues doesn't provide a direct way to get queue size
      // This is a placeholder - in production, you might track this separately
      const retryQueueInfo: QueueInfo = {
        name: 'retry-queue',
        size: -1, // Unknown
      };
      queues.push(retryQueueInfo);
    } catch (error) {
      logger.error('Failed to get retry queue info', error);
    }
    
    // Get failed queue (DLQ) info
    try {
      const failedQueueInfo: QueueInfo = {
        name: 'failed-notifications-dlq',
        size: -1, // Unknown
      };
      queues.push(failedQueueInfo);
    } catch (error) {
      logger.error('Failed to get DLQ info', error);
    }
    
    // Get pending retry tasks from database
    const db = getDb(env);
    const pendingRetries = await db
      .select()
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.status, 'retry'),
          lt(notificationLogs.retry_count, 3)
        )
      )
      .limit(100);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          queues,
          pendingRetries: {
            count: pendingRetries.length,
            items: pendingRetries.map(log => ({
              id: log.id,
              user_id: log.user_id,
              channel: log.channel,
              retry_count: log.retry_count,
              created_at: log.created_at,
              error_message: log.error_message,
            })),
          },
          note: 'Queue sizes are not directly available in Cloudflare Queues API',
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    logger.error('Failed to get queue status', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to get queue status',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

/**
 * Clear retry tasks and update their status
 */
export async function clearRetryTasksHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = await request.json();
    const { taskIds, markAsFailed = true } = body as {
      taskIds?: string[];
      markAsFailed?: boolean;
    };
    
    const db = getDb(env);
    
    if (taskIds && taskIds.length > 0) {
      // Clear specific tasks
      await db
        .update(notificationLogs)
        .set({
          status: markAsFailed ? 'failed' : 'cancelled',
          updated_at: new Date().toISOString(),
          error_message: markAsFailed 
            ? 'Manually marked as failed' 
            : 'Manually cancelled',
        })
        .where(
          and(
            inArray(notificationLogs.id, taskIds),
            eq(notificationLogs.status, 'retry')
          )
        );
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Updated ${taskIds.length} retry tasks`,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } else {
      // Clear all retry tasks
      const result = await db
        .update(notificationLogs)
        .set({
          status: markAsFailed ? 'failed' : 'cancelled',
          updated_at: new Date().toISOString(),
          error_message: markAsFailed 
            ? 'Bulk marked as failed' 
            : 'Bulk cancelled',
        })
        .where(eq(notificationLogs.status, 'retry'));
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All retry tasks have been cleared',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    logger.error('Failed to clear retry tasks', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to clear retry tasks',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

/**
 * Purge test data from the system
 */
export async function purgeTestDataHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = await request.json();
    const { testUserIds = ['test-user', 'demo-user'], dryRun = false } = body as {
      testUserIds?: string[];
      dryRun?: boolean;
    };
    
    const db = getDb(env);
    
    if (dryRun) {
      // Just count how many records would be deleted
      const count = await db
        .select()
        .from(notificationLogs)
        .where(inArray(notificationLogs.user_id, testUserIds));
      
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          message: `Would delete ${count.length} test records`,
          affectedUserIds: testUserIds,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } else {
      // Actually delete the test data
      await db
        .delete(notificationLogs)
        .where(inArray(notificationLogs.user_id, testUserIds));
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Test data has been purged',
          affectedUserIds: testUserIds,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    logger.error('Failed to purge test data', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to purge test data',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
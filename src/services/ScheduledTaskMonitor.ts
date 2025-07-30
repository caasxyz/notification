import { eq, and, sql } from 'drizzle-orm';
import { getDb, taskExecutionRecords } from '../db';
import { Env } from '../types';
import { QueueProcessorV2 } from './QueueProcessorV2';
import { IdempotencyManager } from './IdempotencyManager';
import { ConfigCache } from './ConfigCache';
import { Logger } from '../utils/logger';

export class ScheduledTaskMonitor {
  private static logger = Logger.getInstance();

  static async executeMonitoring(env: Env): Promise<{
    timestamp: string;
    metrics: {
      notifications: {
        total: number;
        pending: number;
        sent: number;
        failed: number;
        retry: number;
      };
      queues: {
        retryQueueSize: number;
        dlqSize: number;
        processingRate: number;
      };
      idempotency: {
        totalKeys: number;
        activeKeys: number;
        expiredKeys: number;
      };
      cache: {
        estimatedSize: number;
        keyCount: number;
      };
      performance: {
        avgResponseTime: number;
        successRate: number;
      };
    };
    alerts: string[];
  }> {
    const startTime = Date.now();
    const alerts: string[] = [];

    this.logger.info('Starting scheduled monitoring');

    const [notificationStats, queueStats, idempotencyStats, cacheStats, performanceStats] = 
      await Promise.all([
        this.getNotificationStats(env),
        QueueProcessorV2.getQueueStats(env),
        IdempotencyManager.getStats(env),
        ConfigCache.getCacheStats(env),
        this.getPerformanceStats(env),
      ]);

    if (notificationStats.failed > 100) {
      alerts.push(`High failure count: ${notificationStats.failed} notifications failed`);
    }

    if (queueStats.retryQueueSize > 1000) {
      alerts.push(`Large retry queue: ${queueStats.retryQueueSize} messages pending`);
    }

    if (queueStats.dlqSize > 50) {
      alerts.push(`Dead letter queue contains ${queueStats.dlqSize} messages`);
    }

    if (performanceStats.successRate < 95) {
      alerts.push(`Low success rate: ${performanceStats.successRate.toFixed(2)}%`);
    }

    if (performanceStats.avgResponseTime > 5000) {
      alerts.push(`High average response time: ${performanceStats.avgResponseTime.toFixed(0)}ms`);
    }

    const result = {
      timestamp: new Date().toISOString(),
      metrics: {
        notifications: notificationStats,
        queues: queueStats,
        idempotency: idempotencyStats,
        cache: cacheStats,
        performance: performanceStats,
      },
      alerts,
    };

    const duration = Date.now() - startTime;
    this.logger.info('Scheduled monitoring completed', {
      duration,
      alertCount: alerts.length,
    });

    if (alerts.length > 0) {
      this.logger.warn('Monitoring alerts triggered', { alerts });
    }

    return result;
  }

  private static async getNotificationStats(env: Env): Promise<{
    total: number;
    pending: number;
    sent: number;
    failed: number;
    retry: number;
  }> {
    try {
      const db = getDb(env);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Use raw SQL for complex aggregation
      const stats = await db.get<{
        total: number;
        pending: number;
        sent: number;
        failed: number;
        retry: number;
      }>(sql`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN status = 'retry' THEN 1 END) as retry
        FROM notification_logs
        WHERE created_at >= ${twentyFourHoursAgo}
      `);

      return stats || {
        total: 0,
        pending: 0,
        sent: 0,
        failed: 0,
        retry: 0,
      };
    } catch (error) {
      this.logger.error('Failed to get notification stats', error);
      return {
        total: 0,
        pending: 0,
        sent: 0,
        failed: 0,
        retry: 0,
      };
    }
  }

  private static async getPerformanceStats(env: Env): Promise<{
    avgResponseTime: number;
    successRate: number;
  }> {
    try {
      const db = getDb(env);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Use raw SQL for complex calculations
      const stats = await db.get<{
        avg_response_time: number | null;
        success_rate: number | null;
      }>(sql`
        SELECT 
          AVG(CASE 
            WHEN sent_at IS NOT NULL 
            THEN CAST((julianday(sent_at) - julianday(created_at)) * 86400000 AS INTEGER)
            ELSE NULL 
          END) as avg_response_time,
          CAST(COUNT(CASE WHEN status = 'sent' THEN 1 END) AS REAL) / 
          CAST(COUNT(CASE WHEN status IN ('sent', 'failed') THEN 1 END) AS REAL) * 100 as success_rate
        FROM notification_logs
        WHERE created_at >= ${twentyFourHoursAgo}
      `);

      return {
        avgResponseTime: stats?.avg_response_time || 0,
        successRate: stats?.success_rate || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get performance stats', error);
      return {
        avgResponseTime: 0,
        successRate: 0,
      };
    }
  }

  static async getMonitoringHistory(
    env: Env,
    limit: number = 24,
  ): Promise<Array<{
    timestamp: string;
    metrics: unknown;
  }>> {
    try {
      const db = getDb(env);
      
      const results = await db
        .select({
          execution_time: taskExecutionRecords.execution_time,
          error: taskExecutionRecords.error,
        })
        .from(taskExecutionRecords)
        .where(
          and(
            eq(taskExecutionRecords.task_name, 'monitoring'),
            eq(taskExecutionRecords.status, 'completed')
          )
        )
        .orderBy(sql`${taskExecutionRecords.execution_time} DESC`)
        .limit(limit);

      return results.map((record) => {
        try {
          return {
            timestamp: record.execution_time,
            metrics: record.error ? JSON.parse(record.error) : {},
          };
        } catch {
          return {
            timestamp: record.execution_time,
            metrics: {},
          };
        }
      });
    } catch (error) {
      this.logger.error('Failed to get monitoring history', error);
      return [];
    }
  }
}
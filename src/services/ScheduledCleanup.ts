import { lte, eq, and, inArray, sql } from 'drizzle-orm';
import { getDb, notificationLogs, idempotencyKeys, taskExecutionRecords } from '../db';
import { Env, CleanupResult } from '../types';
import { IdempotencyManager } from './IdempotencyManager';
import { Logger } from '../utils/logger';
import { ConfigCache } from './ConfigCache';

export class ScheduledCleanup {
  private static logger = Logger.getInstance();
  private static readonly DEFAULT_RETENTION_HOURS = 72;

  static async executeCleanup(env: Env): Promise<CleanupResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let cleanedLogs = 0;
    let cleanedKeys = 0;
    let cleanedCache = 0;

    this.logger.info('Starting scheduled cleanup');

    try {
      cleanedLogs = await this.cleanupOldNotificationLogs(env);
    } catch (error) {
      const errorMessage = `Failed to cleanup notification logs: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMessage);
      this.logger.error(errorMessage, error);
    }

    try {
      cleanedKeys = await IdempotencyManager.cleanupExpiredKeys(env);
    } catch (error) {
      const errorMessage = `Failed to cleanup idempotency keys: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMessage);
      this.logger.error(errorMessage, error);
    }

    try {
      cleanedCache = await this.cleanupCacheStats(env);
    } catch (error) {
      const errorMessage = `Failed to cleanup cache stats: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMessage);
      this.logger.error(errorMessage, error);
    }

    try {
      await this.cleanupTaskExecutionRecords(env);
    } catch (error) {
      const errorMessage = `Failed to cleanup task execution records: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMessage);
      this.logger.error(errorMessage, error);
    }

    const duration = Date.now() - startTime;
    
    const result: CleanupResult = {
      timestamp: new Date().toISOString(),
      cleanedLogs,
      cleanedKeys,
      cleanedCache,
      duration,
      errors,
    };

    this.logger.info('Scheduled cleanup completed', { ...result });

    return result;
  }

  private static async cleanupOldNotificationLogs(env: Env): Promise<number> {
    const retentionHours = await this.getRetentionHours(env);
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - retentionHours);
    const cutoffDateStr = cutoffDate.toISOString();

    const db = getDb(env);
    
    // First count the records to be deleted
    const toDelete = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationLogs)
      .where(
        and(
          lte(notificationLogs.created_at, cutoffDateStr),
          inArray(notificationLogs.status, ['sent', 'failed'])
        )
      );
    
    const deletedCount = toDelete[0]?.count ?? 0;
    
    if (deletedCount > 0) {
      await db
        .delete(notificationLogs)
        .where(
          and(
            lte(notificationLogs.created_at, cutoffDateStr),
            inArray(notificationLogs.status, ['sent', 'failed'])
          )
        );
    }

    if (deletedCount > 0) {
      this.logger.info('Cleaned up old notification logs', {
        deletedCount,
        cutoffDate: cutoffDateStr,
      });
    }

    return deletedCount;
  }

  private static async cleanupCacheStats(env: Env): Promise<number> {
    let cleanedCount = 0;

    try {
      const list = await env.CONFIG_CACHE.list({ prefix: 'stats:' });
      
      const deletePromises = list.keys
        .filter((key) => this.isExpiredStatKey(key.name))
        .map(async (key) => {
          await env.CONFIG_CACHE.delete(key.name);
          cleanedCount++;
        });

      await Promise.all(deletePromises);

      if (cleanedCount > 0) {
        this.logger.info('Cleaned up cache stats', { cleanedCount });
      }
    } catch (error) {
      this.logger.error('Failed to list cache keys', error);
    }

    return cleanedCount;
  }

  private static async cleanupTaskExecutionRecords(env: Env): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDateStr = thirtyDaysAgo.toISOString();

    const db = getDb(env);
    
    // First count the records to be deleted
    const toDelete = await db
      .select({ count: sql<number>`count(*)` })
      .from(taskExecutionRecords)
      .where(lte(taskExecutionRecords.execution_time, cutoffDateStr));
    
    const deletedCount = toDelete[0]?.count ?? 0;
    
    if (deletedCount > 0) {
      await db
        .delete(taskExecutionRecords)
        .where(lte(taskExecutionRecords.execution_time, cutoffDateStr));
    }

    if (deletedCount > 0) {
      this.logger.info('Cleaned up old task execution records', {
        deletedCount,
        cutoffDate: cutoffDateStr,
      });
    }

    return deletedCount;
  }

  private static async getRetentionHours(env: Env): Promise<number> {
    try {
      const configValue = await ConfigCache.getSystemConfig('cleanup_retention_hours', env);
      if (configValue) {
        const hours = parseInt(configValue, 10);
        if (!isNaN(hours) && hours > 0) {
          return hours;
        }
      }
    } catch (error) {
      this.logger.error('Failed to get retention hours config', error);
    }

    return this.DEFAULT_RETENTION_HOURS;
  }

  private static isExpiredStatKey(key: string): boolean {
    const match = key.match(/stats:(\d{4}-\d{2}-\d{2})/);
    if (!match) return false;

    const statDate = new Date(match[1] as string);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return statDate < sevenDaysAgo;
  }

  static async getCleanupStats(env: Env): Promise<{
    pendingCleanup: {
      logs: number;
      keys: number;
      taskRecords: number;
    };
    lastCleanup?: CleanupResult;
  }> {
    const retentionHours = await this.getRetentionHours(env);
    const logsCutoff = new Date();
    logsCutoff.setHours(logsCutoff.getHours() - retentionHours);
    const logsCutoffStr = logsCutoff.toISOString();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    const db = getDb(env);

    // Count logs to cleanup
    const logsCountResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notificationLogs)
      .where(
        and(
          lte(notificationLogs.created_at, logsCutoffStr),
          inArray(notificationLogs.status, ['sent', 'failed'])
        )
      );
    const logsCount = logsCountResult[0]?.count ?? 0;

    // Count expired keys
    const now = new Date().toISOString();
    const keysCountResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(idempotencyKeys)
      .where(lte(idempotencyKeys.expires_at, now));
    const keysCount = keysCountResult[0]?.count ?? 0;

    // Count old task records
    const taskRecordsCountResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(taskExecutionRecords)
      .where(lte(taskExecutionRecords.execution_time, thirtyDaysAgoStr));
    const taskRecordsCount = taskRecordsCountResult[0]?.count ?? 0;

    // Get last cleanup record
    const lastCleanupRecords = await db
      .select({ error: taskExecutionRecords.error })
      .from(taskExecutionRecords)
      .where(
        and(
          eq(taskExecutionRecords.task_name, 'data_cleanup'),
          eq(taskExecutionRecords.status, 'completed')
        )
      )
      .orderBy(sql`${taskExecutionRecords.execution_time} DESC`)
      .limit(1);

    let lastCleanup: CleanupResult | undefined;
    if (lastCleanupRecords[0]?.error) {
      try {
        lastCleanup = JSON.parse(lastCleanupRecords[0].error) as CleanupResult;
      } catch {
        // Ignore parse errors
      }
    }

    const result: {
      pendingCleanup: {
        logs: number;
        keys: number;
        taskRecords: number;
      };
      lastCleanup?: CleanupResult;
    } = {
      pendingCleanup: {
        logs: logsCount,
        keys: keysCount,
        taskRecords: taskRecordsCount,
      },
    };
    
    if (lastCleanup) {
      result.lastCleanup = lastCleanup;
    }
    
    return result;
  }
}
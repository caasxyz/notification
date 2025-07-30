import { eq, and, lte, sql } from 'drizzle-orm';
import { getDb, taskExecutionRecords } from '../db';
import { Env, ScheduledEvent } from '../types';
import { ScheduledCleanup } from './ScheduledCleanup';
import { ScheduledTaskMonitor } from './ScheduledTaskMonitor';
import { Logger } from '../utils/logger';

export class ScheduledTaskHandler {
  private static logger = Logger.getInstance();

  static async handleScheduledEvent(
    event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const taskName = this.getTaskName(event.cron);
    
    Logger.logScheduledTask(taskName, 'started', {
      cron: event.cron,
      scheduledTime: new Date(event.scheduledTime).toISOString(),
    });

    const startTime = Date.now();

    try {
      let result: unknown;

      switch (taskName) {
        case 'data_cleanup':
          result = await ScheduledCleanup.executeCleanup(env);
          break;
        case 'monitoring':
          result = await ScheduledTaskMonitor.executeMonitoring(env);
          break;
        default:
          this.logger.warn('Unknown scheduled task', { cron: event.cron });
          return;
      }

      const duration = Date.now() - startTime;
      await this.recordTaskExecution(taskName, 'completed', result, duration, env);
      
      Logger.logScheduledTask(taskName, 'completed', {
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const duration = Date.now() - startTime;
      
      await this.recordTaskExecution(taskName, 'failed', { error: errorMessage }, duration, env);
      
      Logger.logScheduledTask(taskName, 'failed', {
        error: errorMessage,
      });
      
      throw error;
    }
  }

  private static getTaskName(cron: string): string {
    if (cron.includes('2 * * *') || cron.includes('*/4 * * *')) {
      return 'data_cleanup';
    }
    
    if (cron.includes('0 * * *')) {
      return 'monitoring';
    }
    
    return `unknown_${cron.replace(/\s+/g, '_')}`;
  }

  private static async recordTaskExecution(
    taskName: string,
    status: 'completed' | 'failed',
    details: unknown,
    durationMs: number,
    env: Env,
  ): Promise<void> {
    try {
      const db = getDb(env);
      
      await db
        .insert(taskExecutionRecords)
        .values({
          task_name: taskName,
          execution_time: new Date().toISOString(),
          status: status,
          error: JSON.stringify(details),
          duration_ms: durationMs,
        });
    } catch (error) {
      this.logger.error('Failed to record task execution', error, {
        taskName,
        status,
      });
    }
  }

  static async getLastExecutionTime(
    taskName: string,
    env: Env,
  ): Promise<Date | null> {
    try {
      const db = getDb(env);
      
      const results = await db
        .select({ execution_time: taskExecutionRecords.execution_time })
        .from(taskExecutionRecords)
        .where(
          and(
            eq(taskExecutionRecords.task_name, taskName),
            eq(taskExecutionRecords.status, 'completed')
          )
        )
        .orderBy(sql`${taskExecutionRecords.execution_time} DESC`)
        .limit(1);

      return results[0] ? new Date(results[0].execution_time) : null;
    } catch (error) {
      this.logger.error('Failed to get last execution time', error, { taskName });
      return null;
    }
  }

  static async cleanupOldTaskRecords(env: Env): Promise<number> {
    try {
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
        this.logger.info('Cleaned up old task records', { deletedCount });
      }
      
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old task records', error);
      return 0;
    }
  }
}
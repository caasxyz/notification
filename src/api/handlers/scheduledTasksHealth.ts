import { Env, ScheduledTaskStatus } from '../../types';
import { Logger } from '../../utils/logger';
import { getDb, taskExecutionRecords } from '../../db';
import { eq, desc, sql, and } from 'drizzle-orm';
import { ScheduledCleanup } from '../../services/ScheduledCleanup';

const logger = Logger.getInstance();

export async function scheduledTasksHealthHandler(
  _request: Request,
  env: Env,
): Promise<Response> {
  try {
    const taskStatuses: Record<string, any> = {};

    // Get data cleanup task status
    const cleanupTask = await getTaskStatus('data_cleanup', env);
    taskStatuses['data_cleanup'] = cleanupTask;

    // Get monitoring task status
    const monitoringTask = await getTaskStatus('monitoring', env);
    taskStatuses['monitoring'] = monitoringTask;

    // Get cleanup statistics
    const cleanupStats = await ScheduledCleanup.getCleanupStats(env);

    const response = {
      timestamp: new Date().toISOString(),
      tasks: taskStatuses,
      pendingCleanup: cleanupStats.pendingCleanup,
      lastCleanupResult: cleanupStats.lastCleanup,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=30',
      },
    });
  } catch (error) {
    logger.error('Failed to get scheduled tasks health', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to retrieve scheduled tasks health',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
}

async function getTaskStatus(
  taskName: string,
  env: Env,
): Promise<any> {
  try {
    const db = getDb(env);
    
    // Get last 5 execution records
    const executions = await db
      .select()
      .from(taskExecutionRecords)
      .where(eq(taskExecutionRecords.task_name, taskName))
      .orderBy(desc(taskExecutionRecords.execution_time))
      .limit(5);

    if (executions.length === 0) {
      return {
        status: 'never_run',
        isRunning: false,
        message: 'Task has never been executed',
      };
    }

    const lastExecution = executions[0];
    const lastRunTime = new Date(lastExecution.execution_time);
    const nextRunTime = calculateNextRun(lastRunTime, taskName);

    let lastResult;
    try {
      lastResult = lastExecution.error ? JSON.parse(lastExecution.error) : null;
    } catch {
      lastResult = { details: lastExecution.error };
    }

    // Calculate success rate from recent executions
    const successCount = executions.filter(e => e.status === 'completed').length;
    const successRate = (successCount / executions.length) * 100;

    return {
      lastRun: lastExecution.execution_time,
      nextRun: nextRunTime.toISOString(),
      lastStatus: lastExecution.status,
      lastDuration: lastExecution.duration_ms,
      lastResult,
      isRunning: false,
      recentExecutions: executions.length,
      successRate: Math.round(successRate),
    };
  } catch (error) {
    logger.error('Failed to get task status', error, { taskName });
    return {
      status: 'error',
      isRunning: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function calculateNextRun(lastRun: Date, taskName: string): Date {
  const nextRun = new Date(lastRun);

  switch (taskName) {
    case 'data_cleanup':
      // Every 5 minutes based on new cron schedule
      nextRun.setMinutes(nextRun.getMinutes() + 5);
      break;
    case 'monitoring':
      // Still every hour
      nextRun.setHours(nextRun.getHours() + 1);
      break;
    default:
      nextRun.setHours(nextRun.getHours() + 24);
  }

  return nextRun;
}
import { Env, ScheduledTaskStatus } from '../../types';
import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

export async function scheduledTasksHealthHandler(
  _request: Request,
  env: Env,
): Promise<Response> {
  try {
    const taskStatuses: Record<string, ScheduledTaskStatus> = {};

    const cleanupTask = await getTaskStatus('data_cleanup', env);
    taskStatuses['data_cleanup'] = cleanupTask;

    const monitoringTask = await getTaskStatus('monitoring', env);
    taskStatuses['monitoring'] = monitoringTask;

    const response = {
      timestamp: new Date().toISOString(),
      tasks: taskStatuses,
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
): Promise<ScheduledTaskStatus> {
  try {
    const lastExecution = await env.DB.prepare(`
      SELECT * FROM task_execution_records
      WHERE task_name = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).bind(taskName).first<{
      status: 'success' | 'failed';
      details: string;
      timestamp: string;
    }>();

    if (!lastExecution) {
      return {
        isRunning: false,
      };
    }

    const lastRunTime = new Date(lastExecution.timestamp);
    const nextRunTime = calculateNextRun(lastRunTime, taskName);

    let lastResult;
    try {
      lastResult = JSON.parse(lastExecution.details);
    } catch {
      lastResult = { details: lastExecution.details };
    }

    return {
      lastRun: lastExecution.timestamp,
      nextRun: nextRunTime.toISOString(),
      lastResult,
      isRunning: false,
    };
  } catch (error) {
    logger.error('Failed to get task status', error, { taskName });
    return {
      isRunning: false,
    };
  }
}

function calculateNextRun(lastRun: Date, taskName: string): Date {
  const nextRun = new Date(lastRun);

  switch (taskName) {
    case 'data_cleanup':
      nextRun.setHours(nextRun.getHours() + 24);
      break;
    case 'monitoring':
      nextRun.setHours(nextRun.getHours() + 1);
      break;
    default:
      nextRun.setHours(nextRun.getHours() + 24);
  }

  return nextRun;
}
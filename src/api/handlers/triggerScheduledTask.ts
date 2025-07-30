import { Env } from '../../types';
import { Logger } from '../../utils/logger';
import { ScheduledTaskHandler } from '../../services/ScheduledTaskHandler';

const logger = Logger.getInstance();

export async function triggerScheduledTaskHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = await request.json() as { taskName?: string };
    const taskName = body.taskName || 'data_cleanup';
    
    logger.info('Manually triggering scheduled task', { taskName });
    
    // Create a fake scheduled event
    const fakeEvent = {
      cron: taskName === 'data_cleanup' ? '*/5 * * * *' : '0 * * * *',
      scheduledTime: Date.now(),
      type: 'scheduled' as const,
    };
    
    // Execute the scheduled task
    await ScheduledTaskHandler.handleScheduledEvent(
      fakeEvent,
      env,
      { 
        waitUntil: (promise: Promise<any>) => {
          // In a real worker context, this would be ctx.waitUntil
          // For manual trigger, we just wait
          promise.catch(error => {
            logger.error('Background task failed', error);
          });
        },
        passThroughOnException: () => {},
      } as ExecutionContext
    );
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Task ${taskName} triggered successfully`,
        taskName,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    logger.error('Failed to trigger scheduled task', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to trigger task',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
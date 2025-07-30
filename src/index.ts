import { Env, ScheduledEvent, BatchQueueProcessor, RetryMessage } from './types';
import { handleApiRequest } from './api/router';
import { QueueProcessorV2 } from './services/QueueProcessorV2';
import { ScheduledTaskHandler } from './services/ScheduledTaskHandler';
import { Logger } from './utils/logger';
import { withDatabaseInit } from './middleware/database';

const logger = Logger.getInstance();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(request.url);
    
    try {
      logger.info('Incoming request', {
        method: request.method,
        path: url.pathname,
        userAgent: request.headers.get('user-agent'),
      });

      // Wrap the API handler with database initialization
      const response = await withDatabaseInit(env, async () => {
        return await handleApiRequest(request, env, ctx);
      });
      
      const duration = Date.now() - startTime;
      Logger.logApiRequest(
        request.method,
        url.pathname,
        response.status,
        duration,
      );
      
      return response;
    } catch (error) {
      // If the error is already a Response object, return it as-is
      // This preserves the original error details from handlers
      if (error instanceof Response) {
        return error;
      }
      
      logger.error('Unhandled request error', error, {
        method: request.method,
        path: url.pathname,
      });
      
      // For development environment, include more error details
      const isDevelopment = env.ENVIRONMENT === 'development';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return new Response(
        JSON.stringify({
          success: false,
          error: isDevelopment ? errorMessage : 'Internal server error',
          details: isDevelopment ? errorMessage : undefined,
          stack: isDevelopment && error instanceof Error ? error.stack : undefined,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },

  async queue(
    batch: BatchQueueProcessor<RetryMessage>,
    env: Env,
  ): Promise<void> {
    const queueName = batch.queue;
    
    logger.info('Processing queue batch', {
      queue: queueName,
      messageCount: batch.messages.length,
    });

    // Wrap queue processing with database initialization
    await withDatabaseInit(env, async () => {
      if (queueName === 'retry-queue' || queueName === 'retry-queue-dev') {
        await this.handleRetryQueue(batch, env);
      } else if (queueName === 'failed-notifications-dlq' || queueName === 'failed-notifications-dlq-dev') {
        await this.handleDLQQueue(batch, env);
      } else {
        logger.warn('Unknown queue', { queueName });
        batch.ackAll();
      }
    });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    logger.info('Scheduled event triggered', {
      cron: event.cron,
      scheduledTime: new Date(event.scheduledTime).toISOString(),
    });

    try {
      // Wrap scheduled task handler with database initialization
      await withDatabaseInit(env, async () => {
        await ScheduledTaskHandler.handleScheduledEvent(event, env, ctx);
      });
    } catch (error) {
      logger.error('Scheduled task failed', error, {
        cron: event.cron,
      });
    }
  },

  async handleRetryQueue(
    batch: BatchQueueProcessor<RetryMessage>,
    env: Env,
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        await QueueProcessorV2.processRetryQueue(message, env);
      } catch (error) {
        logger.error('Retry queue message processing failed', error, {
          messageId: message.body.logId,
        });
        message.retry();
      }
    }
  },

  async handleDLQQueue(
    batch: BatchQueueProcessor<RetryMessage>,
    env: Env,
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        await QueueProcessorV2.processDeadLetterQueue(message, env);
      } catch (error) {
        logger.error('DLQ message processing failed', error, {
          messageId: message.body.logId,
        });
      }
    }
  },
};
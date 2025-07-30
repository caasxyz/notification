import { Env } from '../../types';
import { Logger } from '../../utils/logger';
import { getDb } from '../../db/index';
import { notificationLogs } from '../../db/schema';
import { lt, sql, and, inArray } from 'drizzle-orm';
import { ValidationUtils } from '../../utils/validation';

const logger = Logger.getInstance();

export async function cleanupLogsHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    let beforeDate: Date;

    // Support both query params and request body
    if (request.method === 'DELETE') {
      // Check for query parameter first
      const url = new URL(request.url);
      const beforeParam = url.searchParams.get('before');
      const daysParam = url.searchParams.get('days');
      
      if (beforeParam) {
        // Direct date parameter
        beforeDate = ValidationUtils.validateDateString(beforeParam);
      } else if (daysParam) {
        // Days parameter in query string
        const days = ValidationUtils.validatePositiveInteger(parseInt(daysParam), 'days');
        // Limit to maximum 365 days
        if (days > 365) {
          throw new Error('Cannot delete logs older than 365 days');
        }
        beforeDate = new Date();
        beforeDate.setDate(beforeDate.getDate() - days);
      } else {
        // Check request body for days parameter
        try {
          const body = await request.json() as { days?: number };
          if (body.days) {
            const days = ValidationUtils.validatePositiveInteger(body.days, 'days');
            // Limit to maximum 365 days
            if (days > 365) {
              throw new Error('Cannot delete logs older than 365 days');
            }
            beforeDate = new Date();
            beforeDate.setDate(beforeDate.getDate() - days);
          } else {
            throw new Error('Missing required parameter: before or days');
          }
        } catch (e) {
          throw new Error('Missing required parameter: before or days');
        }
      }
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Method not allowed',
        }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    
    // Count records to be deleted first
    const db = getDb(env);
    
    // Delete logs with various statuses (excluding active retries)
    const whereCondition = and(
      lt(notificationLogs.created_at, beforeDate.toISOString()),
      inArray(notificationLogs.status, ['sent', 'failed', 'pending', 'retry', 'retry_scheduled'])
    );
    
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationLogs)
      .where(whereCondition);
    
    const deleteCount = countResult[0]?.count || 0;
    
    if (deleteCount === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            deleted_count: 0,
            before: beforeDate.toISOString(),
            message: 'No logs found to delete',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    
    // Execute delete operation using Drizzle ORM
    await db
      .delete(notificationLogs)
      .where(whereCondition);
    
    logger.info('Cleaned up old notification logs', {
      before: beforeDate.toISOString(),
      deletedCount: deleteCount,
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          deleted_count: deleteCount,
          before: beforeDate.toISOString(),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    logger.error('Failed to cleanup logs', error);
    
    // Provide more detailed error information
    let errorMessage = 'Internal server error';
    let errorDetails: any = {};
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        stack: error.stack,
      };
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
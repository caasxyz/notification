import { Env } from '../../types';
import { Logger } from '../../utils/logger';
import { getDb } from '../../db/index';
import { notificationLogs } from '../../db/schema';
import { and, eq, gte, lte, desc, sql } from 'drizzle-orm';
import { ValidationUtils } from '../../utils/validation';
import { SecurityUtils } from '../../utils/security';

const logger = Logger.getInstance();

export async function getNotificationLogsHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const channel = url.searchParams.get('channel');
    const status = url.searchParams.get('status');
    const templateKey = url.searchParams.get('template_key');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 1000); // Max 1000 records
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Validate and sanitize inputs
    if (userId && userId.length > 100) {
      throw new Error('Invalid user_id');
    }
    
    if (channel && !['webhook', 'telegram', 'lark', 'slack'].includes(channel)) {
      throw new Error('Invalid channel type');
    }
    
    if (status && !['pending', 'sent', 'failed', 'retry'].includes(status)) {
      throw new Error('Invalid status');
    }

    // Build conditions array
    const conditions = [];

    if (userId) {
      const sanitizedUserId = SecurityUtils.sanitizeString(userId, { maxLength: 100 });
      conditions.push(eq(notificationLogs.user_id, sanitizedUserId));
    }

    if (channel) {
      conditions.push(eq(notificationLogs.channel_type, channel as any));
    }

    if (status) {
      conditions.push(eq(notificationLogs.status, status as any));
    }

    if (templateKey) {
      const sanitizedTemplateKey = SecurityUtils.sanitizeString(templateKey, { maxLength: 100 });
      conditions.push(eq(notificationLogs.template_key, sanitizedTemplateKey));
    }

    if (startDate) {
      const startDateObj = ValidationUtils.validateDateString(startDate);
      conditions.push(gte(notificationLogs.created_at, startDateObj.toISOString()));
    }

    if (endDate) {
      const endDateObj = ValidationUtils.validateDateString(endDate);
      conditions.push(lte(notificationLogs.created_at, endDateObj.toISOString()));
    }

    // Execute query using Drizzle ORM
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const db = getDb(env);
    
    const [logs, totalCount] = await Promise.all([
      db
        .select()
        .from(notificationLogs)
        .where(whereClause)
        .orderBy(desc(notificationLogs.created_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(notificationLogs)
        .where(whereClause)
        .then((res: { count: number }[]) => res[0]?.count || 0)
    ]);

    const response = {
      success: true,
      data: {
        logs,
        total: totalCount,
        limit,
        offset,
      },
    };

    logger.info('Retrieved notification logs', {
      count: logs.length,
      totalCount,
      filters: { userId, channel, status, templateKey, startDate, endDate },
    });

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Failed to retrieve notification logs', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve logs',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export async function getNotificationLogByIdHandler(
  _request: Request,
  env: Env,
  logId: string,
): Promise<Response> {
  try {
    // Validate log ID
    const logIdNum = ValidationUtils.validatePositiveInteger(logId, 'logId');

    // Use Drizzle ORM for the query
    const db = getDb(env);
    const result = await db
      .select()
      .from(notificationLogs)
      .where(eq(notificationLogs.id, logIdNum))
      .limit(1);

    if (!result || result.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Log not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result[0],
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    logger.error('Failed to retrieve notification log', error, { logId });

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve log',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
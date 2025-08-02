import { Env } from '../../types';
import { Logger } from '../../utils/logger';
import { getDb, taskExecutionRecords } from '../../db';
import { desc, sql } from 'drizzle-orm';

const logger = Logger.getInstance();

export async function getTaskExecutionRecordsHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    const db = getDb(env);
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(taskExecutionRecords);
    const total = countResult[0]?.count || 0;
    
    // Get records
    const records = await db
      .select()
      .from(taskExecutionRecords)
      .orderBy(desc(taskExecutionRecords.created_at))
      .limit(limit)
      .offset(offset);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          records,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    logger.error('Failed to get task execution records', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to retrieve task execution records',
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
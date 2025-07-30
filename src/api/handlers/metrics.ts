import { Env, MetricsData, NotificationChannel } from '../../types';
import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

export async function metricsHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const days = parseInt(url.searchParams.get('days') || '7', 10);

    let metrics: MetricsData;

    if (userId) {
      metrics = await getUserMetrics(userId, days, env);
    } else {
      metrics = await getSystemMetrics(days, env);
    }

    return new Response(JSON.stringify(metrics), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=60',
      },
    });
  } catch (error) {
    logger.error('Failed to get metrics', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to retrieve metrics',
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

async function getUserMetrics(
  userId: string,
  days: number,
  env: Env,
): Promise<MetricsData> {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  const stats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
      SUM(retry_count) as total_retries,
      channel_type
    FROM notification_logs
    WHERE user_id = ? AND created_at >= ?
    GROUP BY channel_type
  `).bind(userId, dateFrom.toISOString()).all<{
    total: number;
    sent: number;
    failed: number;
    total_retries: number;
    channel_type: NotificationChannel;
  }>();

  const channelBreakdown: Record<NotificationChannel, {
    sent: number;
    failed: number;
    retries: number;
  }> = {
    webhook: { sent: 0, failed: 0, retries: 0 },
    telegram: { sent: 0, failed: 0, retries: 0 },
    lark: { sent: 0, failed: 0, retries: 0 },
    slack: { sent: 0, failed: 0, retries: 0 },
  };

  let totalSent = 0;
  let totalFailed = 0;
  let totalRetries = 0;

  if (stats.results) {
    for (const row of stats.results) {
      channelBreakdown[row.channel_type] = {
        sent: row.sent,
        failed: row.failed,
        retries: row.total_retries || 0,
      };
      totalSent += row.sent;
      totalFailed += row.failed;
      totalRetries += row.total_retries || 0;
    }
  }

  const total = totalSent + totalFailed;
  const successRate = total > 0 ? (totalSent / total) * 100 : 0;

  const responseTimeStats = await env.DB.prepare(`
    SELECT AVG(
      CAST((julianday(sent_at) - julianday(created_at)) * 86400000 AS INTEGER)
    ) as avg_response_time
    FROM notification_logs
    WHERE user_id = ? AND status = 'sent' AND created_at >= ?
  `).bind(userId, dateFrom.toISOString()).first<{ avg_response_time: number }>();

  return {
    totalSent,
    totalFailed,
    totalRetries,
    successRate: Math.round(successRate * 100) / 100,
    avgResponseTime: responseTimeStats?.avg_response_time || 0,
    channelBreakdown,
  };
}

async function getSystemMetrics(
  days: number,
  env: Env,
): Promise<MetricsData> {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  const stats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
      SUM(retry_count) as total_retries,
      channel_type
    FROM notification_logs
    WHERE created_at >= ?
    GROUP BY channel_type
  `).bind(dateFrom.toISOString()).all<{
    total: number;
    sent: number;
    failed: number;
    total_retries: number;
    channel_type: NotificationChannel;
  }>();

  const channelBreakdown: Record<NotificationChannel, {
    sent: number;
    failed: number;
    retries: number;
  }> = {
    webhook: { sent: 0, failed: 0, retries: 0 },
    telegram: { sent: 0, failed: 0, retries: 0 },
    lark: { sent: 0, failed: 0, retries: 0 },
    slack: { sent: 0, failed: 0, retries: 0 },
  };

  let totalSent = 0;
  let totalFailed = 0;
  let totalRetries = 0;

  if (stats.results) {
    for (const row of stats.results) {
      channelBreakdown[row.channel_type] = {
        sent: row.sent,
        failed: row.failed,
        retries: row.total_retries || 0,
      };
      totalSent += row.sent;
      totalFailed += row.failed;
      totalRetries += row.total_retries || 0;
    }
  }

  const total = totalSent + totalFailed;
  const successRate = total > 0 ? (totalSent / total) * 100 : 0;

  const responseTimeStats = await env.DB.prepare(`
    SELECT AVG(
      CAST((julianday(sent_at) - julianday(created_at)) * 86400000 AS INTEGER)
    ) as avg_response_time
    FROM notification_logs
    WHERE status = 'sent' AND created_at >= ?
  `).bind(dateFrom.toISOString()).first<{ avg_response_time: number }>();

  return {
    totalSent,
    totalFailed,
    totalRetries,
    successRate: Math.round(successRate * 100) / 100,
    avgResponseTime: responseTimeStats?.avg_response_time || 0,
    channelBreakdown,
  };
}
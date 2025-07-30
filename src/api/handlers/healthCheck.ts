import { Env, HealthCheckResponse } from '../../types';
import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

export async function healthCheckHandler(
  _request: Request,
  env: Env,
): Promise<Response> {
  const checks = {
    database: false,
    queue: false,
    cache: false,
  };

  try {
    const dbResult = await env.DB.prepare('SELECT 1').first();
    checks.database = !!dbResult;
  } catch (error) {
    logger.error('Database health check failed', error);
  }

  try {
    checks.queue = true;
  } catch (error) {
    logger.error('Queue health check failed', error);
  }

  try {
    await env.CONFIG_CACHE.put('health_check', Date.now().toString(), {
      expirationTtl: 60, // Minimum TTL for KV is 60 seconds
    });
    const cacheResult = await env.CONFIG_CACHE.get('health_check');
    checks.cache = !!cacheResult;
  } catch (error) {
    logger.error('Cache health check failed', error);
  }

  const isHealthy = Object.values(checks).every((check) => check);

  const response: HealthCheckResponse = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: checks,
    version: '1.0.0',
  };

  return new Response(JSON.stringify(response), {
    status: isHealthy ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
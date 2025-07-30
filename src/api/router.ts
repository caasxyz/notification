import { Env } from '../types';
import { sendNotificationHandler } from './handlers/sendNotification';
import { healthCheckHandler } from './handlers/healthCheck';
import { metricsHandler } from './handlers/metrics';
import { scheduledTasksHealthHandler } from './handlers/scheduledTasksHealth';
import { getUserConfigsHandler, upsertUserConfigHandler, deleteUserConfigHandler } from './handlers/userConfig';
import { getNotificationLogsHandler } from './handlers/notificationLogs';
import { checkSchemaHandler, runMigrationHandler } from './handlers/migration';
import { CryptoUtils } from '../utils/crypto';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Signature, X-Timestamp',
  'Access-Control-Max-Age': '86400', // 24 hours
};

// Helper function to add CORS headers to response
function withCORS(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// 定义需要签名验证的路径
const PROTECTED_PATHS = [
  '/api/user-configs',
  '/api/templates',
  '/api/notification-logs',
  '/api/db/schema',
  '/api/db/migrate',
  '/api/notifications/send',
  '/api/notifications/retry',
  '/api/notification-logs/cleanup',
  '/api/queue/status',
  '/api/queue/clear-retries',
  '/api/queue/purge-test-data',
  '/api/queue/clear-messages',
  '/metrics',
];

// 定义公开访问的路径（不需要签名）
// 这些路径不在 PROTECTED_PATHS 中，因此不需要签名验证：
// - /health - 健康检查
// - /health/scheduled-tasks - 定时任务健康检查  
// - /test-ui - 测试界面（仅开发环境）
// - /api/webhooks/grafana - Grafana webhook (使用 Basic Auth)

function isProtectedPath(path: string): boolean {
  return PROTECTED_PATHS.some(protectedPath => path.startsWith(protectedPath));
}

export async function handleApiRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Handle preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    // 检查是否需要签名验证
    if (isProtectedPath(path)) {
      await verifyApiSignature(request, env);
    }
    if (path === '/health' && method === 'GET') {
      return withCORS(await healthCheckHandler(request, env));
    }

    if (path === '/metrics' && method === 'GET') {
      return withCORS(await metricsHandler(request, env));
    }

    if (path === '/health/scheduled-tasks' && method === 'GET') {
      return withCORS(await scheduledTasksHealthHandler(request, env));
    }

    // Test UI route (development only) - React version
    if (path === '/test-ui' && method === 'GET') {
      const { testUIReactHandler } = await import('./handlers/testUIReact');
      return await testUIReactHandler(request, env);
    }

    // User config management APIs (development only)
    if (path === '/api/user-configs' && method === 'GET') {
      return withCORS(await getUserConfigsHandler(request, env));
    }
    
    if (path === '/api/user-configs' && method === 'POST') {
      return withCORS(await upsertUserConfigHandler(request, env));
    }
    
    if (path === '/api/user-configs' && method === 'DELETE') {
      return withCORS(await deleteUserConfigHandler(request, env));
    }

    // Template management APIs (development only) - V2
    if (path === '/api/templates' && method === 'GET') {
      const { getTemplatesHandler: getTemplatesHandlerV2 } = await import('./handlers/templateManagementV2');
      return withCORS(await getTemplatesHandlerV2(request, env));
    }
    
    if (path === '/api/templates' && method === 'POST') {
      const { upsertTemplateHandler: upsertTemplateHandlerV2 } = await import('./handlers/templateManagementV2');
      return withCORS(await upsertTemplateHandlerV2(request, env));
    }
    
    if (path === '/api/templates' && method === 'DELETE') {
      const { deleteTemplateHandler: deleteTemplateHandlerV2 } = await import('./handlers/templateManagementV2');
      return withCORS(await deleteTemplateHandlerV2(request, env));
    }

    // Notification logs API
    if (path === '/api/notification-logs' && method === 'GET') {
      return withCORS(await getNotificationLogsHandler(request, env));
    }
    
    // Cleanup logs API (development only)
    if (path === '/api/notification-logs/cleanup' && method === 'DELETE') {
      const { cleanupLogsHandler } = await import('./handlers/cleanupLogs');
      return withCORS(await cleanupLogsHandler(request, env));
    }
    
    // Trigger retry API (development only)
    if (path === '/api/notifications/retry' && method === 'POST') {
      const { triggerRetryHandler } = await import('./handlers/triggerRetry');
      return withCORS(await triggerRetryHandler(request, env));
    }
    
    // Queue management endpoints
    if (path === '/api/queue/status' && method === 'GET') {
      const { getQueueStatusHandler } = await import('./handlers/queueManagement');
      return withCORS(await getQueueStatusHandler(request, env));
    }
    
    if (path === '/api/queue/clear-retries' && method === 'POST') {
      const { clearRetryTasksHandler } = await import('./handlers/queueManagement');
      return withCORS(await clearRetryTasksHandler(request, env));
    }
    
    if (path === '/api/queue/purge-test-data' && method === 'POST') {
      const { purgeTestDataHandler } = await import('./handlers/queueManagement');
      return withCORS(await purgeTestDataHandler(request, env));
    }
    
    if (path === '/api/queue/clear-messages' && method === 'POST') {
      const { clearQueueMessagesHandler } = await import('./handlers/queueManagement');
      return withCORS(await clearQueueMessagesHandler(request, env));
    }

    // Database migration endpoints
    if (path === '/api/db/schema' && method === 'GET') {
      return withCORS(await checkSchemaHandler(request, env));
    }
    
    if (path === '/api/db/migrate' && method === 'POST') {
      return withCORS(await runMigrationHandler(request, env));
    }

    if (path === '/api/notifications/send' && method === 'POST') {
      return withCORS(await sendNotificationHandler(request, env));
    }

    // Grafana webhook endpoint (uses Basic Auth instead of signature)
    if (path === '/api/webhooks/grafana' && method === 'POST') {
      const { handleGrafanaWebhook } = await import('./handlers/grafanaWebhook');
      return withCORS(await handleGrafanaWebhook(request, env));
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Not found',
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      },
    );
  } catch (error) {
    // If the error is already a Response, return it directly
    if (error instanceof Response) {
      return withCORS(error);
    }
    
    if (error instanceof Error && (error.message.includes('signature') || error.message.includes('expired'))) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        },
      );
    }

    // Re-throw the error to be handled by the global error handler
    throw error;
  }
}

async function verifyApiSignature(request: Request, env: Env): Promise<void> {
  const timestamp = request.headers.get('X-Timestamp');
  const signature = request.headers.get('X-Signature');

  logger.info('Received signature headers', {
    timestamp,
    timestampLength: timestamp?.length,
    signaturePrefix: signature?.substring(0, 10) + '...',
  });

  if (!timestamp || !signature) {
    throw new Error('Missing signature headers');
  }

  let payload: string;
  
  if (request.method === 'GET' || request.method === 'DELETE') {
    // 对于 GET 和 DELETE 请求，使用 URL（包含路径和查询参数）作为签名内容
    const url = new URL(request.url);
    const pathAndQuery = url.pathname + url.search;
    payload = timestamp + pathAndQuery;
    
    logger.info('GET/DELETE request signature payload', {
      method: request.method,
      path: url.pathname,
      query: url.search,
    });
  } else {
    // 对于 POST/PUT 请求，使用请求体
    const body = await request.clone().text();
    payload = timestamp + body;
  }

  const isValid = await CryptoUtils.verifySignature({
    timestamp,
    signature,
    body: payload,
    secretKey: env.API_SECRET_KEY,
  });

  if (!isValid) {
    // 添加更详细的调试信息
    const expectedSignature = await CryptoUtils.generateHMAC(payload, env.API_SECRET_KEY);
    logger.warn('Invalid signature', {
      timestamp,
      receivedSignature: signature,
      receivedLength: signature.length,
      expectedSignature: expectedSignature,
      expectedLength: expectedSignature.length,
      signaturesMatch: signature === expectedSignature,
      method: request.method,
      payload: payload,
      payloadLength: payload.length,
      secretKeyLength: env.API_SECRET_KEY.length,
    });
    throw new Error('Invalid signature');
  }
}
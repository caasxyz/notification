/**
 * Enhanced Secure Router with Security Hardening
 * Implements all security recommendations from audit
 */

import { Env } from '../types';
import { 
  SECURITY_HEADERS, 
  getCorsHeaders, 
  RateLimiter, 
  RATE_LIMIT_CONFIGS,
  checkRequestSize,
  createSecureErrorResponse,
  SecurityAuditLogger,
  checkUserAuthorization,
} from '../security/SecurityEnhancements';
import { CryptoUtils } from '../utils/crypto';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

// Enhanced protected paths with required permissions
const PROTECTED_ENDPOINTS = new Map<string, { authRequired: boolean; userCheck?: boolean }>([
  ['/api/user-configs', { authRequired: true, userCheck: true }],
  ['/api/templates', { authRequired: true, userCheck: false }],
  ['/api/notification-logs', { authRequired: true, userCheck: true }],
  ['/api/db/schema', { authRequired: true, userCheck: false }],
  ['/api/db/migrate', { authRequired: true, userCheck: false }],
  ['/api/notifications/send', { authRequired: true, userCheck: true }],
  ['/api/notifications/retry', { authRequired: true, userCheck: true }],
  ['/api/notification-logs/cleanup', { authRequired: true, userCheck: false }],
  ['/metrics', { authRequired: true, userCheck: false }],
]);

/**
 * Enhanced API Request Handler with Security Features
 */
export async function handleSecureApiRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const auditLogger = new SecurityAuditLogger(env);
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Add security headers to all responses
  const securityHeaders = {
    ...SECURITY_HEADERS,
    ...getCorsHeaders(env),
  };

  // Handle preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: securityHeaders,
    });
  }

  try {
    // 1. Check request size limit
    const sizeCheck = await checkRequestSize(request, 1048576); // 1MB limit
    if (!sizeCheck.valid) {
      return createSecureErrorResponse(
        new Error(sizeCheck.error || 'Request too large'),
        413,
      );
    }

    // 2. Global rate limiting
    const globalRateLimiter = new RateLimiter(env.RATE_LIMIT_KV, RATE_LIMIT_CONFIGS.global);
    const globalLimit = await globalRateLimiter.checkLimit(request);
    
    if (!globalLimit.allowed) {
      await auditLogger.logSecurityEvent({
        type: 'rate_limit',
        request,
        details: { limitType: 'global' },
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil((globalLimit.resetAt - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            ...securityHeaders,
            'Retry-After': String(Math.ceil((globalLimit.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(RATE_LIMIT_CONFIGS.global.maxRequests),
            'X-RateLimit-Remaining': String(globalLimit.remaining),
            'X-RateLimit-Reset': String(globalLimit.resetAt),
          },
        },
      );
    }

    // 3. Check if endpoint requires authentication
    const endpointConfig = getEndpointConfig(path);
    
    if (endpointConfig?.authRequired) {
      try {
        await verifyApiSignature(request, env);
      } catch (error) {
        // Track authentication failures
        const authFailureRateLimiter = new RateLimiter(
          env.RATE_LIMIT_KV, 
          RATE_LIMIT_CONFIGS.authFailure,
        );
        await authFailureRateLimiter.checkLimit(request);
        
        await auditLogger.logSecurityEvent({
          type: 'auth_failure',
          request,
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
        
        return createSecureErrorResponse(error, 401);
      }
    }

    // 4. Endpoint-specific rate limiting
    const endpointRateLimit = getEndpointRateLimit(path);
    if (endpointRateLimit) {
      const endpointLimiter = new RateLimiter(env.RATE_LIMIT_KV, endpointRateLimit);
      const endpointLimit = await endpointLimiter.checkLimit(request);
      
      if (!endpointLimit.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Endpoint rate limit exceeded',
            retryAfter: Math.ceil((endpointLimit.resetAt - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers: {
              ...securityHeaders,
              'Retry-After': String(Math.ceil((endpointLimit.resetAt - Date.now()) / 1000)),
            },
          },
        );
      }
    }

    // 5. User-level authorization if required
    if (endpointConfig?.userCheck) {
      const userIdFromPath = extractUserIdFromPath(path, url);
      const authResult = await checkUserAuthorization(request, env, userIdFromPath);
      
      if (!authResult.authorized) {
        await auditLogger.logSecurityEvent({
          type: 'unauthorized_access',
          request,
          userId: authResult.userId,
          details: { 
            requestedUserId: userIdFromPath,
            error: authResult.error,
          },
        });
        
        return createSecureErrorResponse(
          new Error(authResult.error || 'Unauthorized'),
          403,
        );
      }
    }

    // 6. Route to appropriate handler with enhanced security context
    const securityContext = {
      userId: await extractAuthenticatedUserId(request, env),
      requestId: crypto.randomUUID(),
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
    };

    // Import and call the appropriate handler
    const response = await routeToHandler(request, env, path, method, securityContext);
    
    // Add security headers to response
    const enhancedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers({
        ...Object.fromEntries(response.headers.entries()),
        ...securityHeaders,
      }),
    });

    return enhancedResponse;

  } catch (error) {
    logger.error('Unhandled error in secure router', error);
    
    await auditLogger.logSecurityEvent({
      type: 'suspicious_activity',
      request,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    
    return createSecureErrorResponse(error, 500);
  }
}

/**
 * Enhanced signature verification with better error handling
 */
async function verifyApiSignature(request: Request, env: Env): Promise<void> {
  const timestamp = request.headers.get('X-Timestamp');
  const signature = request.headers.get('X-Signature');

  if (!timestamp || !signature) {
    throw new Error('Missing signature headers');
  }

  // Validate timestamp format
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum) || timestampNum < 0) {
    throw new Error('Invalid timestamp format');
  }

  let payload: string;
  
  if (request.method === 'GET' || request.method === 'DELETE') {
    const url = new URL(request.url);
    const pathAndQuery = url.pathname + url.search;
    payload = timestamp + pathAndQuery;
  } else {
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
    throw new Error('Invalid signature');
  }
}

/**
 * Get endpoint configuration
 */
function getEndpointConfig(path: string): { authRequired: boolean; userCheck?: boolean } | undefined {
  for (const [endpoint, config] of PROTECTED_ENDPOINTS) {
    if (path.startsWith(endpoint)) {
      return config;
    }
  }
  return undefined;
}

/**
 * Get endpoint-specific rate limit config
 */
function getEndpointRateLimit(path: string) {
  if (path.startsWith('/api/notifications/send')) {
    return RATE_LIMIT_CONFIGS.sendNotification;
  }
  return null;
}

/**
 * Extract user ID from path for authorization
 */
function extractUserIdFromPath(path: string, url: URL): string | undefined {
  // Handle /api/users/:userId patterns
  const userMatch = path.match(/\/api\/users\/([^\/]+)/);
  if (userMatch) {
    return userMatch[1];
  }
  
  // Handle query parameter
  return url.searchParams.get('user_id') || undefined;
}

/**
 * Extract authenticated user ID from request
 */
async function extractAuthenticatedUserId(request: Request, env: Env): Promise<string | undefined> {
  // TODO: Implement based on your authentication method
  // This could be from JWT, session, etc.
  return undefined;
}

/**
 * Route to appropriate handler (implement based on your handlers)
 */
async function routeToHandler(
  request: Request,
  env: Env,
  path: string,
  method: string,
  securityContext: any,
): Promise<Response> {
  // Import the original router and enhance with security context
  const { handleApiRequest } = await import('./router');
  
  // Add security context to request
  const enhancedRequest = new Request(request, {
    headers: new Headers({
      ...Object.fromEntries(request.headers.entries()),
      'X-Security-Context': JSON.stringify(securityContext),
    }),
  });
  
  return handleApiRequest(enhancedRequest, env, {} as ExecutionContext);
}
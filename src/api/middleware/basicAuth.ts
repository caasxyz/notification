import { Env } from '../../types';
import { Logger } from '../../utils/logger';

/**
 * Basic Authentication Middleware
 * 
 * Validates HTTP Basic Authentication for webhook endpoints
 */

interface BasicAuthResult {
  valid: boolean;
  error?: string;
  username?: string;
}

/**
 * Validate Basic Authentication header
 */
export async function validateBasicAuth(
  request: Request,
  env: Env,
  options?: {
    usernameEnvKey?: string;
    passwordEnvKey?: string;
  }
): Promise<BasicAuthResult> {
  const logger = Logger.getInstance();
  
  try {
    // Get authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return {
        valid: false,
        error: 'Missing Authorization header'
      };
    }

    // Check if it's Basic auth
    if (!authHeader.startsWith('Basic ')) {
      return {
        valid: false,
        error: 'Invalid authorization type, expected Basic'
      };
    }

    // Extract and decode credentials
    const base64Credentials = authHeader.substring(6);
    let credentials: string;
    
    try {
      credentials = atob(base64Credentials);
    } catch {
      return {
        valid: false,
        error: 'Invalid base64 encoding in Authorization header'
      };
    }

    // Split username and password
    const colonIndex = credentials.indexOf(':');
    if (colonIndex === -1) {
      return {
        valid: false,
        error: 'Invalid credentials format'
      };
    }

    const username = credentials.substring(0, colonIndex);
    const password = credentials.substring(colonIndex + 1);

    // Get expected credentials from environment
    const usernameEnvKey = options?.usernameEnvKey || 'GRAFANA_WEBHOOK_USERNAME';
    const passwordEnvKey = options?.passwordEnvKey || 'GRAFANA_WEBHOOK_PASSWORD';
    
    const expectedUsername = env[usernameEnvKey as keyof Env] as string;
    const expectedPassword = env[passwordEnvKey as keyof Env] as string;

    if (!expectedUsername || !expectedPassword) {
      logger.error('Basic auth credentials not configured', {
        usernameEnvKey,
        passwordEnvKey
      });
      return {
        valid: false,
        error: 'Server authentication not configured'
      };
    }

    // Validate credentials
    if (username !== expectedUsername || password !== expectedPassword) {
      logger.warn('Basic auth failed', {
        ip: request.headers.get('CF-Connecting-IP') || 'unknown'
      });
      return {
        valid: false,
        error: 'Invalid username or password'
      };
    }

    // Success
    logger.debug('Basic auth successful', { username });
    return {
      valid: true,
      username
    };
  } catch (error) {
    logger.error('Error in basic auth validation', error);
    return {
      valid: false,
      error: 'Authentication validation error'
    };
  }
}

/**
 * Basic Auth middleware for use in routers
 */
export function basicAuthMiddleware(
  options?: {
    usernameEnvKey?: string;
    passwordEnvKey?: string;
  }
) {
  return async (request: Request, env: Env): Promise<Response | null> => {
    const result = await validateBasicAuth(request, env, options);
    
    if (!result.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || 'Unauthorized'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Basic realm="Webhook Access"'
          }
        }
      );
    }
    
    // Authentication passed, continue to handler
    return null;
  };
}
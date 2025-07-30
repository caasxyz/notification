/**
 * Security Enhancements for Notification System
 * Implements recommendations from security audit
 */

import { Env } from '../types';

/**
 * Security Headers Configuration
 */
export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

/**
 * CORS Configuration based on environment
 */
export function getCorsHeaders(env: Env): Record<string, string> {
  const allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',') : ['https://app.example.com'];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigins[0], // TODO: Implement origin checking
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Signature, X-Timestamp, Authorization',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Rate Limiting Configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (request: Request) => string;
}

export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Global rate limit
  global: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyGenerator: (request) => {
      // Use IP address as key
      return request.headers.get('CF-Connecting-IP') || 'unknown';
    },
  },
  
  // Auth failure rate limit
  authFailure: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyGenerator: (request) => {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      return `auth_failure:${ip}`;
    },
  },
  
  // Per-user rate limit
  perUser: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyGenerator: (request) => {
      // Extract user ID from request (implement based on your auth)
      const userId = 'extracted_user_id'; // TODO: Extract from JWT/session
      return `user:${userId}`;
    },
  },
  
  // API endpoint specific limits
  sendNotification: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyGenerator: (request) => {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      return `send_notification:${ip}`;
    },
  },
};

/**
 * Rate Limiter Implementation using Cloudflare KV
 */
export class RateLimiter {
  constructor(
    private kv: KVNamespace,
    private config: RateLimitConfig,
  ) {}

  async checkLimit(request: Request): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const key = this.config.keyGenerator(request);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Get current count from KV
    const storedData = await this.kv.get(key, 'json') as { count: number; resetAt: number } | null;
    
    if (!storedData || storedData.resetAt < now) {
      // New window
      const resetAt = now + this.config.windowMs;
      await this.kv.put(key, JSON.stringify({ count: 1, resetAt }), {
        expirationTtl: Math.ceil(this.config.windowMs / 1000),
      });
      
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt,
      };
    }
    
    // Check if limit exceeded
    if (storedData.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: storedData.resetAt,
      };
    }
    
    // Increment counter
    storedData.count += 1;
    await this.kv.put(key, JSON.stringify(storedData), {
      expirationTtl: Math.ceil((storedData.resetAt - now) / 1000),
    });
    
    return {
      allowed: true,
      remaining: this.config.maxRequests - storedData.count,
      resetAt: storedData.resetAt,
    };
  }
}

/**
 * SSRF Protection - Block internal and private IP ranges
 */
export function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    
    // Check for localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }
    
    // Check for private IP ranges (RFC 1918)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(hostname)) {
      const parts = hostname.split('.').map(Number);
      
      // 10.0.0.0/8
      if (parts[0] === 10) return true;
      
      // 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      
      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return true;
      
      // 169.254.0.0/16 (link-local)
      if (parts[0] === 169 && parts[1] === 254) return true;
    }
    
    // Check for internal Cloudflare domains
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) {
      return true;
    }
    
    return false;
  } catch {
    // Invalid URL
    return true;
  }
}

/**
 * Enhanced Webhook Signature for Outgoing Requests
 */
export async function generateWebhookSignature(
  payload: string,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256',
): Promise<{ signature: string; timestamp: string }> {
  const timestamp = Date.now().toString();
  const signatureBase = `${timestamp}.${payload}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: algorithm.toUpperCase() },
    false,
    ['sign'],
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureBase));
  const hexSignature = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  
  return {
    signature: `v1=${hexSignature}`,
    timestamp,
  };
}

/**
 * User-Level Authorization Middleware
 */
export async function checkUserAuthorization(
  request: Request,
  env: Env,
  requiredUserId?: string,
): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  // Extract user ID from JWT/session (implement based on your auth)
  // This is a placeholder implementation
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return { authorized: false, error: 'Missing authorization header' };
  }
  
  // TODO: Implement JWT validation or session lookup
  // For now, this is a placeholder
  const userId = 'extracted_user_id';
  
  // If a specific user ID is required, check it matches
  if (requiredUserId && userId !== requiredUserId) {
    return { authorized: false, error: 'Unauthorized access to user data' };
  }
  
  return { authorized: true, userId };
}

/**
 * Enhanced Error Response - Sanitize error messages
 */
export function createSecureErrorResponse(
  error: unknown,
  statusCode: number = 500,
): Response {
  // Map of error codes to safe messages
  const safeErrorMessages: Record<string, string> = {
    'INVALID_REQUEST': 'Invalid request format',
    'UNAUTHORIZED': 'Authentication required',
    'FORBIDDEN': 'Access denied',
    'NOT_FOUND': 'Resource not found',
    'RATE_LIMITED': 'Too many requests',
    'SERVER_ERROR': 'Internal server error',
  };
  
  let safeMessage = 'An error occurred';
  let errorCode = 'SERVER_ERROR';
  
  if (error instanceof Error) {
    // Check if it's a known error code
    if ('code' in error && typeof error.code === 'string') {
      errorCode = error.code;
      safeMessage = safeErrorMessages[error.code] || safeMessage;
    } else {
      // Log the actual error for debugging but don't expose it
      console.error('Error details:', error);
    }
  }
  
  return new Response(
    JSON.stringify({
      success: false,
      error: safeMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
    }),
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS,
      },
    },
  );
}

/**
 * Request Size Limiter Middleware
 */
export async function checkRequestSize(
  request: Request,
  maxSizeBytes: number = 1048576, // 1MB default
): Promise<{ valid: boolean; error?: string }> {
  const contentLength = request.headers.get('Content-Length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSizeBytes) {
      return {
        valid: false,
        error: `Request body too large. Maximum size: ${maxSizeBytes} bytes`,
      };
    }
  }
  
  // For chunked encoding or missing Content-Length, we need to read the body
  try {
    const body = await request.clone().arrayBuffer();
    if (body.byteLength > maxSizeBytes) {
      return {
        valid: false,
        error: `Request body too large. Maximum size: ${maxSizeBytes} bytes`,
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Failed to read request body',
    };
  }
  
  return { valid: true };
}

/**
 * PII Masking for Logs
 */
export function maskPII(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sensitiveFields = [
    'email',
    'phone',
    'ssn',
    'credit_card',
    'password',
    'token',
    'api_key',
    'secret',
    'bot_token',
    'webhook_url',
    'ip_address',
  ];
  
  const masked = { ...data };
  
  for (const key in masked) {
    const lowerKey = key.toLowerCase();
    
    // Check if field name suggests sensitive data
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      if (typeof masked[key] === 'string') {
        // Keep first and last 2 characters for debugging
        const value = masked[key] as string;
        if (value.length > 4) {
          masked[key] = value.substring(0, 2) + '***' + value.substring(value.length - 2);
        } else {
          masked[key] = '***';
        }
      }
    }
    
    // Recursively mask nested objects
    if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskPII(masked[key]);
    }
  }
  
  return masked;
}

/**
 * Audit Logger for Security Events
 */
export class SecurityAuditLogger {
  constructor(private env: Env) {}
  
  async logSecurityEvent(event: {
    type: 'auth_failure' | 'rate_limit' | 'unauthorized_access' | 'suspicious_activity';
    userId?: string;
    ip?: string;
    details?: any;
    request?: Request;
  }): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: event.type,
      userId: event.userId,
      ip: event.ip || event.request?.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: event.request?.headers.get('User-Agent'),
      url: event.request?.url,
      method: event.request?.method,
      details: maskPII(event.details),
    };
    
    // Log to console for now
    console.warn('SECURITY_EVENT:', logEntry);
    
    // TODO: Send to security monitoring service
    // await this.sendToSecurityMonitoring(logEntry);
  }
}
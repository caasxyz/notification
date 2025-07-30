import crypto from 'crypto';

/**
 * Create HMAC-SHA256 signature for webhook validation
 */
export function createHmacSignature(
  timestamp: string,
  nonce: string,
  body: string,
  secret: string
): string {
  const message = `${timestamp}\n${nonce}\n${body}`;
  return crypto
    .createHmac('sha256', secret)
    .update(message, 'utf8')
    .digest('base64');
}

/**
 * Verify HMAC-SHA256 signature from webhook
 */
export function verifyHmacSignature(
  signature: string,
  timestamp: string,
  nonce: string,
  body: string,
  secret: string,
  maxAgeSeconds = 300
): boolean {
  // Check timestamp to prevent replay attacks
  const currentTime = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp, 10);
  
  if (isNaN(requestTime) || currentTime - requestTime > maxAgeSeconds) {
    return false;
  }

  // Calculate expected signature
  const expectedSignature = createHmacSignature(timestamp, nonce, body, secret);
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
/**
 * Create HMAC signature for API requests
 */
export async function createHmacSignature(
  secret: string,
  timestamp: string,
  body: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${timestamp}.${body}`);
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, data);
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify HMAC signature for webhooks
 */
export async function verifyHmacSignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string
): Promise<boolean> {
  const expectedSignature = await createHmacSignature(secret, timestamp, body);
  return signature === expectedSignature;
}

/**
 * Verify webhook signature with timing attack protection
 */
export async function verifyWebhookSignature(
  secret: string,
  headers: Headers,
  body: string,
  options?: {
    timestampHeader?: string;
    signatureHeader?: string;
    maxAge?: number;
  }
): Promise<boolean> {
  const timestampHeader = options?.timestampHeader ?? 'X-Webhook-Timestamp';
  const signatureHeader = options?.signatureHeader ?? 'X-Webhook-Signature';
  const maxAge = options?.maxAge ?? 300000; // 5 minutes

  const timestamp = headers.get(timestampHeader);
  const signature = headers.get(signatureHeader);

  if (timestamp === null || signature === null) {
    return false;
  }

  // Check timestamp is not too old
  const timestampMs = parseInt(timestamp);
  if (isNaN(timestampMs) || Date.now() - timestampMs > maxAge) {
    return false;
  }

  return verifyHmacSignature(secret, timestamp, body, signature);
}
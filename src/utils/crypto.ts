import { NotificationSystemError, SignatureVerificationOptions } from '../types';

export class CryptoUtils {
  static generateMessageId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${randomPart}`;
  }
  static async generateHMAC(payload: string, secretKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  static async verifySignature(options: SignatureVerificationOptions): Promise<boolean> {
    const { timestamp, signature, body, secretKey } = options;

    if (!timestamp || !signature) {
      throw new NotificationSystemError('Missing signature headers', 'MISSING_SIGNATURE', false);
    }

    const timestampNum = parseInt(timestamp, 10);
    if (isNaN(timestampNum)) {
      throw new NotificationSystemError('Invalid timestamp', 'INVALID_TIMESTAMP', false);
    }

    const now = Date.now();
    const fiveMinutesInMs = 5 * 60 * 1000;
    const timeDiff = Math.abs(now - timestampNum);
    
    if (timeDiff > fiveMinutesInMs) {
      console.error('Timestamp verification failed:', {
        clientTimestamp: timestampNum,
        serverTimestamp: now,
        difference: timeDiff,
        differenceInSeconds: Math.round(timeDiff / 1000),
        clientTime: new Date(timestampNum).toISOString(),
        serverTime: new Date(now).toISOString(),
      });
      throw new NotificationSystemError('Request expired', 'REQUEST_EXPIRED', false);
    }

    // body 参数已经包含了完整的 payload（对于 POST 是 timestamp + requestBody，对于 GET 是 timestamp + pathAndQuery）
    const expectedSignature = await this.generateHMAC(body, secretKey);

    return signature === expectedSignature;
  }

  static async encrypt(text: string, encryptKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['encrypt'],
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data,
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  static async decrypt(encryptedText: string, encryptKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const combined = new Uint8Array(
      atob(encryptedText)
        .split('')
        .map((char) => char.charCodeAt(0)),
    );

    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted,
    );

    return decoder.decode(decrypted);
  }

  static generateUUID(): string {
    return crypto.randomUUID();
  }

  static async generateHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}

// Export standalone functions for compatibility
export const encrypt = CryptoUtils.encrypt;
export const decrypt = CryptoUtils.decrypt;
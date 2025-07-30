/**
 * Enhanced Cryptography Utilities
 * Implements security audit recommendations
 */

import { NotificationSystemError } from '../types';

export class EnhancedCryptoUtils {
  /**
   * Derive encryption key using PBKDF2
   * Replaces the weak padding-based key derivation
   */
  static async deriveKey(
    password: string,
    salt: string,
    iterations: number = 100000,
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey'],
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  /**
   * Enhanced encryption with proper key derivation
   */
  static async encryptEnhanced(
    text: string,
    password: string,
    saltInput?: string,
  ): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // Generate or use provided salt
    const salt = saltInput || crypto.randomUUID();
    
    // Derive key using PBKDF2
    const key = await this.deriveKey(password, salt);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data,
    );

    // Combine salt, iv, and encrypted data
    const combined = new Uint8Array(
      36 + // Salt UUID length
      12 + // IV length
      encrypted.byteLength,
    );
    
    // Write salt (36 bytes for UUID)
    const saltBytes = encoder.encode(salt);
    combined.set(saltBytes, 0);
    
    // Write IV
    combined.set(iv, 36);
    
    // Write encrypted data
    combined.set(new Uint8Array(encrypted), 48);

    // Return base64 encoded
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Enhanced decryption with proper key derivation
   */
  static async decryptEnhanced(
    encryptedText: string,
    password: string,
  ): Promise<string> {
    const decoder = new TextDecoder();

    // Decode from base64
    const combined = new Uint8Array(
      atob(encryptedText)
        .split('')
        .map((char) => char.charCodeAt(0)),
    );

    // Extract salt (36 bytes)
    const salt = decoder.decode(combined.slice(0, 36));
    
    // Extract IV (12 bytes)
    const iv = combined.slice(36, 48);
    
    // Extract encrypted data
    const encrypted = combined.slice(48);

    // Derive key using PBKDF2
    const key = await this.deriveKey(password, salt);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted,
    );

    return decoder.decode(decrypted);
  }

  /**
   * Generate time-based rotating keys
   * Useful for temporary access tokens
   */
  static async generateTimeBasedKey(
    secret: string,
    windowMinutes: number = 5,
  ): Promise<string> {
    const now = Date.now();
    const window = Math.floor(now / (windowMinutes * 60 * 1000));
    const data = `${secret}:${window}`;
    
    const hash = await this.generateHash(data);
    return hash.substring(0, 32);
  }

  /**
   * Verify time-based key with grace period
   */
  static async verifyTimeBasedKey(
    key: string,
    secret: string,
    windowMinutes: number = 5,
    gracePeriods: number = 1,
  ): Promise<boolean> {
    const now = Date.now();
    const currentWindow = Math.floor(now / (windowMinutes * 60 * 1000));
    
    // Check current and previous windows
    for (let i = 0; i <= gracePeriods; i++) {
      const window = currentWindow - i;
      const expectedKey = await this.generateTimeBasedKey(secret, windowMinutes);
      
      if (key === expectedKey) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Enhanced HMAC with versioning support
   */
  static async generateVersionedHMAC(
    payload: string,
    secretKey: string,
    version: string = 'v1',
  ): Promise<string> {
    const signature = await this.generateHMAC(payload, secretKey);
    return `${version}:${signature}`;
  }

  /**
   * Verify versioned HMAC
   */
  static async verifyVersionedHMAC(
    payload: string,
    signature: string,
    secretKey: string,
    supportedVersions: string[] = ['v1'],
  ): Promise<{ valid: boolean; version?: string }> {
    const parts = signature.split(':');
    if (parts.length !== 2) {
      return { valid: false };
    }
    
    const [version, sig] = parts;
    
    if (!supportedVersions.includes(version)) {
      return { valid: false };
    }
    
    const expectedSig = await this.generateHMAC(payload, secretKey);
    
    // Constant-time comparison
    const valid = this.constantTimeCompare(sig, expectedSig);
    
    return { valid, version: valid ? version : undefined };
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  /**
   * Generate cryptographically secure random token
   */
  static generateSecureToken(length: number = 32): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Key rotation helper
   */
  static async rotateKey(
    currentKey: string,
    newKey: string,
    data: string,
  ): Promise<string> {
    // Decrypt with current key
    const decrypted = await this.decryptEnhanced(data, currentKey);
    
    // Encrypt with new key
    return this.encryptEnhanced(decrypted, newKey);
  }

  // Re-export existing methods from CryptoUtils for compatibility
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
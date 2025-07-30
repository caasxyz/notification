import { NotificationConfig } from '../types';
import { BaseAdapter } from './BaseAdapter';
import { ValidationUtils } from '../utils/validation';
import { SecurityUtils } from '../utils/security';

interface LarkResponse {
  code: number;
  msg: string;
  data?: unknown;
}

export class LarkAdapter extends BaseAdapter {
  constructor(private defaultConfig?: { apiUrl?: string; timeout?: number }) {
    super();
  }

  async send(config: NotificationConfig, content: string, subject?: string): Promise<unknown> {
    try {
      const validatedConfig = ValidationUtils.validateNotificationConfig(config, 'lark');
      
      // Use default apiUrl if webhook_url is not provided
      const webhookUrl = validatedConfig.webhook_url || this.defaultConfig?.apiUrl;
      
      if (!webhookUrl) {
        throw new Error('Webhook URL is required');
      }

      // Sanitize content and subject
      const sanitizedContent = SecurityUtils.sanitizeString(content, {
        maxLength: 10000,
        removeControlChars: true,
      });
      const sanitizedSubject = subject ? SecurityUtils.sanitizeString(subject, {
        maxLength: 200,
        removeControlChars: true,
      }) : undefined;

      const payload = this.buildPayload(sanitizedContent, validatedConfig, sanitizedSubject);
      
      // Generate signature if secret is provided
      const secret = (config as any).secret;
      if (secret && typeof secret === 'string') {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = await this.generateLarkSignature(timestamp, secret);
        
        // Add timestamp and signature to payload for Lark verification
        Object.assign(payload, {
          timestamp,
          sign: signature,
        });
        
        this.logger.info('Lark signature generated', {
          timestamp,
          timestamp_ms: Date.now(),
          secret_length: secret.length,
          signature_preview: signature.substring(0, 10) + '...',
          webhook_url: webhookUrl,
        });
      } else {
        this.logger.info('No secret configured for Lark webhook', {
          webhook_url: webhookUrl,
          config_keys: Object.keys(config),
        });
      }

      this.logger.debug('Sending Lark notification', {
        url: webhookUrl,
        messageType: payload['msg_type'],
        hasSignature: !!validatedConfig['secret'],
      });

      const response = await this.fetchWithTimeout(
        webhookUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      const responseData = await response.json() as LarkResponse;

      if (responseData.code !== 0) {
        throw new Error(`Lark API error: ${responseData.msg}`);
      }

      this.logger.info('Lark notification sent successfully', {
        url: webhookUrl,
      });

      return responseData.data || { success: true };
    } catch (error) {
      return this.handleError(error, 'lark');
    }
  }

  private buildPayload(
    content: string,
    config: NotificationConfig,
    subject?: string,
  ): Record<string, unknown> {
    const msgType = config['msg_type'] || 'text';

    switch (msgType) {
      case 'text':
        return {
          msg_type: 'text',
          content: {
            text: subject ? `${subject}\n\n${content}` : content,
          },
        };

      case 'interactive':
        return {
          msg_type: 'interactive',
          card: {
            header: subject ? {
              title: {
                tag: 'plain_text',
                content: subject,
              },
            } : undefined,
            elements: [{
              tag: 'div',
              text: {
                tag: 'plain_text',
                content: content,
              },
            }],
          },
        };

      case 'markdown':
        // Escape markdown special characters for Lark
        const escapedContent = SecurityUtils.escapeLarkMarkdown(content);
        const escapedSubject = subject ? SecurityUtils.escapeLarkMarkdown(subject) : undefined;
        const markdownContent = escapedSubject ? `**${escapedSubject}**\n\n${escapedContent}` : escapedContent;
        return {
          msg_type: 'interactive',
          card: {
            elements: [{
              tag: 'markdown',
              content: markdownContent,
            }],
          },
        };

      default:
        return {
          msg_type: 'text',
          content: {
            text: subject ? `${subject}\n\n${content}` : content,
          },
        };
    }
  }
  
  private async generateLarkSignature(timestamp: string, secret: string): Promise<string> {
    // Special Lark signature implementation:
    // 1. Concatenate timestamp + "\n" + secret
    // 2. Use the concatenated string as HMAC key with empty message
    // 3. Encode result as Base64
    
    const stringToSign = `${timestamp}\n${secret}`;
    const encoder = new TextEncoder();
    
    // Create HMAC key from stringToSign (not secret!)
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(stringToSign),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign empty string
    const signature = await crypto.subtle.sign(
      'HMAC', 
      key, 
      new Uint8Array(0)  // Empty message
    );
    
    // Convert to base64
    // Using btoa with Uint8Array to base64 conversion
    const bytes = new Uint8Array(signature);
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    
    return btoa(binary);
  }
}
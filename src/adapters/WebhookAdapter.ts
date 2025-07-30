import { NotificationConfig } from '../types';
import { BaseAdapter } from './BaseAdapter';
import { ValidationUtils } from '../utils/validation';
import { SecurityUtils } from '../utils/security';

export class WebhookAdapter extends BaseAdapter {
  async send(config: NotificationConfig, content: string, subject?: string): Promise<unknown> {
    try {
      const validatedConfig = ValidationUtils.validateNotificationConfig(config, 'webhook');
      
      if (!validatedConfig.webhook_url) {
        throw new Error('Webhook URL is required');
      }

      // Sanitize content and subject
      const sanitizedContent = SecurityUtils.sanitizeString(content, {
        maxLength: 100000, // 100KB limit for webhook payload
        removeControlChars: true,
      });
      const sanitizedSubject = subject ? SecurityUtils.sanitizeString(subject, {
        maxLength: 1000,
        removeControlChars: true,
      }) : undefined;

      // Validate UTF-8 encoding
      if (!SecurityUtils.isValidUtf8(sanitizedContent)) {
        throw new Error('Invalid UTF-8 encoding in content');
      }

      const payload = {
        content: sanitizedContent,
        subject: sanitizedSubject,
        timestamp: new Date().toISOString(),
        metadata: {
          channel: 'webhook',
          version: '1.0',
        },
      };

      // Sanitize custom headers
      const sanitizedHeaders = SecurityUtils.sanitizeHeaders(
        validatedConfig['headers'] as Record<string, string> | undefined
      );

      this.logger.debug('Sending webhook notification', {
        url: validatedConfig.webhook_url,
        payloadSize: JSON.stringify(payload).length,
      });

      const response = await this.fetchWithTimeout(
        validatedConfig.webhook_url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Notification-System/1.0',
            ...sanitizedHeaders,
          },
          body: JSON.stringify(payload),
        },
      );

      const responseData = await response.json().catch(() => ({}));

      this.logger.info('Webhook notification sent successfully', {
        url: validatedConfig.webhook_url,
        statusCode: response.status,
      });

      return responseData;
    } catch (error) {
      return this.handleError(error, 'webhook');
    }
  }
}
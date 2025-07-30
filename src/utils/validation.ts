import {
  SendNotificationRequest,
  NotificationChannel,
  NotificationConfig,
  NotificationSystemError,
} from '../types';
import { SecurityUtils } from './security';

export class ValidationUtils {
  static validateSendNotificationRequest(request: unknown): SendNotificationRequest {
    if (!request || typeof request !== 'object') {
      throw new NotificationSystemError('Invalid request body', 'INVALID_REQUEST', false);
    }

    const req = request as Record<string, unknown>;

    if (!req['user_id'] || typeof req['user_id'] !== 'string') {
      throw new NotificationSystemError('user_id is required and must be a string', 'INVALID_USER_ID', false);
    }

    // Sanitize and validate user_id
    const userId = SecurityUtils.sanitizeString(req['user_id'] as string, {
      maxLength: 100,
      removeControlChars: true,
    });

    if (!userId) {
      throw new NotificationSystemError('user_id cannot be empty after sanitization', 'INVALID_USER_ID', false);
    }

    if (!Array.isArray(req['channels']) || req['channels'].length === 0) {
      throw new NotificationSystemError('channels is required and must be a non-empty array', 'INVALID_CHANNELS', false);
    }

    const validChannels: NotificationChannel[] = ['webhook', 'telegram', 'lark', 'slack'];
    for (const channel of req['channels'] as unknown[]) {
      if (!validChannels.includes(channel as NotificationChannel)) {
        throw new NotificationSystemError(
          `Invalid channel: ${String(channel)}. Valid channels are: ${validChannels.join(', ')}`,
          'INVALID_CHANNEL_TYPE',
          false,
        );
      }
    }

    if (req['template_key'] !== undefined && typeof req['template_key'] !== 'string') {
      throw new NotificationSystemError('template_key must be a string', 'INVALID_TEMPLATE_KEY', false);
    }

    if (req['variables'] !== undefined && (typeof req['variables'] !== 'object' || req['variables'] === null)) {
      throw new NotificationSystemError('variables must be an object', 'INVALID_VARIABLES', false);
    }

    if (req['custom_content'] !== undefined) {
      if (typeof req['custom_content'] !== 'object' || req['custom_content'] === null) {
        throw new NotificationSystemError('custom_content must be an object', 'INVALID_CUSTOM_CONTENT', false);
      }
      const customContent = req['custom_content'] as Record<string, unknown>;
      if (!customContent['content'] || typeof customContent['content'] !== 'string') {
        throw new NotificationSystemError('custom_content.content is required and must be a string', 'INVALID_CONTENT', false);
      }
      if (customContent['subject'] !== undefined && typeof customContent['subject'] !== 'string') {
        throw new NotificationSystemError('custom_content.subject must be a string', 'INVALID_SUBJECT', false);
      }

      // Validate content and subject
      const content = customContent['content'] as string;
      const subject = customContent['subject'] as string | undefined;

      // Check for potential threats
      const contentThreats = SecurityUtils.detectThreats(content);
      if (contentThreats.length > 0) {
        throw new NotificationSystemError(
          `Content contains potential security threats: ${contentThreats.join(', ')}`,
          'SECURITY_THREAT_DETECTED',
          false
        );
      }

      if (subject) {
        const subjectThreats = SecurityUtils.detectThreats(subject);
        if (subjectThreats.length > 0) {
          throw new NotificationSystemError(
            `Subject contains potential security threats: ${subjectThreats.join(', ')}`,
            'SECURITY_THREAT_DETECTED',
            false
          );
        }
      }
    }

    if (!req['template_key'] && !req['custom_content']) {
      throw new NotificationSystemError(
        'Either template_key or custom_content must be provided',
        'MISSING_CONTENT',
        false,
      );
    }

    if (req['idempotency_key'] !== undefined && typeof req['idempotency_key'] !== 'string') {
      throw new NotificationSystemError('idempotency_key must be a string', 'INVALID_IDEMPOTENCY_KEY', false);
    }

    const result: SendNotificationRequest = {
      user_id: userId,
      channels: req['channels'] as NotificationChannel[],
    };
    
    if (req['template_key'] !== undefined) {
      result.template_key = req['template_key'] as string;
    }
    if (req['variables'] !== undefined) {
      result.variables = req['variables'] as Record<string, unknown>;
    }
    if (req['custom_content'] !== undefined) {
      result.custom_content = req['custom_content'] as { subject?: string; content: string };
    }
    if (req['idempotency_key'] !== undefined) {
      result.idempotency_key = req['idempotency_key'] as string;
    }
    
    return result;
  }

  static validateNotificationConfig(
    config: unknown,
    channelType: NotificationChannel,
  ): NotificationConfig {
    if (!config || typeof config !== 'object') {
      throw new NotificationSystemError('Invalid configuration', 'INVALID_CONFIG', false);
    }

    const cfg = config as NotificationConfig;

    switch (channelType) {
      case 'webhook':
        if (!cfg.webhook_url || typeof cfg.webhook_url !== 'string') {
          throw new NotificationSystemError(
            'webhook_url is required for webhook channel',
            'MISSING_WEBHOOK_URL',
            false,
          );
        }
        if (!this.isValidUrl(cfg.webhook_url)) {
          throw new NotificationSystemError('Invalid webhook URL', 'INVALID_WEBHOOK_URL', false);
        }
        break;

      case 'telegram':
        if (!cfg.bot_token || typeof cfg.bot_token !== 'string') {
          throw new NotificationSystemError(
            'bot_token is required for telegram channel',
            'MISSING_BOT_TOKEN',
            false,
          );
        }
        if (!cfg.chat_id || (typeof cfg.chat_id !== 'string' && typeof cfg.chat_id !== 'number')) {
          throw new NotificationSystemError(
            'chat_id is required for telegram channel',
            'MISSING_CHAT_ID',
            false,
          );
        }
        break;

      case 'lark':
        if (!cfg.webhook_url || typeof cfg.webhook_url !== 'string') {
          throw new NotificationSystemError(
            'webhook_url is required for lark channel',
            'MISSING_WEBHOOK_URL',
            false,
          );
        }
        if (!this.isValidUrl(cfg.webhook_url)) {
          throw new NotificationSystemError('Invalid lark webhook URL', 'INVALID_WEBHOOK_URL', false);
        }
        break;

      case 'slack':
        if (!cfg.webhook_url || typeof cfg.webhook_url !== 'string') {
          throw new NotificationSystemError(
            'webhook_url is required for slack channel',
            'MISSING_WEBHOOK_URL',
            false,
          );
        }
        if (!this.isValidUrl(cfg.webhook_url)) {
          throw new NotificationSystemError('Invalid slack webhook URL', 'INVALID_WEBHOOK_URL', false);
        }
        break;

      default:
        throw new NotificationSystemError(
          `Unsupported channel type: ${channelType}`,
          'UNSUPPORTED_CHANNEL',
          false,
        );
    }

    return cfg;
  }

  static isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  static sanitizeString(input: string, maxLength: number = 1000): string {
    // Use SecurityUtils for consistent sanitization
    return SecurityUtils.sanitizeString(input, {
      maxLength,
      trim: true,
      removeControlChars: true,
    });
  }

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static parseJsonSafe<T = unknown>(json: string): T | null {
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  }

  static validatePositiveInteger(value: unknown, fieldName: string): number {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) {
      throw new NotificationSystemError(
        `${fieldName} must be a positive integer`,
        'INVALID_NUMBER',
        false,
      );
    }
    return num;
  }

  static validateDateString(dateStr: string): Date {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new NotificationSystemError('Invalid date string', 'INVALID_DATE', false);
    }
    return date;
  }

  static validateTemplateKey(templateKey: string): void {
    if (!templateKey || typeof templateKey !== 'string') {
      throw new NotificationSystemError('Template key is required and must be a string', 'INVALID_TEMPLATE_KEY', false);
    }
    if (templateKey.length > 100) {
      throw new NotificationSystemError('Template key must not exceed 100 characters', 'INVALID_TEMPLATE_KEY', false);
    }
    // Allow alphanumeric, hyphens, underscores, and dots
    if (!/^[a-zA-Z0-9_.-]+$/.test(templateKey)) {
      throw new NotificationSystemError('Template key must contain only alphanumeric characters, hyphens, underscores, and dots', 'INVALID_TEMPLATE_KEY', false);
    }
  }

  static validateChannel(channel: string): void {
    const validChannels: NotificationChannel[] = ['webhook', 'telegram', 'lark', 'slack'];
    if (!validChannels.includes(channel as NotificationChannel)) {
      throw new NotificationSystemError(
        `Invalid channel: ${channel}. Valid channels are: ${validChannels.join(', ')}`,
        'INVALID_CHANNEL_TYPE',
        false,
      );
    }
  }

  static isValidVariableName(name: string): boolean {
    // Variable names should be alphanumeric with underscores, not starting with a number
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }
}
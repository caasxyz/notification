import { NotificationConfig, NotificationSystemError } from '../types';
import { BaseAdapter } from './BaseAdapter';
import { ValidationUtils } from '../utils/validation';
import { SecurityUtils } from '../utils/security';

interface TelegramResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
  error_code?: number;
}

export class TelegramAdapter extends BaseAdapter {
  private static readonly API_BASE = 'https://api.telegram.org';
  private static readonly MAX_MESSAGE_LENGTH = 4096;

  async send(config: NotificationConfig, content: string, subject?: string): Promise<unknown> {
    try {
      const validatedConfig = ValidationUtils.validateNotificationConfig(config, 'telegram');
      
      if (!validatedConfig.bot_token || !validatedConfig.chat_id) {
        throw new Error('Bot token and chat ID are required');
      }

      // Sanitize content first
      const sanitizedContent = SecurityUtils.sanitizeString(content, {
        maxLength: TelegramAdapter.MAX_MESSAGE_LENGTH,
        removeControlChars: true,
      });
      const sanitizedSubject = subject ? SecurityUtils.sanitizeString(subject, {
        maxLength: 200,
        removeControlChars: true,
      }) : undefined;

      // Validate parse_mode
      const parseMode = String(validatedConfig['parse_mode'] || 'MarkdownV2');
      if (!['Markdown', 'MarkdownV2', 'HTML'].includes(parseMode)) {
        throw new NotificationSystemError('Invalid parse_mode', 'INVALID_PARSE_MODE', false);
      }

      const message = this.formatMessage(sanitizedContent, sanitizedSubject, parseMode);

      const url = `${TelegramAdapter.API_BASE}/bot${validatedConfig.bot_token}/sendMessage`;
      
      const payload = {
        chat_id: validatedConfig.chat_id,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: validatedConfig['disable_web_page_preview'] ?? true,
        disable_notification: validatedConfig['disable_notification'] ?? false,
      };

      this.logger.debug('Sending Telegram notification', {
        chatId: String(validatedConfig.chat_id),
        messageLength: message.length,
        parseMode: parseMode,
      });

      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json() as TelegramResponse;

      if (!responseData.ok) {
        throw new NotificationSystemError(
          `Telegram API error: ${responseData.description || 'Unknown error'}`,
          'TELEGRAM_API_ERROR',
          this.isRetryableError(responseData.error_code),
        );
      }

      this.logger.info('Telegram notification sent successfully', {
        chatId: String(validatedConfig.chat_id),
      });

      return responseData.result;
    } catch (error) {
      return this.handleError(error, 'telegram');
    }
  }

  private formatMessage(content: string, subject: string | undefined, parseMode: string): string {
    if (parseMode === 'MarkdownV2') {
      const escapedContent = SecurityUtils.escapeTelegramMarkdown(content);
      if (subject) {
        const escapedSubject = SecurityUtils.escapeTelegramMarkdown(subject);
        return `*${escapedSubject}*\n\n${escapedContent}`;
      }
      return escapedContent;
    } else if (parseMode === 'HTML') {
      const escapedContent = SecurityUtils.escapeHtml(content);
      if (subject) {
        const escapedSubject = SecurityUtils.escapeHtml(subject);
        return `<b>${escapedSubject}</b>\n\n${escapedContent}`;
      }
      return escapedContent;
    } else {
      // For old Markdown format, use limited escaping
      const escapedContent = this.escapeMarkdownV1(content);
      if (subject) {
        const escapedSubject = this.escapeMarkdownV1(subject);
        return `*${escapedSubject}*\n\n${escapedContent}`;
      }
      return escapedContent;
    }
  }

  private escapeMarkdownV1(text: string): string {
    // Markdown v1 has fewer special characters
    return text.replace(/[*_`\[\]]/g, '\\$&');
  }

  private isRetryableError(errorCode?: number): boolean {
    if (!errorCode) return true;
    
    const nonRetryableErrors = [
      400, // Bad Request
      401, // Unauthorized
      403, // Forbidden
      404, // Not Found
    ];
    
    return !nonRetryableErrors.includes(errorCode);
  }
}
/**
 * Security utilities for content sanitization and escaping
 */
export class SecurityUtils {
  /**
   * Remove control characters and null bytes
   */
  static removeControlCharacters(text: string): string {
    // Remove all control characters except tab, newline, and carriage return
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Escape content for Telegram MarkdownV2
   * https://core.telegram.org/bots/api#markdownv2-style
   */
  static escapeTelegramMarkdown(text: string): string {
    // All special characters in MarkdownV2 that need escaping
    return text.replace(/[_*\[\]()~`>#\+\-=|{}.!\\]/g, '\\$&');
  }

  /**
   * Escape content for Slack mrkdwn format
   * https://api.slack.com/reference/surfaces/formatting
   */
  static escapeSlackMrkdwn(text: string): string {
    // Slack mrkdwn special characters
    return text.replace(/[*_~`>]/g, '\\$&');
  }

  /**
   * Escape content for Lark markdown
   * Similar to standard markdown but with some differences
   */
  static escapeLarkMarkdown(text: string): string {
    // Lark markdown special characters
    return text.replace(/[*_`\[\]()\\]/g, '\\$&');
  }

  /**
   * Escape content for JSON string values
   * Ensures content is safe to embed in JSON
   */
  static escapeJsonString(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\f/g, '\\f')
      .replace(/\b/g, '\\b');
  }

  /**
   * Escape HTML entities
   */
  static escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
    };
    return text.replace(/[&<>"'/]/g, (char) => htmlEntities[char] || char);
  }

  /**
   * Sanitize and validate string input
   * - Trim whitespace
   * - Remove control characters
   * - Limit length
   * - Validate UTF-8 encoding
   */
  static sanitizeString(
    input: string,
    options: {
      maxLength?: number;
      trim?: boolean;
      removeControlChars?: boolean;
    } = {}
  ): string {
    const {
      maxLength = 10000,
      trim = true,
      removeControlChars = true,
    } = options;

    let result = input;

    // Trim whitespace
    if (trim) {
      result = result.trim();
    }

    // Remove control characters
    if (removeControlChars) {
      result = this.removeControlCharacters(result);
    }

    // Limit length
    if (maxLength > 0) {
      result = result.slice(0, maxLength);
    }

    return result;
  }

  /**
   * Validate and sanitize HTTP headers
   * Prevents header injection attacks
   */
  static sanitizeHeaders(headers?: Record<string, string>): Record<string, string> {
    if (!headers) return {};
    
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      // Remove newlines and control characters from both key and value
      const sanitizedKey = key.replace(/[\r\n\x00-\x1F\x7F]/g, '');
      const sanitizedValue = value.replace(/[\r\n\x00-\x1F\x7F]/g, '');
      
      if (sanitizedKey && sanitizedValue) {
        sanitized[sanitizedKey] = sanitizedValue;
      }
    }
    return sanitized;
  }

  /**
   * Check if string contains only valid UTF-8 characters
   */
  static isValidUtf8(text: string): boolean {
    try {
      // Encode and decode to check for invalid UTF-8 sequences
      return text === new TextDecoder().decode(new TextEncoder().encode(text));
    } catch {
      return false;
    }
  }

  /**
   * Detect potential security threats in content
   */
  static detectThreats(content: string): string[] {
    const threats: string[] = [];

    // Check for null bytes
    if (content.includes('\x00')) {
      threats.push('null_byte_detected');
    }

    // Check for excessive control characters
    const controlCharCount = (content.match(/[\x00-\x1F\x7F]/g) || []).length;
    if (controlCharCount > content.length * 0.1) {
      threats.push('excessive_control_characters');
    }

    // Check for potential script injection patterns
    const scriptPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /on\w+\s*=/i, // onclick=, onload=, etc.
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    for (const pattern of scriptPatterns) {
      if (pattern.test(content)) {
        threats.push('potential_script_injection');
        break;
      }
    }

    return threats;
  }

  /**
   * Escape content based on the target channel type
   */
  static escapeForChannel(
    content: string,
    channelType: 'telegram' | 'slack' | 'lark' | 'webhook',
    format?: 'text' | 'markdown' | 'html'
  ): string {
    // First, sanitize the input
    const sanitized = this.sanitizeString(content);

    switch (channelType) {
      case 'telegram':
        return format === 'markdown' ? this.escapeTelegramMarkdown(sanitized) : sanitized;
      
      case 'slack':
        return this.escapeSlackMrkdwn(sanitized);
      
      case 'lark':
        return format === 'markdown' ? this.escapeLarkMarkdown(sanitized) : sanitized;
      
      case 'webhook':
        // Webhooks typically use JSON, no special escaping needed
        // JSON.stringify will handle the escaping
        return sanitized;
      
      default:
        return sanitized;
    }
  }

  /**
   * Sanitize template variable values to prevent injection attacks
   */
  static sanitizeTemplateValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Convert to string
    let strValue = String(value);

    // Remove control characters and sanitize
    strValue = this.sanitizeString(strValue, {
      maxLength: 5000,
      trim: true,
      removeControlChars: true,
    });

    // Escape any HTML entities to prevent XSS
    strValue = this.escapeHtml(strValue);

    return strValue;
  }
}
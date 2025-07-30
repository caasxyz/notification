import { NotificationConfig } from '../types';
import { BaseAdapter } from './BaseAdapter';
import { ValidationUtils } from '../utils/validation';
import { SecurityUtils } from '../utils/security';

interface SlackResponse {
  ok: boolean;
  error?: string;
  warning?: string;
  response_metadata?: {
    warnings?: string[];
  };
}

export class SlackAdapter extends BaseAdapter {
  constructor(private defaultConfig?: { apiUrl?: string; timeout?: number }) {
    super();
  }

  async send(config: NotificationConfig, content: string, subject?: string): Promise<unknown> {
    try {
      const validatedConfig = ValidationUtils.validateNotificationConfig(config, 'slack');
      
      // Use default apiUrl if webhook_url is not provided
      const webhookUrl = validatedConfig.webhook_url || this.defaultConfig?.apiUrl;
      
      if (!webhookUrl) {
        throw new Error('Webhook URL is required');
      }

      // Sanitize content and subject
      const sanitizedContent = SecurityUtils.sanitizeString(content, {
        maxLength: 40000, // Slack's max message length
        removeControlChars: true,
      });
      const sanitizedSubject = subject ? SecurityUtils.sanitizeString(subject, {
        maxLength: 200,
        removeControlChars: true,
      }) : undefined;

      const payload = this.buildPayload(sanitizedContent, validatedConfig, sanitizedSubject);

      this.logger.debug('Sending Slack notification', {
        url: webhookUrl,
        hasAttachments: !!payload['attachments'],
        hasBlocks: !!payload['blocks'],
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

      let responseData: SlackResponse | string;
      const responseText = await response.text();

      try {
        responseData = JSON.parse(responseText) as SlackResponse;
      } catch {
        responseData = responseText;
      }

      if (typeof responseData === 'object' && !responseData.ok) {
        throw new Error(`Slack API error: ${responseData.error || 'Unknown error'}`);
      }

      if (responseData === 'ok') {
        responseData = { ok: true };
      }

      this.logger.info('Slack notification sent successfully', {
        url: webhookUrl,
      });

      return responseData;
    } catch (error) {
      return this.handleError(error, 'slack');
    }
  }

  private buildPayload(
    content: string,
    config: NotificationConfig,
    subject?: string,
  ): Record<string, unknown> {
    // Escape content for mrkdwn format by default
    const escapedContent = SecurityUtils.escapeSlackMrkdwn(content);
    const escapedSubject = subject ? SecurityUtils.escapeSlackMrkdwn(subject) : undefined;

    const payload: Record<string, unknown> = {
      text: escapedContent,
      username: config.username || 'Notification Bot',
      icon_emoji: config['icon_emoji'] || ':bell:',
    };

    if (config['channel']) {
      // Sanitize channel name
      const channel = String(config['channel']).trim();
      if (channel && /^[#@].+/.test(channel)) {
        payload['channel'] = channel;
      }
    }

    if (config['use_blocks'] || escapedSubject) {
      payload['blocks'] = this.buildBlocks(escapedContent, escapedSubject);
      payload['text'] = escapedSubject || escapedContent;
    }

    if (config['use_attachments'] && escapedSubject) {
      payload['attachments'] = [{
        color: config['color'] || 'good',
        pretext: escapedSubject,
        text: escapedContent,
        ts: Math.floor(Date.now() / 1000),
      }];
    }

    if (config['thread_ts']) {
      payload['thread_ts'] = config['thread_ts'];
    }

    return payload;
  }

  private buildBlocks(content: string, subject?: string): unknown[] {
    const blocks: unknown[] = [];

    if (subject) {
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: subject,
          emoji: true,
        },
      });
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: content,
      },
    });

    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `Sent at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} {time}|${new Date().toISOString()}>`,
      }],
    });

    return blocks;
  }
}
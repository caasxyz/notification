import { Env, NotificationChannel } from '../../types';
import { GrafanaWebhookPayload } from '../../types/grafana';
import { GrafanaTransformAdapter } from '../../services/transformers/GrafanaTransformAdapter';
import { NotificationDispatcherV2 } from '../../services/NotificationDispatcherV2';
import { validateBasicAuth } from '../middleware/basicAuth';
import { Logger } from '../../utils/logger';
import { ValidationError } from '../../utils/errors';

/**
 * Grafana Webhook Handler
 * 
 * Handles incoming webhook requests from Grafana Alerting
 */

const logger = Logger.getInstance();

/**
 * Parse notification channels from header
 */
function parseNotificationChannels(headerValue: string | null): NotificationChannel[] {
  if (!headerValue) {
    return ['webhook']; // Default to webhook if not specified
  }

  const channels = headerValue.split(',')
    .map(c => c.trim().toLowerCase())
    .filter(c => c);

  // Validate channels
  const validChannels: NotificationChannel[] = ['webhook', 'telegram', 'lark', 'slack'];
  const parsedChannels = channels.filter(c => 
    validChannels.includes(c as NotificationChannel)
  ) as NotificationChannel[];

  if (parsedChannels.length === 0) {
    return ['webhook']; // Default if no valid channels
  }

  return parsedChannels;
}

/**
 * Validate Grafana webhook payload
 */
function validateGrafanaPayload(payload: any): GrafanaWebhookPayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Invalid payload format');
  }

  // Required fields
  if (!payload.receiver || typeof payload.receiver !== 'string') {
    throw new ValidationError('Missing or invalid receiver field');
  }

  if (!payload.status || !['firing', 'resolved'].includes(payload.status)) {
    throw new ValidationError('Missing or invalid status field');
  }

  if (!Array.isArray(payload.alerts)) {
    throw new ValidationError('Alerts must be an array');
  }

  // Validate each alert
  payload.alerts.forEach((alert: any, index: number) => {
    if (!alert.status || !['firing', 'resolved'].includes(alert.status)) {
      throw new ValidationError(`Invalid status in alert ${index}`);
    }
    if (!alert.labels || typeof alert.labels !== 'object') {
      throw new ValidationError(`Missing labels in alert ${index}`);
    }
  });

  return payload as GrafanaWebhookPayload;
}

/**
 * Main handler for Grafana webhook
 */
export async function handleGrafanaWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // 1. Validate Basic Auth
    const authResult = await validateBasicAuth(request, env);
    if (!authResult.valid) {
      logger.warn('Grafana webhook auth failed', {
        error: authResult.error,
        ip: request.headers.get('CF-Connecting-IP')
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: authResult.error || 'Unauthorized'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Basic realm="Grafana Webhook"'
          }
        }
      );
    }

    // 2. Parse request body
    let payload: GrafanaWebhookPayload;
    try {
      const body = await request.json();
      payload = validateGrafanaPayload(body);
    } catch (error) {
      logger.error('Failed to parse Grafana webhook payload', error);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Invalid payload'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Extract user ID and channels
    const userId = payload.receiver;
    const channelsHeader = request.headers.get('X-Notification-Channels');
    const channels = parseNotificationChannels(channelsHeader);

    logger.info('Processing Grafana webhook', {
      userId,
      channels,
      status: payload.status,
      alertCount: payload.alerts.length,
      groupKey: payload.groupKey
    });

    // 4. Transform Grafana payload
    const transformer = new GrafanaTransformAdapter();
    const notificationData = transformer.transform(payload);

    // 5. Send notification
    const result = await NotificationDispatcherV2.sendNotification({
      user_id: userId,
      channels,
      ...notificationData,
      // Add metadata for tracking
      metadata: {
        source: 'grafana',
        webhook_type: 'alert',
        group_key: payload.groupKey,
        alert_status: payload.status,
        alert_count: payload.alerts.length
      }
    }, env);

    const duration = Date.now() - startTime;

    // Check if any notifications were sent successfully
    const successfulResults = result.filter(r => r.status === 'sent' || r.status === 'retry_scheduled');
    const failedResults = result.filter(r => r.status === 'failed');
    const success = successfulResults.length > 0;

    // Log the result
    if (success) {
      logger.info('Grafana webhook processed successfully', {
        userId,
        messageIds: successfulResults.map(r => r.messageId),
        duration,
        successCount: successfulResults.length,
        failureCount: failedResults.length
      });
    } else {
      logger.error('Grafana webhook processing failed', {
        userId,
        errors: failedResults.map(r => ({ channel: r.channelType, error: r.error })),
        duration
      });
    }

    // Return response
    return new Response(
      JSON.stringify({
        success,
        data: success ? {
          message_ids: result.map(r => r.messageId),
          processed_alerts: payload.alerts.length,
          notification_status: result.map(r => ({
            channelType: r.channelType,
            status: r.status,
            messageId: r.messageId,
            error: r.error
          }))
        } : undefined,
        error: !success ? failedResults.map(r => r.error).join(', ') : undefined
      }),
      {
        status: success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Unexpected error in Grafana webhook handler', error, { duration });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
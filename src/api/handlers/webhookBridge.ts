import { Env } from '../../types';
import { Logger } from '../../utils/logger';
import { NotificationDispatcherV2 } from '../../services/NotificationDispatcherV2';

const logger = Logger.getInstance();

export async function webhookBridgeHandler(
  request: Request,
  env: Env,
  params: { user_id: string; channel_type: string },
): Promise<Response> {
  const startTime = Date.now();
  
  logger.info('Webhook bridge request received', {
    method: request.method,
    url: request.url,
    params,
    headers: Object.fromEntries(request.headers.entries()),
  });
  
  try {
    const { user_id, channel_type } = params;
    
    // Validate channel type
    const validChannels = ['webhook', 'telegram', 'lark', 'slack'];
    if (!validChannels.includes(channel_type)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid channel type. Must be one of: ${validChannels.join(', ')}`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    
    // Get raw request body
    const rawBody = await request.text();
    let body: any = rawBody;
    const contentType = request.headers.get('content-type');
    
    logger.info('Received webhook body', {
      contentType,
      bodyLength: rawBody.length,
      bodyPreview: rawBody.substring(0, 200),
    });
    
    // Try to parse as JSON if content-type suggests it
    if (contentType?.includes('application/json')) {
      try {
        body = JSON.parse(rawBody);
      } catch (error) {
        logger.warn('Failed to parse JSON, using raw body', { error });
        body = rawBody;
      }
    }
    
    // Extract content and subject from webhook payload
    let content = '';
    let subject = 'Webhook Notification';
    
    if (typeof body === 'string') {
      // If body is string, use it directly as content
      content = body;
    } else if (typeof body === 'object' && body !== null) {
      // If body is object, try to extract common fields
      // Extract subject from common fields
      subject = body.subject || body.title || body.summary || body.alertname || 'Webhook Notification';
      
      // Extract content - prefer specific fields but fall back to full JSON
      if (body.text) {
        content = body.text;
      } else if (body.message) {
        content = body.message;
      } else if (body.content) {
        content = body.content;
      } else if (body.description) {
        content = body.description;
      } else if (body.payload) {
        content = typeof body.payload === 'string' ? body.payload : JSON.stringify(body.payload, null, 2);
      } else {
        // Use the entire body as content
        content = JSON.stringify(body, null, 2);
      }
    } else {
      // Fallback for any other type
      content = String(body);
    }
    
    // Log extracted content
    logger.info('Extracted content', {
      subject,
      content_length: content.length,
      content_preview: content.substring(0, 100),
      body_type: typeof body,
      original_fields: typeof body === 'object' ? Object.keys(body) : 'string',
    });
    
    // Ensure content is not empty
    if (!content || content.trim() === '') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No content to send',
          details: 'Unable to extract content from webhook payload',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    
    // Create notification request
    const notificationRequest = {
      user_id,
      channels: [channel_type],
      custom_content: {
        subject,
        content: content,  // 注意：这里应该是 content 而不是 body
      },
      // Generate unique idempotency key for this webhook
      idempotency_key: `webhook-bridge-${crypto.randomUUID()}`,
      // Include original webhook data as metadata
      metadata: {
        source: 'webhook_bridge',
        original_headers: Object.fromEntries(request.headers.entries()),
        original_body: typeof body === 'string' ? body.substring(0, 1000) : body, // Limit size
      },
    };
    
    logger.info('Processing webhook bridge request', {
      user_id,
      channel_type,
      content_length: content.length,
      subject,
      notification_request: {
        channels: notificationRequest.channels,
        has_custom_content: !!notificationRequest.custom_content,
        custom_content_subject: notificationRequest.custom_content?.subject,
        custom_content_content_length: notificationRequest.custom_content?.content?.length,
      },
    });
    
    // Dispatch notification
    let results;
    try {
      results = await NotificationDispatcherV2.sendNotification(notificationRequest, env);
    } catch (dispatchError) {
      logger.error('Failed to dispatch notification', dispatchError, {
        user_id,
        channel_type,
        error: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to dispatch notification',
          details: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    
    // Check results
    const success = results.some(r => r.status === 'sent' || r.status === 'success');
    const errors = results.filter(r => r.status === 'failed' || r.error).map(r => r.error || 'Unknown error');
    
    const duration = Date.now() - startTime;
    
    if (success) {
      logger.info('Webhook bridge notification sent successfully', {
        user_id,
        channel_type,
        duration,
        message_id: results[0]?.message_id,
      });
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Notification forwarded successfully',
          message_id: results[0]?.messageId,
          duration,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } else {
      logger.error('Webhook bridge notification failed', {
        user_id,
        channel_type,
        errors,
        duration,
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errors[0] || 'Failed to forward notification',
          errors,
          duration,
          details: {
            user_id,
            channel_type,
            results: results.map(r => ({
              channel: r.channelType,
              success: r.status === 'sent',
              error: r.error,
              message_id: r.messageId,
            })),
          },
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    logger.error('Webhook bridge handler error', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
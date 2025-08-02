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
    
    // Get request body
    let body: any;
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      try {
        body = await request.json();
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid JSON body',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    } else if (contentType?.includes('text/plain')) {
      body = { message: await request.text() };
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      body = Object.fromEntries(formData);
    } else {
      // Default to text
      body = { message: await request.text() };
    }
    
    // Extract content from webhook payload
    // Support common webhook formats
    let content = '';
    let subject = '';
    
    if (typeof body === 'string') {
      content = body;
    } else if (body.text) {
      content = body.text;
    } else if (body.message) {
      content = body.message;
    } else if (body.content) {
      content = body.content;
    } else if (body.payload) {
      // Handle nested payload
      if (typeof body.payload === 'string') {
        content = body.payload;
      } else {
        content = JSON.stringify(body.payload, null, 2);
      }
    } else {
      // Fallback to full JSON
      content = JSON.stringify(body, null, 2);
    }
    
    // Extract subject if available
    if (body.subject) {
      subject = body.subject;
    } else if (body.title) {
      subject = body.title;
    } else if (body.summary) {
      subject = body.summary;
    } else {
      subject = 'Webhook Notification';
    }
    
    // Create notification request
    const notificationRequest = {
      user_id,
      channels: [channel_type],
      content: {
        subject,
        body: content,
      },
      // Generate unique idempotency key for this webhook
      idempotency_key: `webhook-bridge-${crypto.randomUUID()}`,
      // Include original webhook data as metadata
      metadata: {
        source: 'webhook_bridge',
        original_headers: Object.fromEntries(request.headers.entries()),
        original_body: body,
      },
    };
    
    logger.info('Processing webhook bridge request', {
      user_id,
      channel_type,
      content_length: content.length,
    });
    
    // Dispatch notification
    const results = await NotificationDispatcherV2.sendNotification(notificationRequest, env);
    
    // Check results
    const success = results.some(r => r.success);
    const errors = results.filter(r => !r.success).map(r => r.error);
    
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
          message_id: results[0]?.message_id,
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
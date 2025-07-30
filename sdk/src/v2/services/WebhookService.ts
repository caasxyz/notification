import { verifyWebhookSignature } from '../utils/signature';
import { WebhookPayload, WebhookEvent } from '../types';

export class WebhookService {
  constructor(private apiKey: string) {}

  /**
   * Verify webhook signature
   */
  async verify(
    headers: Headers | Record<string, string>,
    body: string,
    options?: {
      timestampHeader?: string;
      signatureHeader?: string;
      maxAge?: number;
    }
  ): Promise<boolean> {
    const headersObj = headers instanceof Headers 
      ? headers 
      : new Headers(headers);

    return verifyWebhookSignature(
      this.apiKey,
      headersObj,
      body,
      options
    );
  }

  /**
   * Parse webhook payload
   */
  parse(body: string): WebhookPayload {
    try {
      const payload = JSON.parse(body) as unknown;
      
      if (typeof payload !== 'object' || payload === null ||
          !('event' in payload) || !('timestamp' in payload) || !('data' in payload)) {
        throw new Error('Invalid webhook payload structure');
      }

      return payload as WebhookPayload;
    } catch (error) {
      throw new Error(`Failed to parse webhook payload: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create webhook handler with automatic verification
   */
  createHandler(
    handlers: Partial<Record<WebhookEvent, (data: unknown) => void | Promise<void>>>,
    options?: {
      onError?: (error: Error) => void;
      timestampHeader?: string;
      signatureHeader?: string;
      maxAge?: number;
    }
  ) {
    return async (request: Request): Promise<Response> => {
      try {
        // Read body
        const body = await request.text();

        // Verify signature
        const isValid = await this.verify(request.headers, body, options);
        if (!isValid) {
          return new Response('Invalid signature', { status: 401 });
        }

        // Parse payload
        const payload = this.parse(body);

        // Handle event
        const handler = handlers[payload.event];
        if (handler) {
          await handler(payload.data);
        }

        return new Response('OK', { status: 200 });
      } catch (error) {
        if (options?.onError) {
          options.onError(error as Error);
        }
        
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    };
  }

  /**
   * Express/Connect middleware for webhook handling
   */
  createMiddleware(
    handlers: Partial<Record<WebhookEvent, (data: unknown) => void | Promise<void>>>,
    options?: {
      onError?: (error: Error) => void;
      timestampHeader?: string;
      signatureHeader?: string;
      maxAge?: number;
    }
  ) {
    // Type the middleware function properly
    return async (req: { body?: string; headers: Record<string, string> }, 
                  res: { status: (code: number) => { send: (data: string) => void; json: (data: unknown) => void } }, 
                  _next: unknown) => {
      try {
        // Get raw body
        const body = typeof req.body === 'string' ? req.body : '';

        // Verify signature
        const isValid = await this.verify(req.headers, body, options);
        if (!isValid) {
          res.status(401).send('Invalid signature');
          return;
        }

        // Parse payload
        const payload = this.parse(body);

        // Handle event
        const handler = handlers[payload.event];
        if (handler !== undefined) {
          await handler(payload.data);
        }

        res.status(200).send('OK');
      } catch (error) {
        if (options?.onError !== undefined) {
          options.onError(error as Error);
        }
        
        res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    };
  }
}
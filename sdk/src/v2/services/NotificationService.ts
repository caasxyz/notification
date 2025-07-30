import { ApiClient } from '../ApiClient';
import {
  NotificationRequest,
  NotificationResponse,
  BatchNotificationRequest,
  BatchNotificationResponse,
  NotificationStatus,
  ChannelType,
  NotificationPriority
} from '../types';

export class NotificationService {
  constructor(private client: ApiClient) {}

  /**
   * Send a single notification
   */
  async send(request: NotificationRequest): Promise<NotificationResponse> {
    return this.client.post<NotificationResponse>('/api/notifications/send', request);
  }

  /**
   * Send notifications in batch
   */
  async sendBatch(request: BatchNotificationRequest): Promise<BatchNotificationResponse> {
    if (request.strategy === 'sequential') {
      return this.sendSequential(request);
    }
    return this.sendParallel(request);
  }

  /**
   * Get notification status
   * Note: This endpoint is not implemented in the actual API
   */
  getStatus(_notificationId: string): Promise<{
    id: string;
    status: NotificationStatus;
    sentAt?: string;
    error?: string;
  }> {
    return Promise.reject(new Error('Get notification status endpoint not implemented in the server'));
  }

  /**
   * Cancel a scheduled notification
   * Note: This endpoint is not implemented in the actual API
   */
  cancel(_notificationId: string): Promise<{ success: boolean }> {
    return Promise.reject(new Error('Cancel notification endpoint not implemented in the server'));
  }

  /**
   * Retry a failed notification
   */
  async retry(notificationId: string): Promise<NotificationResponse> {
    return this.client.post('/api/notifications/retry', { notification_id: notificationId });
  }

  /**
   * Schedule a notification for later
   */
  async schedule(
    request: NotificationRequest,
    scheduleFor: Date | string
  ): Promise<NotificationResponse> {
    return this.send({
      ...request,
      scheduledFor: scheduleFor
    });
  }

  /**
   * Send notification with template preview
   */
  async sendWithPreview(request: NotificationRequest): Promise<{
    notification: NotificationResponse;
    preview: {
      subject?: string;
      content: string;
      channel: ChannelType;
    };
  }> {
    // Note: Preview endpoint not implemented in the actual API
    // This would need to be implemented server-side first
    return this.client.post('/api/notifications/preview', request);
  }

  /**
   * Validate notification request without sending
   */
  async validate(request: NotificationRequest): Promise<{
    valid: boolean;
    errors?: Array<{
      field: string;
      message: string;
    }>;
  }> {
    // Note: Validate endpoint not implemented in the actual API
    // This would need to be implemented server-side first
    return this.client.post('/api/notifications/validate', request);
  }

  /**
   * Create a notification builder for fluent API
   */
  builder(): NotificationBuilder {
    return new NotificationBuilder(this);
  }

  private async sendParallel(
    request: BatchNotificationRequest
  ): Promise<BatchNotificationResponse> {
    const results = await Promise.allSettled(
      request.notifications.map(notification => this.send(notification))
    );

    const successful: NotificationResponse[] = [];
    const failed: Array<{ request: NotificationRequest; error: string }> = [];

    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      const notification = request.notifications[index];
      if (result !== undefined && notification !== undefined) {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({
            request: notification,
            error: (result.reason as Error)?.message ?? 'Unknown error'
          });

          if (request.stopOnError === true) {
            // Cancel remaining notifications
            for (let i = index + 1; i < request.notifications.length; i++) {
              const remainingNotification = request.notifications[i];
              if (remainingNotification !== undefined) {
                failed.push({
                  request: remainingNotification,
                  error: 'Cancelled due to previous error'
                });
              }
            }
            break;
          }
        }
      }
    }

    return {
      successful,
      failed,
      summary: {
        total: request.notifications.length,
        successful: successful.length,
        failed: failed.length
      }
    };
  }

  private async sendSequential(
    request: BatchNotificationRequest
  ): Promise<BatchNotificationResponse> {
    const successful: NotificationResponse[] = [];
    const failed: Array<{ request: NotificationRequest; error: string }> = [];

    for (const notification of request.notifications) {
      try {
        const response = await this.send(notification);
        successful.push(response);
      } catch (error) {
        failed.push({
          request: notification,
          error: (error as Error).message ?? 'Unknown error'
        });

        if (request.stopOnError === true) {
          // Add remaining notifications as failed
          const currentIndex = request.notifications.indexOf(notification);
          for (let i = currentIndex + 1; i < request.notifications.length; i++) {
            const remainingNotification = request.notifications[i];
            if (remainingNotification !== undefined) {
              failed.push({
                request: remainingNotification,
                error: 'Cancelled due to previous error'
              });
            }
          }
          break;
        }
      }
    }

    return {
      successful,
      failed,
      summary: {
        total: request.notifications.length,
        successful: successful.length,
        failed: failed.length
      }
    };
  }
}

/**
 * Fluent builder for notifications
 */
export class NotificationBuilder {
  private request: Partial<NotificationRequest> = {};

  constructor(private service: NotificationService) {}

  to(userId: string): this {
    this.request.userId = userId;
    return this;
  }

  template(key: string): this {
    this.request.templateKey = key;
    return this;
  }

  channel(type: ChannelType): this {
    this.request.channel = type;
    return this;
  }

  variables(vars: Record<string, unknown>): this {
    this.request.variables = vars;
    return this;
  }

  priority(level: NotificationPriority): this {
    this.request.priority = level;
    return this;
  }

  scheduleFor(date: Date | string): this {
    this.request.scheduledFor = date;
    return this;
  }

  withRequestId(id: string): this {
    this.request.requestId = id;
    return this;
  }

  metadata(data: Record<string, unknown>): this {
    this.request.metadata = data;
    return this;
  }

  async send(): Promise<NotificationResponse> {
    if (this.request.userId === undefined || this.request.userId === '' ||
        this.request.templateKey === undefined || this.request.templateKey === '' ||
        this.request.channel === undefined) {
      throw new Error('Missing required fields: userId, templateKey, and channel');
    }

    return this.service.send(this.request as NotificationRequest);
  }

  async validate(): Promise<{ valid: boolean; errors?: Array<{ field: string; message: string }> }> {
    return this.service.validate(this.request as NotificationRequest);
  }
}
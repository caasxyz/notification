import {
  SDKConfig,
  NotificationRequest,
  NotificationResponse,
  UserConfig,
  Template,
  User,
  NotificationLog,
  LogQueryParams,
  NotificationError,
  ChannelType,
  ErrorResponse,
} from './types';
import * as crypto from 'crypto';

interface InternalConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
  };
}

export class NotificationClient {
  private config: InternalConfig;

  constructor(config: SDKConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      apiKey: config.apiKey ?? '',
      timeout: config.timeout ?? 30000,
      retryConfig: {
        maxRetries: config.retryConfig?.maxRetries ?? 3,
        retryDelay: config.retryConfig?.retryDelay ?? 1000,
      },
    };
  }

  /**
   * Send a notification
   */
  async sendNotification(request: NotificationRequest): Promise<NotificationResponse> {
    return this.request<NotificationResponse>('/api/notifications/send', 'POST', request);
  }

  /**
   * Send notifications in batch
   */
  async sendBatchNotifications(requests: NotificationRequest[]): Promise<NotificationResponse[]> {
    const promises = requests.map(req => this.sendNotification(req));
    return Promise.all(promises);
  }

  /**
   * User management methods
   * Note: User CRUD endpoints are not implemented in the actual API
   * These methods are kept for future implementation
   */
  users = {
    create: (_user: User): Promise<{ success: boolean; data?: User }> => {
      return Promise.reject(new Error('User creation endpoint not implemented in the server'));
    },

    get: (_userId: string): Promise<{ success: boolean; data?: User }> => {
      return Promise.reject(new Error('User get endpoint not implemented in the server'));
    },

    update: (_userId: string, _user: Partial<User>): Promise<{ success: boolean; data?: User }> => {
      return Promise.reject(new Error('User update endpoint not implemented in the server'));
    },

    delete: (_userId: string): Promise<{ success: boolean }> => {
      return Promise.reject(new Error('User delete endpoint not implemented in the server'));
    },

    list: (_params?: { limit?: number; offset?: number }): Promise<{ success: boolean; data?: User[] }> => {
      return Promise.reject(new Error('User list endpoint not implemented in the server'));
    },
  };

  /**
   * Configuration management methods
   */
  configs = {
    set: async (userId: string, channelType: ChannelType, config: UserConfig): Promise<{ success: boolean }> => {
      // API expects config_data field, not config
      return this.request('/api/user-configs', 'POST', { 
        user_id: userId,
        channel_type: channelType,
        config_data: config.config,
        is_active: config.is_active ?? true
      });
    },

    get: async (userId: string, channelType: ChannelType): Promise<{ success: boolean; data?: UserConfig }> => {
      return this.request(`/api/user-configs?user_id=${encodeURIComponent(userId)}&channel_type=${channelType}`, 'GET');
    },

    list: async (userId: string): Promise<{ success: boolean; data?: UserConfig[] }> => {
      return this.request(`/api/user-configs?user_id=${encodeURIComponent(userId)}`, 'GET');
    },

    delete: async (userId: string, channelType: ChannelType): Promise<{ success: boolean }> => {
      return this.request(`/api/user-configs?user_id=${encodeURIComponent(userId)}&channel_type=${channelType}`, 'DELETE');
    },

    activate: (_userId: string, _channelType: ChannelType): Promise<{ success: boolean }> => {
      // Note: Activate/deactivate endpoints not implemented in the actual API
      return Promise.reject(new Error('Config activate endpoint not implemented in the server'));
    },

    deactivate: (_userId: string, _channelType: ChannelType): Promise<{ success: boolean }> => {
      // Note: Activate/deactivate endpoints not implemented in the actual API
      return Promise.reject(new Error('Config deactivate endpoint not implemented in the server'));
    },
  };

  /**
   * Template management methods
   */
  templates = {
    create: async (templateKey: string, template: Template): Promise<{ success: boolean }> => {
      return this.request(`/api/templates?key=${encodeURIComponent(templateKey)}`, 'POST', template);
    },

    get: async (templateKey: string): Promise<{ success: boolean; data?: Template }> => {
      return this.request(`/api/templates?key=${encodeURIComponent(templateKey)}`, 'GET');
    },

    update: async (templateKey: string, template: Partial<Template>): Promise<{ success: boolean }> => {
      return this.request(`/api/templates?key=${encodeURIComponent(templateKey)}`, 'PUT', template);
    },

    delete: async (templateKey: string): Promise<{ success: boolean }> => {
      return this.request(`/api/templates?key=${encodeURIComponent(templateKey)}`, 'DELETE');
    },

    list: async (params?: { limit?: number; offset?: number }): Promise<{ success: boolean; data?: Record<string, Template> }> => {
      let queryString = '';
      if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          searchParams.append(key, String(value));
        });
        queryString = `?${searchParams.toString()}`;
      }
      return this.request(`/api/templates${queryString}`, 'GET');
    },

    render: (_templateKey: string, _variables: Record<string, unknown>): Promise<{ success: boolean; data?: { subject?: string; content: string } }> => {
      // Note: Template render endpoint not implemented in the actual API
      return Promise.reject(new Error('Template render endpoint not implemented in the server'));
    },
  };

  /**
   * Notification logs methods
   */
  logs = {
    query: async (params: LogQueryParams): Promise<{ success: boolean; data?: NotificationLog[] }> => {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
      const queryString = queryParams.toString();
      return this.request(`/api/notification-logs?${queryString}`, 'GET');
    },

    get: (_logId: number): Promise<{ success: boolean; data?: NotificationLog }> => {
      // Note: Get single log endpoint not implemented in the actual API
      return Promise.reject(new Error('Get single log endpoint not implemented in the server'));
    },

    getByRequestId: (_requestId: string): Promise<{ success: boolean; data?: NotificationLog[] }> => {
      // Note: Get logs by request ID endpoint not implemented in the actual API
      return Promise.reject(new Error('Get logs by request ID endpoint not implemented in the server'));
    },

    cleanup: async (beforeDate: Date): Promise<{ success: boolean; data?: { deleted: number } }> => {
      return this.request('/api/notification-logs/cleanup', 'DELETE', { before_date: beforeDate.toISOString() });
    },
  };

  /**
   * Retry management methods
   */
  retry = {
    trigger: async (): Promise<{ success: boolean; data?: { queued: number; total_failed: number } }> => {
      return this.request('/api/notifications/retry', 'POST');
    },

    getStats: (_userId: string): Promise<{ success: boolean; data?: { totalRetries: number; failedAfterRetries: number; pendingRetries: number } }> => {
      // Note: Retry stats endpoint not implemented in the actual API
      return Promise.reject(new Error('Retry stats endpoint not implemented in the server'));
    },
  };

  /**
   * Health check
   */
  async health(): Promise<{ success: boolean; data?: { status: string; timestamp: string } }> {
    return this.request('/health', 'GET');
  }

  /**
   * Make HTTP request with retry logic
   */
  private async request<T>(
    path: string,
    method: string,
    body?: unknown,
    retryCount = 0
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add HMAC signature for authentication
    if (this.config.apiKey !== '') {
      const timestamp = Date.now().toString();
      let payload: string;
      
      if (method === 'GET' || method === 'DELETE') {
        // For GET and DELETE, use path and query params
        const urlObj = new URL(url);
        payload = urlObj.pathname + urlObj.search;
      } else {
        // For POST/PUT, use body
        payload = body !== undefined ? JSON.stringify(body) : '';
      }
      
      const signature = this.generateHMAC(timestamp + payload, this.config.apiKey);
      headers['X-Timestamp'] = timestamp;
      headers['X-Signature'] = signature;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };
      
      if (body !== undefined) {
        fetchOptions.body = JSON.stringify(body);
      }
      
      const response = await fetch(url, fetchOptions);

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ErrorResponse;
        throw new NotificationError(
          errorData.error || `HTTP ${response.status}`,
          errorData.code,
          errorData.details
        );
      }

      return data as T;
    } catch (error) {
      if (error instanceof NotificationError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new NotificationError('Request timeout', 'TIMEOUT');
      }

      // Retry logic for network errors
      if (retryCount < this.config.retryConfig.maxRetries) {
        await this.delay(this.config.retryConfig.retryDelay * Math.pow(2, retryCount));
        return this.request(path, method, body, retryCount + 1);
      }

      throw new NotificationError(
        error instanceof Error ? error.message : 'Unknown error',
        'NETWORK_ERROR'
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate HMAC-SHA256 signature
   */
  private generateHMAC(message: string, key: string): string {
    return crypto
      .createHmac('sha256', key)
      .update(message, 'utf8')
      .digest('hex');
  }
}
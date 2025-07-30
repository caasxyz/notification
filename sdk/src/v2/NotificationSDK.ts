import { 
  SDKConfig, 
  ClientOptions,
  RequestInterceptor,
  ResponseInterceptor,
  ErrorHandler
} from './types';
import { ApiClient } from './ApiClient';
import { NotificationService } from './services/NotificationService';
import { TemplateService } from './services/TemplateService';
import { UserService } from './services/UserService';
import { ConfigService } from './services/ConfigService';
import { LogService } from './services/LogService';
import { WebhookService } from './services/WebhookService';
import { EventEmitter } from './utils/EventEmitter';
import { RateLimiter } from './utils/RateLimiter';
import { RetryManager } from './utils/RetryManager';

export interface SDKEvents {
  'request:start': Request;
  'request:success': Response;
  'request:error': Error;
  'rate:limited': number;
  'retry:attempt': { attempt: number; error: Error };
}

/**
 * Modern SDK design with improved architecture
 */
export class NotificationSDK extends EventEmitter<SDKEvents> {
  private readonly apiClient: ApiClient;
  private readonly rateLimiter: RateLimiter;
  private readonly retryManager: RetryManager;

  // Services
  public readonly notifications: NotificationService;
  public readonly templates: TemplateService;
  public readonly users: UserService;
  public readonly configs: ConfigService;
  public readonly logs: LogService;
  public readonly webhooks: WebhookService;

  constructor(config: SDKConfig, options?: ClientOptions) {
    super();

    // Initialize core components
    this.rateLimiter = new RateLimiter(options?.rateLimit);
    this.retryManager = new RetryManager(options?.retry);

    // Initialize API client
    this.apiClient = new ApiClient(config, {
      ...options,
      interceptors: {
        request: this.createRequestInterceptors(options?.interceptors?.request),
        response: this.createResponseInterceptors(options?.interceptors?.response)
      },
      errorHandler: this.createErrorHandler(options?.errorHandler)
    });

    // Initialize services
    this.notifications = new NotificationService(this.apiClient);
    this.templates = new TemplateService(this.apiClient);
    this.users = new UserService(this.apiClient);
    this.configs = new ConfigService(this.apiClient);
    this.logs = new LogService(this.apiClient);
    this.webhooks = new WebhookService(config.apiKey);

    // Setup event forwarding
    this.setupEventForwarding();
  }

  /**
   * Create a new SDK instance with different configuration
   */
  withConfig(config: Partial<SDKConfig>): NotificationSDK {
    return new NotificationSDK(
      { ...this.apiClient.getConfig(), ...config },
      this.apiClient.getOptions()
    );
  }

  /**
   * Add a request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.apiClient.addRequestInterceptor(interceptor);
  }

  /**
   * Add a response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.apiClient.addResponseInterceptor(interceptor);
  }

  /**
   * Set custom error handler
   */
  setErrorHandler(handler: ErrorHandler): void {
    this.apiClient.setErrorHandler(handler);
  }

  /**
   * Enable debug mode
   */
  enableDebug(): void {
    this.apiClient.enableDebug();
  }

  /**
   * Disable debug mode
   */
  disableDebug(): void {
    this.apiClient.disableDebug();
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): {
    remaining: number;
    reset: Date;
    limit: number;
  } {
    return this.rateLimiter.getStatus();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    version?: string;
    timestamp: Date;
  }> {
    try {
      const response = await this.apiClient.get('/health');
      return {
        status: 'healthy',
        version: response.version,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date()
      };
    }
  }

  private createRequestInterceptors(
    userInterceptors?: RequestInterceptor[]
  ): RequestInterceptor[] {
    const interceptors: RequestInterceptor[] = [
      // Rate limiting interceptor
      async (request) => {
        await this.rateLimiter.checkLimit();
        this.emit('request:start', request);
        return request;
      }
    ];

    if (userInterceptors) {
      interceptors.push(...userInterceptors);
    }

    return interceptors;
  }

  private createResponseInterceptors(
    userInterceptors?: ResponseInterceptor[]
  ): ResponseInterceptor[] {
    const interceptors: ResponseInterceptor[] = [
      // Success tracking interceptor
      async (response) => {
        if (response.ok) {
          this.emit('request:success', response);
        }
        
        // Update rate limit from headers
        this.rateLimiter.updateFromHeaders(response.headers);
        
        return response;
      }
    ];

    if (userInterceptors) {
      interceptors.push(...userInterceptors);
    }

    return interceptors;
  }

  private createErrorHandler(userHandler?: ErrorHandler): ErrorHandler {
    let attemptCount = 0;
    
    return async (error, request, retry) => {
      this.emit('request:error', error);

      // Check if it's a rate limit error
      if (error.statusCode === 429) {
        const retryAfter = error.retryAfter || 60;
        this.emit('rate:limited', retryAfter);
        this.rateLimiter.setThrottled(retryAfter);
      }

      // Handle retries
      if (this.retryManager.shouldRetry(error, attemptCount)) {
        attemptCount++;
        this.emit('retry:attempt', { attempt: attemptCount, error });
        const delay = this.retryManager.getDelay(attemptCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry();
      }

      // Call user error handler if provided
      if (userHandler) {
        return userHandler(error, request, retry);
      }

      throw error;
    };
  }

  private setupEventForwarding(): void {
    // Forward events from API client
    this.apiClient.on('debug', (message) => {
      this.emit('request:start', message as any);
    });
  }
}
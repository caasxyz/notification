import { 
  SDKConfig, 
  ClientOptions, 
  RequestInterceptor, 
  ResponseInterceptor,
  ErrorHandler,
  SDKError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ApiResponse
} from './types';
import { EventEmitter } from './utils/EventEmitter';
import { createHmacSignature } from './utils/signature';

export interface ApiClientEvents {
  debug: { message: string; data?: any };
}

export class ApiClient extends EventEmitter<ApiClientEvents> {
  private config: Required<SDKConfig>;
  private options: ClientOptions;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorHandler?: ErrorHandler;
  private debugMode: boolean = false;

  constructor(config: SDKConfig, options: ClientOptions = {}) {
    super();
    
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      apiKey: config.apiKey,
      timeout: config.timeout || 30000,
      environment: config.environment || 'production'
    };

    this.options = options;
    this.debugMode = options.debug || false;

    // Set up interceptors
    if (options.interceptors?.request) {
      this.requestInterceptors.push(...options.interceptors.request);
    }
    if (options.interceptors?.response) {
      this.responseInterceptors.push(...options.interceptors.response);
    }
    if (options.errorHandler) {
      this.errorHandler = options.errorHandler;
    }
  }

  getConfig(): Required<SDKConfig> {
    return { ...this.config };
  }

  getOptions(): ClientOptions {
    return { ...this.options };
  }

  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  setErrorHandler(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  enableDebug(): void {
    this.debugMode = true;
  }

  disableDebug(): void {
    this.debugMode = false;
  }

  async get<T = any>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, 'GET', undefined, options);
  }

  async post<T = any>(path: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, 'POST', data, options);
  }

  async put<T = any>(path: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, 'PUT', data, options);
  }

  async patch<T = any>(path: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, 'PATCH', data, options);
  }

  async delete<T = any>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, 'DELETE', undefined, options);
  }

  private async request<T>(
    path: string,
    method: string,
    data?: any,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const timestamp = Date.now().toString();
    const body = data ? JSON.stringify(data) : '';

    // Create signature
    const signature = await createHmacSignature(
      this.config.apiKey,
      timestamp,
      body
    );

    // Build request
    let request = new Request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        ...this.options.headers,
        ...(options?.headers as any)
      },
      body: method !== 'GET' && body ? body : undefined,
      signal: this.createAbortSignal(),
      ...options
    });

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      request = await interceptor(request);
    }

    this.debug('Request', {
      method,
      url,
      headers: Object.fromEntries([...request.headers as any]),
      body: data
    });

    let response: Response;

    const executeRequest = async (): Promise<Response> => {
      try {
        response = await fetch(request);

        // Apply response interceptors
        for (const interceptor of this.responseInterceptors) {
          response = await interceptor(response);
        }

        this.debug('Response', {
          status: response.status,
          headers: Object.fromEntries([...response.headers as any])
        });

        // Handle non-ok responses
        if (!response.ok) {
          throw await this.createError(response);
        }

        return response;
      } catch (error) {
        if (this.errorHandler) {
          return this.errorHandler(
            error as SDKError,
            request,
            async () => {
              return executeRequest();
            }
          );
        }
        throw error;
      }
    };

    response = await executeRequest();

    // Parse response
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const json = await response.json() as ApiResponse<T>;
      
      if (json.success === false && json.error) {
        throw new SDKError(
          json.error.message,
          response.status,
          json.error.code,
          json.error.details
        );
      }

      return json.data || json as any;
    }

    return response.text() as any;
  }

  private createAbortSignal(): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), this.config.timeout);
    return controller.signal;
  }

  private async createError(response: Response): Promise<SDKError> {
    const contentType = response.headers.get('content-type');
    let errorData: any;

    if (contentType?.includes('application/json')) {
      try {
        const json = await response.json();
        errorData = (json as any).error || json;
      } catch {
        errorData = { message: 'Unknown error' };
      }
    } else {
      errorData = { message: await response.text() };
    }

    const message = errorData.message || response.statusText;
    const code = errorData.code;
    const details = errorData.details;

    switch (response.status) {
      case 400:
        return new ValidationError(message, details?.fields);
      case 401:
        return new AuthenticationError(message);
      case 404:
        return new NotFoundError(details?.resource || 'Resource', details?.id);
      case 429: {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        return new RateLimitError(retryAfter);
      }
      default:
        return new SDKError(message, response.status, code, details);
    }
  }

  private debug(message: string, data?: any): void {
    if (this.debugMode) {
      // EventEmitter expects event name and single data parameter
      this.emit('debug', { message, data });
      // console.debug(`[NotificationSDK] ${message}`, data);
    }
  }
}
// Core SDK Configuration
export interface SDKConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  environment?: 'production' | 'staging' | 'development';
}

// Client Options for advanced configuration
export interface ClientOptions {
  retry?: RetryOptions;
  rateLimit?: RateLimitOptions;
  interceptors?: {
    request?: RequestInterceptor[];
    response?: ResponseInterceptor[];
  };
  errorHandler?: ErrorHandler;
  debug?: boolean;
  headers?: Record<string, string>;
}

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
  maxRetryDelay?: number;
  retryableStatuses?: number[];
  retryableErrors?: string[];
}

export interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
  throttleMs?: number;
}

// Interceptors
export type RequestInterceptor = (request: Request) => Request | Promise<Request>;
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;
export type ErrorHandler = (
  error: SDKError,
  request: Request,
  retry: () => Promise<Response>
) => any;

// Error types
export class SDKError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: any,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'SDKError';
  }
}

export class ValidationError extends SDKError {
  constructor(message: string, public fields?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_ERROR', { fields });
  }
}

export class AuthenticationError extends SDKError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class NotFoundError extends SDKError {
  constructor(resource: string, id?: string) {
    super(
      `${resource} not found${id ? `: ${id}` : ''}`,
      404,
      'NOT_FOUND',
      { resource, id }
    );
  }
}

export class RateLimitError extends SDKError {
  constructor(retryAfter: number) {
    super(
      `Rate limit exceeded. Retry after ${retryAfter} seconds`,
      429,
      'RATE_LIMIT_EXCEEDED',
      undefined,
      retryAfter
    );
  }
}

// Domain types
export enum ChannelType {
  EMAIL = 'email',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  TELEGRAM = 'telegram',
  SLACK = 'slack',
  LARK = 'lark'
}

export enum NotificationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Request/Response types
export interface NotificationRequest {
  userId: string;
  templateKey: string;
  channel: ChannelType;
  variables?: Record<string, any>;
  priority?: NotificationPriority;
  scheduledFor?: Date | string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface BatchNotificationRequest {
  notifications: NotificationRequest[];
  strategy?: 'parallel' | 'sequential';
  stopOnError?: boolean;
}

export interface NotificationResponse {
  notificationId: string;
  status: NotificationStatus;
  requestId?: string;
  createdAt: string;
}

export interface BatchNotificationResponse {
  successful: NotificationResponse[];
  failed: Array<{
    request: NotificationRequest;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// Template types
export interface Template {
  key: string;
  name: string;
  description?: string;
  variables: string[];
  channels: Array<{
    type: ChannelType;
    subjectTemplate?: string;
    contentTemplate: string;
    contentType?: 'text' | 'html' | 'markdown';
  }>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  key: string;
  name: string;
  description?: string;
  variables: string[];
  channels: Array<{
    type: ChannelType;
    subjectTemplate?: string;
    contentTemplate: string;
    contentType?: 'text' | 'html' | 'markdown';
  }>;
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {}

// User types
export interface User {
  id: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, any>;
  channels: Array<{
    type: ChannelType;
    config: ChannelConfig;
    isActive: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  id: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export interface UpdateUserRequest extends Partial<CreateUserRequest> {}

// Channel configuration types
export type ChannelConfig = 
  | EmailConfig
  | SmsConfig
  | WebhookConfig
  | TelegramConfig
  | SlackConfig
  | LarkConfig;

export interface EmailConfig {
  type: 'email';
  to: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface SmsConfig {
  type: 'sms';
  to: string;
  from?: string;
}

export interface WebhookConfig {
  type: 'webhook';
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number;
}

export interface TelegramConfig {
  type: 'telegram';
  botToken: string;
  chatId: string;
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  disableNotification?: boolean;
}

export interface SlackConfig {
  type: 'slack';
  webhookUrl?: string;
  token?: string;
  channel?: string;
}

export interface LarkConfig {
  type: 'lark';
  webhookUrl?: string;
  appId?: string;
  appSecret?: string;
}

// Log types
export interface NotificationLog {
  id: string;
  notificationId: string;
  userId: string;
  templateKey: string;
  channel: ChannelType;
  status: NotificationStatus;
  variables?: Record<string, any>;
  error?: string;
  retryCount: number;
  sentAt?: string;
  createdAt: string;
}

export interface LogQuery {
  userId?: string;
  templateKey?: string;
  channel?: ChannelType;
  status?: NotificationStatus;
  fromDate?: Date | string;
  toDate?: Date | string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'sentAt';
  sortOrder?: 'asc' | 'desc';
}

// Webhook types
export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
  signature?: string;
}

export enum WebhookEvent {
  NOTIFICATION_SENT = 'notification.sent',
  NOTIFICATION_FAILED = 'notification.failed',
  NOTIFICATION_CLICKED = 'notification.clicked',
  NOTIFICATION_OPENED = 'notification.opened',
  USER_UNSUBSCRIBED = 'user.unsubscribed'
}

// Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}
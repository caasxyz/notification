export type ChannelType = 'lark' | 'webhook' | 'telegram' | 'email' | 'sms';

export interface NotificationRequest {
  user_id: string;
  channels?: ChannelType[];
  template_key?: string;
  variables?: Record<string, unknown>;
  custom_content?: {
    subject?: string;
    content: string;
  };
  idempotency_key?: string;
}

export interface NotificationResponse {
  success: boolean;
  data?: {
    request_id: string;
    results: ChannelResult[];
  };
  error?: string;
}

export interface ChannelResult {
  channelType: ChannelType;
  success: boolean;
  message_id?: string;
  error?: string;
  logId?: number;
}

export interface UserConfig {
  channel_type: ChannelType;
  config: Record<string, unknown>;
  is_active?: boolean;
}

export interface Template {
  name: string;
  description?: string;
  variables?: string[];
  contents?: {
    [channel in ChannelType]?: {
      content_type: 'text' | 'markdown' | 'html' | 'json';
      subject_template?: string;
      content_template: string;
    };
  };
  // Legacy fields for backward compatibility
  subject_template?: string;
  content_template?: string;
  allowed_channels?: ChannelType[];
  default_variables?: Record<string, unknown>;
}

export interface User {
  user_id: string;
  name?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationLog {
  id: number;
  user_id: string;
  request_id: string;
  message_id: string;
  channel_type: ChannelType;
  template_key?: string;
  variables?: Record<string, unknown>;
  content: string;
  subject?: string;
  status: 'pending' | 'sent' | 'failed' | 'retry';
  error_message?: string;
  retry_count: number;
  created_at: string;
  sent_at?: string;
  updated_at: string;
}

export interface LogQueryParams {
  user_id?: string;
  channel?: ChannelType;
  status?: string;
  template_key?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface SDKConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retryConfig?: {
    maxRetries?: number;
    retryDelay?: number;
  };
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

export class NotificationError extends Error {
  public code?: string;
  public details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'NotificationError';
    if (code !== undefined) {
      this.code = code;
    }
    this.details = details;
  }
}
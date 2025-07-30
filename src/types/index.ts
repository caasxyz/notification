export interface Env {
  DB: D1Database;
  RETRY_QUEUE: Queue<RetryMessage>;
  FAILED_QUEUE: Queue<RetryMessage>;
  CONFIG_CACHE: KVNamespace;
  CACHE_KV?: KVNamespace; // Optional for performance optimization
  API_SECRET_KEY: string;
  ENCRYPT_KEY: string;
  
  // Auto-migration settings
  ENVIRONMENT?: string; // 'development', 'staging', 'production'
  AUTO_MIGRATE?: string; // 'true' or 'false'
  FORCE_MIGRATE?: string; // 'true' or 'false' - force migration in production
  
  // Analytics (optional)
  ANALYTICS?: AnalyticsEngineDataset;
  
  // Grafana webhook authentication
  GRAFANA_WEBHOOK_USERNAME?: string;
  GRAFANA_WEBHOOK_PASSWORD?: string;
}

export type NotificationChannel = 'webhook' | 'telegram' | 'lark' | 'slack';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'retry';

export interface SendNotificationRequest {
  user_id: string;
  channels: NotificationChannel[];
  template_key?: string;
  variables?: Record<string, unknown>;
  custom_content?: {
    subject?: string;
    content: string;
  };
  idempotency_key?: string;
  metadata?: Record<string, any>; // For tracking source and additional info
}

export interface NotificationConfig {
  webhook_url?: string;
  bot_token?: string;
  chat_id?: string;
  username?: string;
  channel?: string;
  [key: string]: unknown;
}

export interface UserConfig {
  id: number;
  user_id: string;
  channel_type: NotificationChannel;
  config_data: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationLog {
  id: number;
  message_id: string;
  user_id: string;
  channel_type: NotificationChannel;
  template_key?: string;
  subject?: string;
  content: string;
  status: NotificationStatus;
  retry_count: number;
  error_message?: string;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplate {
  id: number;
  template_key: string;
  template_name: string;
  channel_type: NotificationChannel;
  subject_template?: string;
  content_template: string;
  content_type: 'text' | 'html' | 'markdown';
  variables?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RetryMessage {
  logId: number;
  retryCount: number;
  type: 'retry_notification';
  scheduledAt: number;
  expectedProcessAt: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  results?: NotificationResult[];
}

export interface NotificationResult {
  channelType: NotificationChannel;
  status: NotificationStatus | 'retry_scheduled' | 'retry';
  messageId: string;
  userId: string;
  logId?: number;
  error?: string;
  details?: unknown;
}

export interface IdempotencyKey {
  id: number;
  idempotency_key: string;
  user_id: string;
  message_ids: string;
  created_at: string;
  expires_at: string;
}

export interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

export interface CleanupResult {
  timestamp: string;
  cleanedLogs: number;
  cleanedKeys: number;
  cleanedCache: number;
  duration: number;
  errors: string[];
}

export interface TaskExecutionRecord {
  taskName: string;
  status: 'success' | 'failed';
  details: Record<string, unknown>;
  timestamp: string;
}

export interface SystemConfig {
  config_key: string;
  config_value: string;
  description?: string;
  updated_at: string;
}

export interface PreparedNotification {
  user_id: string;
  channel_type: NotificationChannel;
  config: NotificationConfig;
  subject?: string;
  content: string;
  template_key?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  results?: NotificationResult[];
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    database: boolean;
    queue: boolean;
    cache: boolean;
  };
  version?: string;
}

export interface MetricsData {
  totalSent: number;
  totalFailed: number;
  totalRetries: number;
  successRate: number;
  avgResponseTime: number;
  channelBreakdown: Record<NotificationChannel, {
    sent: number;
    failed: number;
    retries: number;
  }>;
}

export interface ScheduledTaskStatus {
  lastRun?: string;
  nextRun?: string;
  lastResult?: CleanupResult;
  isRunning: boolean;
}

export class NotificationSystemError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'NotificationSystemError';
  }
}

export interface SignatureVerificationOptions {
  timestamp: string | null;
  signature: string | null;
  body: string;
  secretKey: string;
}

export interface QueueMessage<T = unknown> {
  body: T;
  id: string;
  timestamp: Date;
  attempts: number;
}

export interface BatchQueueProcessor<T = unknown> {
  messages: Array<{
    body: T;
    ack: () => void;
    retry: (options?: { delaySeconds?: number }) => void;
  }>;
  queue: string;
  ackAll: () => void;
  retryAll: (options?: { delaySeconds?: number }) => void;
}
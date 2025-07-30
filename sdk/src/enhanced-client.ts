import { NotificationClient } from './client';
import { NotificationBuilder, QuickNotification } from './builder';
import { NotificationPresets } from './presets';
import { SmartChannelSelector } from './smart-channel';
import { 
  SDKConfig, 
  NotificationRequest, 
  NotificationResponse,
  ChannelType,
  NotificationError
} from './types';

/**
 * 增强版通知客户端 - 提供更简单的使用方式
 */
export class EnhancedNotificationClient extends NotificationClient {
  /**
   * 快速通知助手
   */
  public readonly quick: QuickNotification;

  /**
   * 预设模板
   */
  public readonly presets: NotificationPresets;

  /**
   * 智能渠道选择器
   */
  private smartChannel: SmartChannelSelector;

  constructor(config: SDKConfig) {
    super(config);
    this.quick = new QuickNotification(this);
    this.presets = new NotificationPresets(this);
    this.smartChannel = new SmartChannelSelector(this);
  }

  /**
   * 创建通知构建器
   */
  notify(): NotificationBuilder {
    return new NotificationBuilder(this);
  }

  /**
   * 发送通知（增强版，支持智能重试和渠道降级）
   */
  override async sendNotification(request: NotificationRequest): Promise<NotificationResponse> {
    try {
      // 如果没有指定渠道，使用智能渠道选择
      if (!request.channels || request.channels.length === 0) {
        request.channels = await this.smartChannel.selectChannels(request.user_id);
      }

      // 尝试发送通知
      return await super.sendNotification(request);
    } catch (error) {
      // 智能错误处理和渠道降级
      if (error instanceof NotificationError && error.code === 'CHANNEL_ERROR') {
        return this.sendWithFallback(request);
      }
      throw error;
    }
  }

  /**
   * 使用降级渠道发送
   */
  private async sendWithFallback(request: NotificationRequest): Promise<NotificationResponse> {
    const fallbackChannels = this.smartChannel.getFallbackChannels(request.channels ?? []);
    
    if (fallbackChannels.length === 0) {
      throw new NotificationError('All channels failed and no fallback available', 'ALL_CHANNELS_FAILED');
    }

    // 使用降级渠道重试
    const fallbackRequest = { ...request, channels: fallbackChannels };
    return super.sendNotification(fallbackRequest);
  }

  /**
   * 批量发送通知（支持并发控制）
   */
  override async sendBatchNotifications(
    requests: NotificationRequest[],
    options?: { concurrency?: number; stopOnError?: boolean }
  ): Promise<NotificationResponse[]> {
    const concurrency = options?.concurrency ?? 5;
    const stopOnError = options?.stopOnError ?? false;
    const results: NotificationResponse[] = [];
    const errors: Error[] = [];

    // 分批处理
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const promises = batch.map(req => 
        this.sendNotification(req).catch(err => {
          if (stopOnError) throw err;
          errors.push(err as Error);
          return null;
        })
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults.filter(Boolean) as NotificationResponse[]);
    }

    if (errors.length > 0 && !stopOnError) {
      // Notifications failed in batch - errors.length failures
    }

    return results;
  }

  /**
   * 发送并等待送达确认（适用于重要通知）
   */
  async sendAndConfirm(
    request: NotificationRequest,
    options?: { timeout?: number; checkInterval?: number }
  ): Promise<{ response: NotificationResponse; confirmed: boolean }> {
    const timeout = options?.timeout ?? 30000; // 30秒超时
    const checkInterval = options?.checkInterval ?? 5000; // 5秒检查一次

    const response = await this.sendNotification(request);
    const startTime = Date.now();

    // 轮询检查送达状态
    while (Date.now() - startTime < timeout) {
      const logs = await this.logs.query({
        user_id: request.user_id,
        // Note: request_id is not supported in current API
        // We'll check by user_id and status instead
        status: 'sent',
      });

      if (logs.data && logs.data.length > 0) {
        return { response, confirmed: true };
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    return { response, confirmed: false };
  }

  /**
   * 创建通知会话（用于发送一系列相关通知）
   */
  createSession(userId: string, defaultChannels?: ChannelType[]): { send: (content: string, options?: { subject?: string; template?: string; variables?: Record<string, unknown> }) => Promise<NotificationResponse> } {
    return {
      send: (content: string, options?: { subject?: string; template?: string; variables?: Record<string, unknown> }) => {
        const request: NotificationRequest = {
          user_id: userId,
          channels: defaultChannels ?? ['email'],
          custom_content: {
            content,
            ...(options?.subject !== undefined && options.subject !== null && options.subject !== '' ? { subject: options.subject } : {}),
          },
        };
        
        if (options?.template !== undefined && options.template !== null && options.template !== '') {
          request.template_key = options.template;
          delete request.custom_content;
          if (options.variables) {
            request.variables = options.variables;
          }
        }

        return this.sendNotification(request);
      },

      email: (subject: string, content: string) => 
        this.quick.email(userId, subject, content),

      lark: (content: string) => 
        this.quick.lark(userId, content),

      fromTemplate: (templateKey: string, variables?: Record<string, unknown>) =>
        this.quick.fromTemplate(userId, templateKey, variables),
    };
  }
}
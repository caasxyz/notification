import { NotificationClient } from './client';
import { NotificationRequest, NotificationResponse, ChannelType } from './types';

/**
 * 通知构建器 - 提供链式调用接口简化通知发送
 */
export class NotificationBuilder {
  private request: Partial<NotificationRequest> = {};
  private client: NotificationClient;

  constructor(client: NotificationClient) {
    this.client = client;
  }

  /**
   * 设置接收用户
   */
  to(userId: string): this {
    this.request.user_id = userId;
    return this;
  }

  /**
   * 设置通知渠道
   * @param channels 单个渠道或多个渠道
   */
  via(...channels: ChannelType[]): this {
    this.request.channels = channels;
    return this;
  }

  /**
   * 使用模板发送
   * @param templateKey 模板键名
   * @param variables 模板变量
   */
  useTemplate(templateKey: string, variables?: Record<string, unknown>): this {
    this.request.template_key = templateKey;
    if (variables) {
      this.request.variables = variables;
    }
    return this;
  }

  /**
   * 设置通知内容（非模板方式）
   */
  content(content: string, subject?: string): this {
    this.request.custom_content = {
      content,
      ...(subject !== undefined && subject !== null && subject !== '' ? { subject } : {})
    };
    return this;
  }

  /**
   * 设置通知主题（邮件等渠道使用）
   */
  subject(subject: string): this {
    if (!this.request.custom_content) {
      this.request.custom_content = { content: '' };
    }
    this.request.custom_content.subject = subject;
    return this;
  }

  /**
   * 设置模板变量
   */
  with(variables: Record<string, unknown>): this {
    this.request.variables = { ...this.request.variables, ...variables };
    return this;
  }

  /**
   * 设置幂等性键，防止重复发送
   */
  idempotent(key: string): this {
    this.request.idempotency_key = key;
    return this;
  }

  /**
   * 添加自定义元数据
   */
  metadata(data: Record<string, unknown>): this {
    // NotificationRequest doesn't have metadata field, 
    // but we can add it to variables for tracking
    this.request.variables = { 
      ...this.request.variables, 
      _metadata: data 
    };
    return this;
  }

  /**
   * 发送通知
   */
  async send(): Promise<NotificationResponse> {
    // 验证必填字段
    if (this.request.user_id === undefined || this.request.user_id === null || this.request.user_id === '') {
      throw new Error('User ID is required. Use .to(userId) to set it.');
    }

    if (!this.request.channels || this.request.channels.length === 0) {
      throw new Error('At least one channel is required. Use .via(...channels) to set channels.');
    }

    if ((this.request.template_key === undefined || this.request.template_key === null || this.request.template_key === '') && 
        (this.request.custom_content === undefined || this.request.custom_content === null)) {
      throw new Error('Either template or content is required. Use .useTemplate() or .content().');
    }

    return this.client.sendNotification(this.request as NotificationRequest);
  }

  /**
   * 发送并返回构建器以支持连续发送
   */
  async sendAndContinue(): Promise<this> {
    await this.send();
    // 清除请求数据，但保留 client 引用
    this.request = {};
    return this;
  }
}

/**
 * 快速通知助手 - 提供更简单的一次性通知发送方法
 */
export class QuickNotification {
  private client: NotificationClient;

  constructor(client: NotificationClient) {
    this.client = client;
  }

  /**
   * 发送 Webhook 通知
   */
  async webhook(userId: string, content: string, data?: Record<string, unknown>): Promise<NotificationResponse> {
    return this.client.sendNotification({
      user_id: userId,
      channels: ['webhook'],
      custom_content: {
        content,
        ...(data ? { data } : {}),
      },
    });
  }

  /**
   * 发送飞书通知
   */
  async lark(userId: string, content: string): Promise<NotificationResponse> {
    return this.client.sendNotification({
      user_id: userId,
      channels: ['lark'],
      custom_content: {
        content,
      },
    });
  }

  /**
   * 发送 Telegram 通知
   */
  async telegram(userId: string, content: string): Promise<NotificationResponse> {
    return this.client.sendNotification({
      user_id: userId,
      channels: ['telegram'],
      custom_content: {
        content,
      },
    });
  }


  /**
   * 使用模板发送通知到所有配置的渠道
   */
  async fromTemplate(
    userId: string,
    templateKey: string,
    variables?: Record<string, unknown>
  ): Promise<NotificationResponse> {
    // 获取用户配置的所有渠道
    const configs = await this.client.configs.list(userId);
    const channels = configs.data?.map(c => c.channel_type).filter(Boolean) ?? ['webhook'];

    return this.client.sendNotification({
      user_id: userId,
      channels,
      template_key: templateKey,
      ...(variables ? { variables } : {}),
    });
  }
}
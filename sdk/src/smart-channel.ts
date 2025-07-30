import { NotificationClient } from './client';
import { ChannelType } from './types';

/**
 * 智能渠道选择器 - 根据用户配置和渠道状态自动选择最佳渠道
 */
export class SmartChannelSelector {
  // 渠道优先级配置
  private channelPriority: Record<string, ChannelType[]> = {
    urgent: ['telegram', 'lark', 'email', 'webhook'],
    normal: ['email', 'lark', 'telegram', 'webhook'],
    marketing: ['email', 'webhook'],
    transactional: ['email', 'telegram', 'lark'],
  };

  // 渠道降级映射
  private fallbackMap: Record<ChannelType, ChannelType[]> = {
    email: ['lark', 'telegram', 'webhook'],
    lark: ['email', 'telegram', 'webhook'],
    telegram: ['lark', 'email', 'webhook'],
    webhook: ['email', 'lark', 'telegram'],
    sms: ['telegram', 'email'],
  };

  constructor(private client: NotificationClient) {}

  /**
   * 智能选择通知渠道
   */
  async selectChannels(
    userId: string,
    options?: {
      priority?: 'urgent' | 'normal' | 'marketing' | 'transactional';
      preferredChannels?: ChannelType[];
      maxChannels?: number;
    }
  ): Promise<ChannelType[]> {
    // 获取用户配置的渠道
    const userConfigs = await this.client.configs.list(userId);
    const activeChannels = userConfigs.data
      ?.filter(config => config.is_active)
      .map(config => config.channel_type) ?? [];

    if (activeChannels.length === 0) {
      // 如果用户没有配置渠道，返回默认渠道
      return ['email'];
    }

    // 根据优先级排序渠道
    const priority = options?.priority ?? 'normal';
    const priorityChannels = this.channelPriority[priority] ?? this.channelPriority['normal'];
    
    // 过滤出用户已配置且在优先级列表中的渠道
    let selectedChannels = priorityChannels?.filter(channel => 
      activeChannels.includes(channel)
    ) ?? [];

    // 如果有偏好渠道，优先使用
    if (options?.preferredChannels) {
      const preferred = options.preferredChannels.filter(channel =>
        activeChannels.includes(channel)
      );
      // 将偏好渠道放在前面
      selectedChannels = [
        ...preferred,
        ...selectedChannels.filter(ch => !preferred.includes(ch))
      ];
    }

    // 限制渠道数量
    if (options?.maxChannels && selectedChannels.length > options.maxChannels) {
      selectedChannels = selectedChannels.slice(0, options.maxChannels);
    }

    return selectedChannels.length > 0 ? selectedChannels : ['email'];
  }

  /**
   * 获取降级渠道
   */
  getFallbackChannels(failedChannels: ChannelType[]): ChannelType[] {
    const fallbackChannels = new Set<ChannelType>();

    // 为每个失败的渠道找到降级选项
    for (const channel of failedChannels) {
      const fallbacks = this.fallbackMap[channel] ?? [];
      for (const fallback of fallbacks) {
        if (!failedChannels.includes(fallback)) {
          fallbackChannels.add(fallback);
        }
      }
    }

    return Array.from(fallbackChannels);
  }

  /**
   * 根据内容类型推荐渠道
   */
  recommendChannelsByContent(content: {
    hasAttachment?: boolean;
    isMarkdown?: boolean;
    isHtml?: boolean;
    length?: number;
    hasImage?: boolean;
  }): ChannelType[] {
    const recommended: ChannelType[] = [];

    // 邮件适合所有类型的内容
    recommended.push('email');

    // Lark 支持 Markdown 和富文本
    if (content.isMarkdown || content.hasImage) {
      recommended.push('lark');
    }

    // Telegram 支持 Markdown 但有长度限制
    if (!content.hasAttachment && (!content.length || content.length < 4096)) {
      recommended.push('telegram');
    }

    // Webhook 适合结构化数据
    recommended.push('webhook');

    return recommended;
  }

  /**
   * 根据时间和紧急程度选择渠道
   */
  selectChannelsByUrgency(urgencyLevel: 'immediate' | 'high' | 'normal' | 'low'): ChannelType[] {
    switch (urgencyLevel) {
      case 'immediate':
        return ['telegram', 'lark', 'webhook']; // 实时渠道
      case 'high':
        return ['telegram', 'lark', 'email'];
      case 'normal':
        return ['email', 'lark'];
      case 'low':
        return ['email']; // 非实时渠道
      default:
        return ['email'];
    }
  }

  /**
   * 设置自定义渠道优先级
   */
  setChannelPriority(scenario: string, channels: ChannelType[]): void {
    this.channelPriority[scenario] = channels;
  }

  /**
   * 设置自定义降级规则
   */
  setFallbackRule(channel: ChannelType, fallbacks: ChannelType[]): void {
    this.fallbackMap[channel] = fallbacks;
  }
}
import { NotificationClient } from './client';
import { NotificationResponse, ChannelType } from './types';

/**
 * 预设通知模板 - 提供常用通知场景的快速方法
 */
export class NotificationPresets {
  constructor(private client: NotificationClient) {}

  /**
   * 发送欢迎通知
   */
  async welcome(userId: string, userName: string, extra?: Record<string, unknown>): Promise<NotificationResponse> {
    return this.client.sendNotification({
      user_id: userId,
      channels: ['email', 'lark'],
      template_key: 'welcome',
      variables: {
        name: userName,
        ...extra,
      },
    });
  }

  /**
   * 发送密码重置通知
   */
  async passwordReset(userId: string, resetLink: string, expiresIn = '24 hours'): Promise<NotificationResponse> {
    return this.client.sendNotification({
      user_id: userId,
      channels: ['email'],
      template_key: 'password_reset',
      variables: {
        reset_link: resetLink,
        expires_in: expiresIn,
      },
    });
  }

  /**
   * 发送订单状态更新
   */
  async orderUpdate(
    userId: string,
    orderId: string,
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled',
    details?: Record<string, unknown>
  ): Promise<NotificationResponse> {
    return this.client.sendNotification({
      user_id: userId,
      channels: ['email', 'lark', 'telegram'],
      template_key: `order_${status}`,
      variables: {
        order_id: orderId,
        status,
        ...details,
      },
    });
  }

  /**
   * 发送支付成功通知
   */
  async paymentSuccess(
    userId: string,
    amount: number,
    currency: string,
    transactionId: string
  ): Promise<NotificationResponse> {
    return this.client.sendNotification({
      user_id: userId,
      channels: ['email', 'lark'],
      template_key: 'payment_success',
      variables: {
        amount,
        currency,
        transaction_id: transactionId,
        formatted_amount: `${currency} ${amount.toFixed(2)}`,
      },
    });
  }

  /**
   * 发送安全警告
   */
  async securityAlert(
    userId: string,
    alertType: 'login' | 'password_change' | 'suspicious_activity',
    details: {
      ip?: string;
      location?: string;
      device?: string;
      timestamp?: string;
    }
  ): Promise<NotificationResponse> {
    return this.client.sendNotification({
      user_id: userId,
      channels: ['email', 'telegram'], // 安全通知优先使用可靠渠道
      template_key: `security_${alertType}`,
      variables: {
        alert_type: alertType,
        ...details,
        timestamp: details.timestamp ?? new Date().toISOString(),
      },
    });
  }

  /**
   * 发送系统维护通知
   */
  async maintenance(
    userId: string,
    maintenanceWindow: {
      start: Date | string;
      end: Date | string;
      description?: string;
    }
  ): Promise<NotificationResponse> {
    return this.client.sendNotification({
      user_id: userId,
      channels: ['email', 'lark', 'webhook'],
      template_key: 'system_maintenance',
      variables: {
        start_time: maintenanceWindow.start,
        end_time: maintenanceWindow.end,
        description: maintenanceWindow.description ?? 'System maintenance',
      },
    });
  }

  /**
   * 发送自定义告警
   */
  async alert(
    userId: string,
    severity: 'info' | 'warning' | 'error' | 'critical',
    title: string,
    message: string,
    details?: Record<string, unknown>
  ): Promise<NotificationResponse> {
    // 根据严重程度选择渠道
    const channelsBySeverity: Record<string, ChannelType[]> = {
      info: ['email'],
      warning: ['email', 'lark'],
      error: ['email', 'lark', 'telegram'],
      critical: ['email', 'lark', 'telegram', 'webhook'],
    };

    return this.client.sendNotification({
      user_id: userId,
      channels: channelsBySeverity[severity] ?? ['email'],
      template_key: 'alert',
      variables: {
        severity,
        title,
        message,
        ...details,
      },
    });
  }

  /**
   * 发送验证码
   */
  async verificationCode(
    userId: string,
    code: string,
    purpose: 'login' | 'register' | 'reset_password' | 'transaction',
    expiresInMinutes = 5
  ): Promise<NotificationResponse> {
    return this.client.sendNotification({
      user_id: userId,
      channels: ['email', 'telegram'], // 验证码使用快速渠道
      template_key: 'verification_code',
      variables: {
        code,
        purpose,
        expires_in: expiresInMinutes,
        expires_at: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
      },
      // 验证码通知设置幂等性键，防止重复发送
      idempotency_key: `verification_${userId}_${purpose}_${code}`,
    });
  }

  /**
   * 发送每日/每周/每月报告
   */
  async report(
    userId: string,
    reportType: 'daily' | 'weekly' | 'monthly',
    reportData: {
      period: string;
      metrics: Record<string, unknown>;
      summary?: string;
    }
  ): Promise<NotificationResponse> {
    return this.client.sendNotification({
      user_id: userId,
      channels: ['email'],
      template_key: `report_${reportType}`,
      variables: {
        report_type: reportType,
        ...reportData,
      },
    });
  }
}
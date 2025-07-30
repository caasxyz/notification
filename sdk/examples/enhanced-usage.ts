import { EnhancedNotificationClient } from '../src';

// 初始化增强版客户端
const client = new EnhancedNotificationClient({
  baseUrl: 'https://your-notification-api.com',
  apiKey: 'your-api-key',
});

async function examples() {
  // 示例 1: 使用链式调用发送通知
  await client
    .notify()
    .to('user123')
    .via('email', 'lark')
    .subject('Order Confirmation')
    .content('Your order #12345 has been confirmed!')
    .idempotent('order-12345-confirmed')
    .send();

  // 示例 2: 使用模板和变量
  await client
    .notify()
    .to('user456')
    .via('email')
    .useTemplate('order_shipped', {
      order_id: 'ORD-12345',
      tracking_number: 'TRK-67890',
      estimated_delivery: '2024-01-15',
    })
    .send();

  // 示例 3: 快速发送邮件
  await client.quick.email(
    'user789',
    'Welcome to our service!',
    'Thank you for signing up. We are excited to have you on board!'
  );

  // 示例 4: 使用预设模板
  await client.presets.welcome('new-user', 'John Doe', {
    company: 'Acme Corp',
    trial_days: 30,
  });

  // 示例 5: 发送验证码
  await client.presets.verificationCode(
    'user123',
    '123456',
    'login',
    5 // 5分钟过期
  );

  // 示例 6: 发送安全警告
  await client.presets.securityAlert('user123', 'suspicious_activity', {
    ip: '192.168.1.1',
    location: 'New York, US',
    device: 'Chrome on Windows',
  });

  // 示例 7: 批量发送带并发控制
  const notifications = [
    { user_id: 'user1', channels: ['email'], content: 'Message 1' },
    { user_id: 'user2', channels: ['lark'], content: 'Message 2' },
    { user_id: 'user3', channels: ['telegram'], content: 'Message 3' },
  ];

  await client.sendBatchNotifications(notifications, {
    concurrency: 2, // 每次最多发送2个
    stopOnError: false, // 遇到错误继续发送
  });

  // 示例 8: 创建会话连续发送
  const session = client.createSession('user123', ['email', 'lark']);
  
  await session.send('Your order has been received');
  await session.send('Payment confirmed', { subject: 'Payment Success' });
  await session.fromTemplate('order_processing', { order_id: '12345' });

  // 示例 9: 发送并确认送达（重要通知）
  const { response, confirmed } = await client.sendAndConfirm({
    user_id: 'user123',
    channels: ['email'],
    content: 'Critical security update required',
    subject: 'Security Alert',
  }, {
    timeout: 60000, // 等待60秒
    checkInterval: 5000, // 每5秒检查一次
  });

  console.log('Notification sent:', response);
  console.log('Delivery confirmed:', confirmed);

  // 示例 10: 根据紧急程度发送告警
  await client.presets.alert(
    'admin-user',
    'critical',
    'Database Connection Failed',
    'Unable to connect to primary database',
    {
      server: 'db-primary-1',
      error: 'Connection timeout',
      timestamp: new Date().toISOString(),
    }
  );
}

// 错误处理示例
async function errorHandlingExample() {
  try {
    await client
      .notify()
      .to('user123')
      .via('email', 'lark')
      .content('Test notification')
      .send();
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to send notification:', error.message);
      
      // SDK 会自动尝试降级渠道，但你也可以手动处理
      try {
        // 尝试使用备用渠道
        await client.quick.webhook('user123', 'Test notification (fallback)');
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
  }
}

// 高级用法：自定义智能渠道选择
async function advancedChannelSelection() {
  // 为特定场景设置渠道优先级
  const smartChannel = client['smartChannel'];
  smartChannel.setChannelPriority('payment', ['telegram', 'email', 'lark']);
  smartChannel.setFallbackRule('telegram', ['email', 'webhook']);

  // 现在发送支付通知会优先使用 Telegram
  await client.presets.paymentSuccess(
    'user123',
    99.99,
    'USD',
    'TXN-12345'
  );
}

// 运行示例
examples().catch(console.error);
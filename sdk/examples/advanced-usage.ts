import { NotificationClient, LogQueryParams } from '../src';

const client = new NotificationClient({
  baseUrl: 'https://your-notification-api.com',
  apiKey: 'your-api-key',
});

async function advancedUsageExample() {
  try {
    // 1. Query notification logs with filters
    const logs = await client.logs.query({
      user_id: 'user123',
      channel: 'email',
      status: 'sent',
      start_date: new Date('2024-01-01').toISOString(),
      end_date: new Date().toISOString(),
      limit: 50,
      offset: 0,
    });

    console.log('Notification logs:', logs);

    // 2. Get logs by request ID
    const requestLogs = await client.logs.getByRequestId('req_123456');
    console.log('Logs for request:', requestLogs);

    // 3. Get retry statistics
    const retryStats = await client.retry.getStats('user123');
    console.log('Retry statistics:', retryStats);

    // 4. Trigger manual retry for failed notifications
    const retryResult = await client.retry.trigger();
    console.log('Manual retry triggered:', retryResult);

    // 5. Clean up old logs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const cleanupResult = await client.logs.cleanup(thirtyDaysAgo);
    console.log('Cleanup result:', cleanupResult);

    // 6. Health check
    const health = await client.health();
    console.log('API health:', health);

    // 7. Complex notification with all options
    const complexNotification = await client.sendNotification({
      user_id: 'user123',
      channels: ['email', 'lark', 'telegram'],
      template_key: 'order_confirmation',
      variables: {
        order_id: 'ORD-12345',
        customer_name: 'John Doe',
        items: [
          { name: 'Product A', quantity: 2, price: 29.99 },
          { name: 'Product B', quantity: 1, price: 49.99 },
        ],
        total: 109.97,
        delivery_date: '2024-01-15',
      },
      idempotency_key: `order-confirmation-ORD-12345`,
    });

    console.log('Complex notification sent:', complexNotification);

    // 8. Monitor notification delivery
    if (complexNotification.data) {
      const requestId = complexNotification.data.request_id;
      
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check delivery status
      const deliveryLogs = await client.logs.getByRequestId(requestId);
      
      deliveryLogs.data?.forEach(log => {
        console.log(`Channel ${log.channel_type}: ${log.status}`);
        if (log.error_message) {
          console.log(`  Error: ${log.error_message}`);
        }
      });
    }

    // 9. Bulk user configuration
    const users = ['user1', 'user2', 'user3'];
    const channelConfig = {
      lark: {
        webhook_url: 'https://open.larksuite.com/open-apis/bot/v2/hook/xxx',
        secret: 'shared-secret',
      },
    };

    for (const userId of users) {
      await client.configs.set(userId, 'lark', {
        channel_type: 'lark',
        config: channelConfig.lark,
        is_active: true,
      });
    }

    console.log('Bulk configuration completed');

    // 10. Analytics query
    async function getNotificationAnalytics(userId: string, days = 7) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const logs = await client.logs.query({
        user_id: userId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        limit: 1000,
      });

      if (!logs.data) return null;

      const analytics = {
        total: logs.data.length,
        sent: logs.data.filter(l => l.status === 'sent').length,
        failed: logs.data.filter(l => l.status === 'failed').length,
        pending: logs.data.filter(l => l.status === 'pending').length,
        retry: logs.data.filter(l => l.status === 'retry').length,
        byChannel: {} as Record<string, number>,
        byTemplate: {} as Record<string, number>,
      };

      logs.data.forEach(log => {
        // Count by channel
        analytics.byChannel[log.channel_type] = 
          (analytics.byChannel[log.channel_type] || 0) + 1;
        
        // Count by template
        if (log.template_key) {
          analytics.byTemplate[log.template_key] = 
            (analytics.byTemplate[log.template_key] || 0) + 1;
        }
      });

      return analytics;
    }

    const analytics = await getNotificationAnalytics('user123', 30);
    console.log('Notification analytics:', analytics);

  } catch (error) {
    console.error('Error in advanced usage:', error);
  }
}

advancedUsageExample();
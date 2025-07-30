import { NotificationClient } from '../src';

// Initialize the client
const client = new NotificationClient({
  baseUrl: 'https://your-notification-api.com',
  apiKey: 'your-api-key', // Optional, if your API requires authentication
  timeout: 30000, // 30 seconds
  retryConfig: {
    maxRetries: 3,
    retryDelay: 1000, // 1 second
  },
});

async function main() {
  try {
    // 1. Send a simple notification
    const response = await client.sendNotification({
      user_id: 'user123',
      channels: ['email', 'lark'],
      content: 'Hello, this is a test notification!',
      subject: 'Test Notification',
    });

    console.log('Notification sent:', response);

    // 2. Send notification using template
    const templateResponse = await client.sendNotification({
      user_id: 'user123',
      channels: ['email'],
      template_key: 'welcome_email',
      variables: {
        name: 'John Doe',
        company: 'Acme Corp',
      },
    });

    console.log('Template notification sent:', templateResponse);

    // 3. Send batch notifications
    const batchResults = await client.sendBatchNotifications([
      {
        user_id: 'user1',
        channels: ['lark'],
        content: 'Notification for user 1',
      },
      {
        user_id: 'user2',
        channels: ['telegram'],
        content: 'Notification for user 2',
      },
    ]);

    console.log('Batch notifications sent:', batchResults);

    // 4. Use idempotency key to prevent duplicates
    const idempotentResponse = await client.sendNotification({
      user_id: 'user123',
      channels: ['webhook'],
      content: 'Important notification',
      idempotency_key: 'unique-key-12345',
    });

    console.log('Idempotent notification sent:', idempotentResponse);

  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

main();
import { NotificationClient, NotificationError } from '../src';

const client = new NotificationClient({
  baseUrl: 'https://your-notification-api.com',
  apiKey: 'your-api-key',
});

async function errorHandlingExample() {
  try {
    // Attempt to send notification
    await client.sendNotification({
      user_id: 'invalid_user',
      channels: ['email'],
      content: 'Test notification',
    });
  } catch (error) {
    if (error instanceof NotificationError) {
      // Handle specific notification errors
      console.error('Notification Error:', {
        message: error.message,
        code: error.code,
        details: error.details,
      });

      // Handle different error codes
      switch (error.code) {
        case 'USER_NOT_FOUND':
          console.log('User does not exist, creating new user...');
          // Create user and retry
          break;
        
        case 'INVALID_CHANNEL':
          console.log('Invalid channel specified');
          break;
        
        case 'RATE_LIMIT_EXCEEDED':
          console.log('Rate limit hit, waiting before retry...');
          // Implement exponential backoff
          break;
        
        case 'TIMEOUT':
          console.log('Request timed out');
          break;
        
        default:
          console.log('Unknown error occurred');
      }
    } else {
      // Handle other errors
      console.error('Unexpected error:', error);
    }
  }

  // Handle batch errors
  try {
    const results = await client.sendBatchNotifications([
      { user_id: 'user1', channels: ['email'], content: 'Notification 1' },
      { user_id: 'user2', channels: ['invalid'], content: 'Notification 2' },
      { user_id: 'user3', channels: ['lark'], content: 'Notification 3' },
    ]);

    // Check individual results
    results.forEach((result, index) => {
      if (!result.success) {
        console.error(`Notification ${index + 1} failed:`, result.error);
      } else {
        console.log(`Notification ${index + 1} sent successfully`);
      }
    });
  } catch (error) {
    console.error('Batch send failed:', error);
  }

  // Implement retry logic
  async function sendWithRetry(
    request: Parameters<typeof client.sendNotification>[0],
    maxRetries = 3
  ) {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await client.sendNotification(request);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.log(`Attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  // Use the retry function
  try {
    const result = await sendWithRetry({
      user_id: 'user123',
      channels: ['email'],
      content: 'Important notification with retry',
    });
    console.log('Notification sent with retry:', result);
  } catch (error) {
    console.error('All retry attempts failed:', error);
  }
}

errorHandlingExample();
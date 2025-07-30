import { NotificationSDK, ChannelType, NotificationPriority } from '../src/v2';

async function main() {
  // Initialize SDK with configuration
  const sdk = new NotificationSDK({
    baseUrl: 'https://api.notification.example.com',
    apiKey: 'your-api-key',
    environment: 'production'
  }, {
    // Optional client configuration
    retry: {
      maxRetries: 3,
      backoffMultiplier: 2
    },
    rateLimit: {
      maxRequests: 100,
      windowMs: 60000
    },
    debug: true
  });

  // Event listeners
  sdk.on('request:start', (request) => {
    console.log('Starting request:', request.url);
  });

  sdk.on('rate:limited', (retryAfter) => {
    console.log(`Rate limited! Retry after ${retryAfter} seconds`);
  });

  sdk.on('retry:attempt', (attempt, error) => {
    console.log(`Retry attempt ${attempt} due to:`, error.message);
  });

  try {
    // 1. Send a simple notification
    const notification = await sdk.notifications.send({
      userId: 'user123',
      templateKey: 'welcome-email',
      channel: ChannelType.EMAIL,
      variables: {
        name: 'John Doe',
        company: 'Acme Corp'
      }
    });
    console.log('Notification sent:', notification.notificationId);

    // 2. Use fluent builder API
    const result = await sdk.notifications
      .builder()
      .to('user456')
      .template('order-confirmation')
      .channel(ChannelType.SMS)
      .variables({
        orderNumber: '12345',
        amount: '$99.99'
      })
      .priority(NotificationPriority.HIGH)
      .send();

    // 3. Send batch notifications
    const batchResult = await sdk.notifications.sendBatch({
      notifications: [
        {
          userId: 'user1',
          templateKey: 'promotion',
          channel: ChannelType.EMAIL,
          variables: { discount: '20%' }
        },
        {
          userId: 'user2',
          templateKey: 'promotion',
          channel: ChannelType.SMS,
          variables: { discount: '20%' }
        }
      ],
      strategy: 'parallel',
      stopOnError: false
    });

    console.log(`Batch sent: ${batchResult.summary.successful} successful, ${batchResult.summary.failed} failed`);

    // 4. Template management
    const templates = await sdk.templates.list({
      isActive: true,
      channel: ChannelType.EMAIL
    });

    // Create a new template
    const newTemplate = await sdk.templates.create({
      key: 'monthly-newsletter',
      name: 'Monthly Newsletter',
      description: 'Monthly newsletter for subscribers',
      variables: ['name', 'month', 'articles'],
      channels: [
        {
          type: ChannelType.EMAIL,
          subjectTemplate: '{{month}} Newsletter - Latest Updates',
          contentTemplate: 'Hello {{name}}, here are this month\'s articles: {{articles}}',
          contentType: 'html'
        }
      ]
    });

    // Preview template
    const preview = await sdk.templates.preview(
      'monthly-newsletter',
      {
        name: 'John',
        month: 'December',
        articles: '<ul><li>Article 1</li><li>Article 2</li></ul>'
      },
      ChannelType.EMAIL
    );

    // 5. User management
    await sdk.users.create({
      id: 'user789',
      email: 'john@example.com',
      metadata: {
        timezone: 'America/New_York',
        language: 'en'
      }
    });

    // Configure channels for user
    await sdk.configs.set('user789', ChannelType.EMAIL, {
      type: 'email',
      to: 'john@example.com',
      from: 'noreply@company.com'
    });

    await sdk.configs.set('user789', ChannelType.SMS, {
      type: 'sms',
      to: '+1234567890'
    });

    // 6. Query notification logs
    const logs = await sdk.logs.query({
      userId: 'user789',
      fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      status: 'sent',
      limit: 10
    });

    // 7. Webhook validation (for receiving webhooks)
    const isValid = await sdk.webhooks.verify(
      webhookHeaders,
      webhookBody
    );

    if (isValid) {
      const payload = sdk.webhooks.parse(webhookBody);
      console.log('Webhook event:', payload.event);
    }

    // 8. Advanced: Add custom interceptors
    sdk.addRequestInterceptor(async (request) => {
      // Add custom header
      request.headers.set('X-Custom-Header', 'value');
      return request;
    });

    sdk.addResponseInterceptor(async (response) => {
      // Log response time
      console.log(`Response received in ${Date.now()}ms`);
      return response;
    });

    // 9. Error handling
    sdk.setErrorHandler(async (error, request, retry) => {
      if (error.code === 'NETWORK_ERROR') {
        console.log('Network error, retrying...');
        return retry();
      }
      
      // Custom error reporting
      console.error('API Error:', {
        url: request.url,
        status: error.statusCode,
        code: error.code,
        message: error.message
      });
      
      throw error;
    });

    // 10. Health check
    const health = await sdk.healthCheck();
    console.log('API Status:', health.status);

  } catch (error) {
    console.error('Error:', error);
  }
}

// TypeScript types are fully supported
async function sendTypedNotification(sdk: NotificationSDK) {
  // Full type safety and autocomplete
  const response = await sdk.notifications.send({
    userId: 'user123',
    templateKey: 'welcome',
    channel: ChannelType.EMAIL, // Enum with autocomplete
    variables: {
      name: 'John',
      // TypeScript will show available variables based on template
    },
    priority: NotificationPriority.HIGH,
    metadata: {
      source: 'signup-form',
      campaign: 'summer-2024'
    }
  });

  // Response is fully typed
  console.log(response.notificationId); // string
  console.log(response.status); // NotificationStatus enum
}

main().catch(console.error);
# Notification System TypeScript SDK

A TypeScript SDK for interacting with the Notification System API. This SDK provides a simple and type-safe way to send notifications, manage users, templates, and configurations.

## Installation

由于 SDK 通过 GitHub Packages 发布，安装前需要先配置认证。

### 1. 配置 GitHub Packages 认证

创建 `.npmrc` 文件配置 GitHub Packages 认证：

```bash
# 指定 @caasxyz 使用 GitHub Packages
echo "@caasxyz:registry=https://npm.pkg.github.com" > .npmrc

# 添加你的 GitHub Personal Access Token
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc
```

**获取 GitHub Token**：
1. 访问 https://github.com/settings/tokens/new
2. 创建新 token，勾选 `read:packages` 权限
3. 复制 token 替换上面的 YOUR_GITHUB_TOKEN

### 2. 安装 SDK

```bash
npm install @caasxyz/notification-sdk
# or
yarn add @caasxyz/notification-sdk
```

## Quick Start

```typescript
import { NotificationClient } from '@caasxyz/notification-sdk';

// Initialize the client
const client = new NotificationClient({
  baseUrl: 'https://your-notification-api.com',
  apiKey: 'your-api-key', // Optional
});

// Send a notification
const response = await client.sendNotification({
  user_id: 'user123',
  channels: ['email', 'lark'],
  content: 'Hello from Notification SDK!',
  subject: 'Test Notification',
});
```

## Features

- 🚀 **Simple API** - Intuitive methods for all notification operations
- 📦 **TypeScript Support** - Full type definitions for better IDE support
- 🔄 **Automatic Retry** - Built-in retry logic for failed requests
- 🔐 **Webhook Validation** - HMAC signature validation utilities
- 📝 **Template Support** - Manage and render notification templates
- 👥 **User Management** - Create and manage users and their configurations
- 📊 **Logging & Analytics** - Query notification logs and statistics
- ⚡ **Batch Operations** - Send multiple notifications efficiently

## Configuration

### Client Options

```typescript
const client = new NotificationClient({
  baseUrl: 'https://api.example.com',    // Required: API base URL
  apiKey: 'your-api-key',                 // Optional: API key for authentication
  timeout: 30000,                         // Optional: Request timeout in ms (default: 30000)
  retryConfig: {
    maxRetries: 3,                        // Optional: Max retry attempts (default: 3)
    retryDelay: 1000,                     // Optional: Initial retry delay in ms (default: 1000)
  },
});
```

## Core Features

### 1. Sending Notifications

#### Simple Notification
```typescript
await client.sendNotification({
  user_id: 'user123',
  channels: ['email'],
  content: 'Your order has been shipped!',
  subject: 'Order Update',
});
```

#### Template-based Notification
```typescript
await client.sendNotification({
  user_id: 'user123',
  channels: ['email', 'lark'],
  template_key: 'order_shipped',
  variables: {
    order_id: 'ORD-12345',
    tracking_number: 'TRK-67890',
    estimated_delivery: '2024-01-15',
  },
});
```

#### Idempotent Notification
```typescript
await client.sendNotification({
  user_id: 'user123',
  channels: ['webhook'],
  content: 'Payment received',
  idempotency_key: 'payment-12345', // Prevents duplicate sends
});
```

#### Batch Notifications
```typescript
const results = await client.sendBatchNotifications([
  { user_id: 'user1', channels: ['email'], content: 'Message 1' },
  { user_id: 'user2', channels: ['lark'], content: 'Message 2' },
  { user_id: 'user3', channels: ['telegram'], content: 'Message 3' },
]);
```

### 2. User Management

#### Create User
```typescript
await client.users.create({
  user_id: 'user123',
  name: 'John Doe',
  email: 'john@example.com',
  metadata: {
    department: 'Sales',
    role: 'Manager',
  },
});
```

#### Configure Channels
```typescript
// Configure Email
await client.configs.set('user123', 'email', {
  channel_type: 'email',
  config: {
    email: 'john@example.com',
  },
  is_active: true,
});

// Configure Lark
await client.configs.set('user123', 'lark', {
  channel_type: 'lark',
  config: {
    webhook_url: 'https://open.larksuite.com/open-apis/bot/v2/hook/xxx',
    secret: 'your-secret',
  },
  is_active: true,
});

// Configure Telegram
await client.configs.set('user123', 'telegram', {
  channel_type: 'telegram',
  config: {
    bot_token: 'your-bot-token',
    chat_id: 'chat-id',
  },
  is_active: true,
});
```

### 3. Template Management

#### Create Template
```typescript
await client.templates.create('welcome_email', {
  name: 'Welcome Email',
  description: 'Sent to new users',
  subject_template: 'Welcome to {{company}}, {{name}}!',
  content_template: 'Hello {{name}}, welcome aboard!',
  allowed_channels: ['email', 'lark'],
  default_variables: {
    company: 'Acme Corp',
  },
});
```

#### Render Template
```typescript
const rendered = await client.templates.render('welcome_email', {
  name: 'John Doe',
  company: 'Tech Co',
});
```

### 4. Notification Logs

#### Query Logs
```typescript
const logs = await client.logs.query({
  user_id: 'user123',
  channel: 'email',
  status: 'sent',
  start_date: '2024-01-01T00:00:00Z',
  end_date: '2024-01-31T23:59:59Z',
  limit: 100,
  offset: 0,
});
```

#### Get Retry Statistics
```typescript
const stats = await client.retry.getStats('user123');
console.log(stats);
// { totalRetries: 5, failedAfterRetries: 2, pendingRetries: 1 }
```

### 5. Webhook Validation

```typescript
import { verifyHmacSignature } from '@caasxyz/notification-sdk';

// In your webhook endpoint
const isValid = verifyHmacSignature(
  req.headers['x-signature'],
  req.headers['x-timestamp'],
  req.headers['x-nonce'],
  requestBody,
  webhookSecret,
  300 // Max age in seconds
);

if (!isValid) {
  throw new Error('Invalid webhook signature');
}
```

## Error Handling

```typescript
import { NotificationError } from '@caasxyz/notification-sdk';

try {
  await client.sendNotification({ ... });
} catch (error) {
  if (error instanceof NotificationError) {
    console.error('Notification error:', {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    
    // Handle specific error codes
    switch (error.code) {
      case 'USER_NOT_FOUND':
        // Handle missing user
        break;
      case 'RATE_LIMIT_EXCEEDED':
        // Handle rate limiting
        break;
      // ... other cases
    }
  }
}
```

## Channel Types

The SDK supports the following notification channels:

- **email** - Email notifications
- **lark** - Lark (Feishu) webhooks
- **telegram** - Telegram bot messages
- **webhook** - Custom HTTP webhooks
- **sms** - SMS messages

## Advanced Usage

### Custom Retry Logic

```typescript
async function sendWithCustomRetry(request, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.sendNotification(request);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Analytics

```typescript
async function getNotificationMetrics(userId: string, days = 7) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const logs = await client.logs.query({
    user_id: userId,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
  });

  // Process logs for metrics
  return {
    total: logs.data.length,
    sent: logs.data.filter(l => l.status === 'sent').length,
    failed: logs.data.filter(l => l.status === 'failed').length,
    // ... more metrics
  };
}
```

## Examples

See the [examples](./examples) directory for more detailed usage examples:

- [Basic Usage](./examples/basic-usage.ts)
- [User Management](./examples/user-management.ts)
- [Template Management](./examples/template-management.ts)
- [Error Handling](./examples/error-handling.ts)
- [Webhook Validation](./examples/webhook-validation.ts)
- [Advanced Usage](./examples/advanced-usage.ts)

## API Reference

### NotificationClient

The main client class for interacting with the API.

#### Methods

- `sendNotification(request)` - Send a single notification
- `sendBatchNotifications(requests)` - Send multiple notifications
- `health()` - Check API health status

#### Namespaces

- `users` - User management operations
- `configs` - Channel configuration operations
- `templates` - Template management operations
- `logs` - Notification log queries
- `retry` - Retry management operations

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## License

MIT
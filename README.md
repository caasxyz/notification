# 🚀 Notification System for Cloudflare Workers

A high-performance, TypeScript-based notification system built on Cloudflare Workers with support for multiple notification channels.

## ✨ Features

- **Multi-Channel Support**: Webhook, Telegram, Lark, and Slack
- **Reliable Delivery**: Automatic retry mechanism with exponential backoff
- **Idempotency**: Prevent duplicate notifications
- **Template System**: Dynamic content generation with variable substitution
- **Security**: HMAC-SHA256 signature verification
- **Monitoring**: Built-in health checks and metrics
- **Auto-Cleanup**: Scheduled data retention management

## 🔧 Tech Stack

- **Runtime**: Cloudflare Workers (Edge Computing)
- **Language**: TypeScript
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Queue**: Cloudflare Queues
- **Cache**: Cloudflare KV
- **Scheduler**: Cloudflare Cron Triggers
- **ORM**: Drizzle ORM for type-safe database operations

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI (`npm install -g wrangler`)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd notification-system
```

2. Install dependencies:
```bash
npm install
```

3. Setup local database:
```bash
npm run db:setup
```

4. Apply database migrations:
```bash
npm run db:push
```

5. Deploy to development:
```bash
./deploy.sh development
```

### Configuration

1. Update `wrangler.toml` with your Cloudflare resource IDs
2. Set environment variables:
   - `API_SECRET_KEY`: API authentication key
   - `ENCRYPT_KEY`: 32-character encryption key

### SDK Usage

We provide a TypeScript SDK for easy integration. The SDK is available through GitHub Packages.

#### Installation

1. First, configure authentication for GitHub Packages:
```bash
# Create .npmrc file in your project
echo "@caasxyz:registry=https://npm.pkg.github.com" > .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc
```

2. Install the SDK:
```bash
npm install @caasxyz/notification-sdk
```

3. Use the SDK:
```typescript
import { NotificationClient } from '@caasxyz/notification-sdk';

const client = new NotificationClient({
  baseUrl: 'https://your-worker.workers.dev',
  apiKey: 'your-api-key'
});

await client.sendNotification({
  user_id: 'user123',
  channels: ['telegram', 'slack'],
  template_key: 'welcome_message',
  variables: {
    username: 'John Doe'
  }
});
```

For detailed SDK documentation, see [SDK README](./sdk/README.md).

### API Usage

#### Send Notification

```bash
curl -X POST https://your-worker.workers.dev/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $(date +%s)000" \
  -H "X-Signature: YOUR_SIGNATURE" \
  -d '{
    "user_id": "user123",
    "channels": ["telegram", "slack"],
    "template_key": "welcome_message",
    "variables": {
      "username": "John Doe"
    }
  }'
```

#### Health Check

```bash
curl https://your-worker.workers.dev/health
```

#### Metrics

```bash
curl https://your-worker.workers.dev/metrics?user_id=user123&days=7
```

## 🏗️ Architecture

### Core Components

1. **NotificationDispatcher**: Main orchestrator for sending notifications
2. **Channel Adapters**: Individual implementations for each notification channel
3. **RetryScheduler**: Manages failed notification retries
4. **TemplateEngine**: Renders dynamic content
5. **IdempotencyManager**: Prevents duplicate sends
6. **ConfigCache**: Caches user configurations

### Data Flow

```text
API Request → Signature Verification → Idempotency Check → 
User Config Retrieval → Template Rendering → Parallel Channel Delivery → 
Success/Retry → Queue Processing → Final Status
```

## 👨‍💻 Development

### Local Development

```bash
npm run dev
```

### Type Checking

```bash
npm run typecheck
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Database Management

```bash
# Generate migrations from schema changes
npm run db:generate

# Apply migrations to local database
npm run db:push

# Reset database (development only)
npm run db:reset

# Seed database with test data
npm run db:seed

# Open Drizzle Studio GUI
npm run db:studio
```

## 📦 Production Deployment

### 🚀 Quick Start
- [5-Minute Quick Deploy Guide](./docs/quick-deploy.md) - Fastest way to get started
- [GitHub Actions Setup](./docs/github-actions-setup.md) - Automated deployment

### 📚 Detailed Documentation
- [Complete Deployment Guide](./docs/deployment-guide.md) - Step-by-step instructions
- [GitHub Secrets Configuration](./docs/github-actions-setup.md#github-secrets-配置) - Security setup

### Manual Deployment
For manual deployment, you can still use:
```bash
./deploy.sh production
```

## 📊 Monitoring

- Health endpoint: `/health`
- Metrics endpoint: `/metrics`
- Scheduled tasks health: `/health/scheduled-tasks`

## 🔐 Security

- All API requests require HMAC-SHA256 signatures
- Sensitive configurations are encrypted
- 5-minute request expiry window
- Channel-specific authentication

## 📜 License

MIT

---

**Last Updated**: 2025-01-05
# API 完整参考文档

本文档提供通知系统的完整 API 参考，包括所有端点、认证要求、安全指南和最佳实践。

## 目录

- [概述](#概述)
- [基础信息](#基础信息)
- [认证机制](#认证机制)
- [API 端点](#api-端点)
  - [通知发送](#通知发送)
  - [模板管理](#模板管理)
  - [用户配置](#用户配置)
  - [日志查询](#日志查询)
  - [Webhook 接口](#webhook-接口)
  - [系统管理](#系统管理)
- [错误处理](#错误处理)
- [速率限制](#速率限制)
- [SDK 示例](#sdk-示例)
- [安全最佳实践](#安全最佳实践)

## 概述

通知系统 API 是一个基于 Cloudflare Workers 的高性能通知服务，支持多渠道消息推送，采用 HMAC-SHA256 签名认证机制。

### 核心特性

- **多渠道支持**：Webhook、Telegram、飞书(Lark)、Slack
- **V2 模板系统**：一个模板支持多渠道，灵活配置
- **幂等性保障**：通过 idempotency_key 防止重复发送
- **自动重试**：失败通知自动进入重试队列
- **全面日志**：所有通知活动都有详细记录

## 基础信息

### 基础 URL

```
生产环境: https://your-notification-system.workers.dev
开发环境: http://localhost:8788
```

### 请求头要求

所有请求必须包含：

```http
Content-Type: application/json
Accept: application/json
```

需要认证的端点还需要：

```http
X-Timestamp: <时间戳（秒）>
X-Signature: <HMAC-SHA256签名>
```

## 认证机制

### 签名计算

签名算法根据 HTTP 方法有所不同：

#### POST/PUT 请求

```javascript
const timestamp = Math.floor(Date.now() / 1000).toString();
const payload = timestamp + requestBody;
const signature = HMAC_SHA256(payload, API_SECRET_KEY);
```

#### GET/DELETE 请求

```javascript
const timestamp = Math.floor(Date.now() / 1000).toString();
const url = new URL(request.url);
const pathAndQuery = url.pathname + url.search;
const payload = timestamp + pathAndQuery;
const signature = HMAC_SHA256(payload, API_SECRET_KEY);
```

### 需要认证的端点

以下端点需要签名认证：
- `/api/send-notification`
- `/api/templates/*`
- `/api/user-configs/*`
- `/api/notification-logs/*`
- `/api/db/*`
- `/metrics`

### 公开端点

无需认证：
- `/health` - 健康检查
- `/test-ui` - 测试界面（仅开发环境）
- `/api/webhooks/grafana` - Grafana webhook（使用 Basic Auth）

### 时间戳验证

- 时间戳必须在服务器时间 5 分钟内
- 使用秒级精度（10 位数字）
- 确保系统时钟与 NTP 同步

### 签名生成示例

**Node.js:**
```javascript
const crypto = require('crypto');

function generateSignature(payload, apiKey) {
  return crypto
    .createHmac('sha256', apiKey)
    .update(payload)
    .digest('hex');
}

// POST 请求
const timestamp = Math.floor(Date.now() / 1000).toString();
const body = JSON.stringify({ user_id: 'test' });
const signature = generateSignature(timestamp + body, API_KEY);
```

**Python:**
```python
import hmac
import hashlib
import time
import json

def generate_signature(payload, api_key):
    return hmac.new(
        api_key.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

# POST 请求
timestamp = str(int(time.time()))
body = json.dumps({'user_id': 'test'})
signature = generate_signature(timestamp + body, API_KEY)
```

## API 端点

### 通知发送

#### 发送通知

发送通知到指定用户的配置渠道。

```http
POST /api/send-notification
```

**请求体：**

```json
{
  "user_id": "user123",
  "channels": ["lark", "webhook"],
  "template_key": "order-confirmation",
  "variables": {
    "orderId": "ORD-12345",
    "amount": "99.99",
    "customerName": "张三"
  },
  "idempotency_key": "unique-request-id",
  "metadata": {
    "source": "order-service",
    "priority": "high"
  }
}
```

**参数说明：**

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `user_id` | string | 是 | 目标用户 ID |
| `channels` | string[] | 是 | 通知渠道列表 |
| `template_key` | string | 条件 | 模板 key（与 custom_content 二选一） |
| `variables` | object | 否 | 模板变量 |
| `custom_content` | object | 条件 | 自定义内容（与 template_key 二选一） |
| `idempotency_key` | string | 否 | 幂等性键，防止重复发送 |
| `metadata` | object | 否 | 附加元数据 |

**自定义内容格式：**

```json
{
  "custom_content": {
    "subject": "订单确认",
    "content": "您的订单 #12345 已确认"
  }
}
```

**成功响应：**

```json
{
  "success": true,
  "results": [
    {
      "channelType": "lark",
      "status": "sent",
      "messageId": "ntf_1736100000000_lark",
      "userId": "user123"
    },
    {
      "channelType": "webhook",
      "status": "sent",
      "messageId": "ntf_1736100000000_webhook",
      "userId": "user123"
    }
  ]
}
```

**状态说明：**
- `sent` - 成功发送
- `retry_scheduled` - 已加入重试队列
- `failed` - 发送失败
- `pending` - 等待发送

**错误响应：**

```json
{
  "success": false,
  "error": "Template order-confirmation not found"
}
```

### 模板管理

#### 获取模板列表

```http
GET /api/templates
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `is_active` | boolean | 筛选激活状态 |
| `limit` | number | 每页数量（默认：50） |
| `offset` | number | 偏移量 |

**响应示例：**

```json
{
  "success": true,
  "data": [
    {
      "template_key": "order-confirmation",
      "template_name": "订单确认",
      "description": "订单确认通知模板",
      "variables": ["orderId", "amount", "customerName"],
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### 创建/更新模板

```http
POST /api/templates/{template_key}
```

**请求体：**

```json
{
  "name": "订单确认",
  "description": "发送给客户的订单确认通知",
  "variables": ["orderId", "amount", "customerName"]
}
```

**响应：**

```json
{
  "success": true,
  "data": {
    "template_key": "order-confirmation",
    "message": "Template created successfully"
  }
}
```

#### 获取模板详情

```http
GET /api/templates/{template_key}
```

**响应：**

```json
{
  "success": true,
  "data": {
    "template_key": "order-confirmation",
    "template_name": "订单确认",
    "description": "订单确认通知模板",
    "variables": ["orderId", "amount", "customerName"],
    "is_active": true,
    "contents": [
      {
        "channel_type": "lark",
        "content_template": "{...}",
        "content_type": "json"
      },
      {
        "channel_type": "webhook",
        "content_template": "{...}",
        "content_type": "json"
      }
    ]
  }
}
```

#### 添加渠道内容

为模板添加特定渠道的内容。

```http
POST /api/templates/{template_key}/contents/{channel}
```

**飞书渠道示例：**

```json
{
  "content_template": {
    "msg_type": "interactive",
    "card": {
      "header": {
        "title": {
          "content": "订单确认 #{{orderId}}",
          "tag": "plain_text"
        },
        "template": "blue"
      },
      "elements": [
        {
          "tag": "div",
          "text": {
            "content": "**客户**: {{customerName}}\n**金额**: ¥{{amount}}",
            "tag": "lark_md"
          }
        }
      ]
    }
  }
}
```

**Webhook 渠道示例：**

```json
{
  "content_template": {
    "orderId": "{{orderId}}",
    "amount": "{{amount}}",
    "customerName": "{{customerName}}",
    "timestamp": "{{_timestamp}}",
    "eventType": "order.confirmed"
  }
}
```

#### 删除模板

软删除模板（标记为非激活状态）。

```http
DELETE /api/templates/{template_key}
```

### 用户配置

#### 获取用户配置

```http
GET /api/user-configs?user_id={userId}
```

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "user123",
      "channel_type": "lark",
      "config_data": {
        "webhook_url": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
        "secret": "xxx"
      },
      "is_active": true
    }
  ]
}
```

#### 创建/更新用户配置

```http
POST /api/user-configs
```

**请求体示例：**

**飞书配置：**
```json
{
  "user_id": "user123",
  "channel_type": "lark",
  "config": {
    "webhook_url": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
    "secret": "your-lark-secret"
  }
}
```

**Telegram 配置：**
```json
{
  "user_id": "user123",
  "channel_type": "telegram",
  "config": {
    "bot_token": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
    "chat_id": "-1001234567890"
  }
}
```

**Webhook 配置：**
```json
{
  "user_id": "user123",
  "channel_type": "webhook",
  "config": {
    "webhook_url": "https://your-api.com/webhook",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer your-token"
    }
  }
}
```

### 渠道配置说明

#### 飞书（Lark）配置

| 字段 | 必需 | 说明 |
|------|------|------|
| `webhook_url` | 是 | 飞书机器人 Webhook 地址 |
| `secret` | 否 | 签名密钥，用于验证请求 |

#### Telegram 配置

| 字段 | 必需 | 说明 |
|------|------|------|
| `bot_token` | 是 | Telegram Bot Token |
| `chat_id` | 是 | 目标聊天 ID（可以是群组） |

#### Webhook 配置

| 字段 | 必需 | 说明 |
|------|------|------|
| `webhook_url` | 是 | Webhook 接收地址 |
| `method` | 否 | HTTP 方法（默认：POST） |
| `headers` | 否 | 自定义请求头 |
| `secret` | 否 | 用于生成签名的密钥 |

#### 删除用户配置

```http
DELETE /api/user-configs?user_id={userId}&channel_type={channel}
```

### 日志查询

#### 查询通知日志

```http
GET /api/notification-logs
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `user_id` | string | 用户 ID |
| `channel_type` | string | 渠道类型 |
| `status` | string | 状态：pending/sent/failed/retry |
| `start_date` | string | 开始日期（ISO 8601） |
| `end_date` | string | 结束日期（ISO 8601） |
| `limit` | number | 每页数量（默认：50，最大：1000） |
| `offset` | number | 偏移量 |

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "message_id": "ntf_1736100000000_lark",
      "user_id": "user123",
      "channel_type": "lark",
      "template_key": "order-confirmation",
      "status": "sent",
      "content": "{\"msg_type\":\"interactive\"...}",
      "retry_count": 0,
      "sent_at": "2025-01-05T10:00:00Z",
      "created_at": "2025-01-05T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}
```

#### 清理日志（开发环境）

```http
DELETE /api/notification-logs/cleanup
```

**请求体：**

```json
{
  "days": 30,
  "status": "sent"
}
```

### Webhook 接口

#### Grafana Webhook

接收 Grafana 告警并转发到配置的通知渠道。

```http
POST /api/webhooks/grafana
```

**认证方式：** HTTP Basic Authentication

**请求头：**
```http
Authorization: Basic <base64(username:password)>
X-Notification-Channels: lark,webhook
```

**请求体：**
```json
{
  "receiver": "ops-team",
  "status": "firing",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "HighCPUUsage",
        "severity": "critical",
        "instance": "server-01",
        "notification_template": "grafana-alert-critical"
      },
      "annotations": {
        "summary": "CPU 使用率过高",
        "description": "服务器 CPU 使用率超过 90%"
      },
      "startsAt": "2025-01-05T10:00:00Z"
    }
  ]
}
```

详细集成指南请参考 [Grafana 集成文档](../../02-guides/integration/grafana.md)。

### 系统管理

#### 健康检查

```http
GET /health
```

**响应：**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "services": {
      "database": "healthy",
      "queue": "healthy",
      "kv": "healthy"
    },
    "timestamp": "2025-01-05T10:00:00Z"
  }
}
```

#### 系统指标

```http
GET /metrics
```

**响应：**

```json
{
  "success": true,
  "data": {
    "notifications": {
      "total_sent": 10000,
      "total_failed": 50,
      "pending": 10
    },
    "channels": {
      "lark": 5000,
      "webhook": 3000,
      "telegram": 2000
    },
    "performance": {
      "avg_processing_time_ms": 250,
      "p95_processing_time_ms": 500
    }
  }
}
```

#### 数据库迁移

检查数据库架构状态：

```http
GET /api/db/schema
```

运行数据库迁移：

```http
POST /api/db/migrate
```

## 错误处理

### 错误响应格式

```json
{
  "success": false,
  "error": "错误消息"
}
```

### 常见错误码

| HTTP 状态码 | 错误类型 | 说明 |
|------------|---------|------|
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 认证失败 |
| 404 | Not Found | 资源不存在 |
| 429 | Too Many Requests | 超过速率限制 |
| 500 | Internal Server Error | 服务器内部错误 |

### 错误码分类

#### 验证错误 (400)
- `INVALID_REQUEST` - 请求格式错误
- `MISSING_PARAMETER` - 缺少必需参数
- `INVALID_PARAMETER` - 参数值无效
- `TEMPLATE_NOT_FOUND` - 模板不存在
- `USER_NO_CHANNELS` - 用户未配置渠道

#### 认证错误 (401)
- `INVALID_SIGNATURE` - 签名错误
- `TIMESTAMP_EXPIRED` - 时间戳过期
- `MISSING_AUTH_HEADERS` - 缺少认证头

#### 系统错误 (500)
- `DATABASE_ERROR` - 数据库错误
- `QUEUE_ERROR` - 队列处理错误
- `ADAPTER_ERROR` - 渠道适配器错误

### 错误示例

**签名错误：**
```json
{
  "success": false,
  "error": "Invalid signature"
}
```

**模板不存在：**
```json
{
  "success": false,
  "error": "Template not found: order-confirmation"
}
```

**用户未配置渠道：**
```json
{
  "success": false,
  "error": "User user123 has no configured channels"
}
```

## 速率限制

### 全局限制

- 每个 IP 每分钟 100 次请求
- 认证失败每 15 分钟最多 5 次

### 端点限制

| 端点 | 限制 |
|------|------|
| `/api/send-notification` | 50次/分钟 |
| `/api/templates/*` | 30次/分钟 |
| `/api/notification-logs` | 20次/分钟 |

### 速率限制响应

超过限制时返回 429 状态码：

```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later."
}
```

## 幂等性保障

### 幂等性键使用

使用 `idempotency_key` 防止重复发送：

```json
{
  "user_id": "user123",
  "channels": ["lark"],
  "template_key": "order-confirmation",
  "idempotency_key": "order-12345-notification",
  "variables": {
    "orderId": "12345"
  }
}
```

### 幂等性规则

- 相同的 `idempotency_key` 在 24 小时内只会处理一次
- 重复请求会返回第一次请求的结果
- 幂等性键应该包含业务逻辑信息（如订单 ID）
- 建议格式：`{business_type}-{business_id}-{action}`

## 最佳实践

### 请求重试策略

建议实现指数退避重试：

```javascript
async function retryRequest(fn, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // 不重试 4xx 错误
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // 指数退避
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

### 并发请求控制

避免大量并发请求：

```javascript
class RequestQueue {
  constructor(concurrency = 5) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }
  
  async add(fn) {
    if (this.running >= this.concurrency) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}
```

### 缓存策略

对于模板和用户配置，建议实现本地缓存：

```javascript
class CacheManager {
  constructor(ttl = 300000) { // 5 分钟
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  set(key, value) {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl
    });
  }
}
```

## SDK 示例

### 安装 SDK

由于 SDK 通过 GitHub Packages 发布，安装前需要先配置认证：

```bash
# 1. 创建 .npmrc 文件配置认证
echo "@caasxyz:registry=https://npm.pkg.github.com" > .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc

# 2. 安装 SDK
npm install @caasxyz/notification-sdk
```

**获取 GitHub Token**：
1. 访问 https://github.com/settings/tokens/new
2. 创建新 token，勾选 `read:packages` 权限
3. 复制 token 替换上面的 YOUR_GITHUB_TOKEN

### TypeScript/JavaScript

```typescript
import { NotificationClient } from '@caasxyz/notification-sdk';

const client = new NotificationClient({
  apiKey: process.env.NOTIFICATION_API_KEY,
  baseUrl: 'https://notification.workers.dev',
  retry: {
    maxRetries: 3,
    backoffMultiplier: 2
  }
});

// 发送通知
const result = await client.sendNotification({
  userId: 'user123',
  channels: ['lark', 'webhook'],
  templateKey: 'order-confirmation',
  variables: {
    orderId: 'ORD-12345',
    amount: '99.99',
    customerName: '张三'
  }
});

// 创建模板
await client.createTemplate({
  key: 'new-template',
  name: '新模板',
  description: '模板描述',
  variables: ['var1', 'var2']
});

// 配置用户渠道
await client.configureUserChannel({
  userId: 'user123',
  channel: 'lark',
  config: {
    webhook_url: 'https://open.feishu.cn/...',
    secret: 'secret'
  }
});
```

### Python

```python
from notification_system import NotificationClient
import os

client = NotificationClient(
    api_key=os.environ['NOTIFICATION_API_KEY'],
    base_url='https://notification.workers.dev'
)

# 发送通知
result = client.send_notification(
    user_id='user123',
    channels=['lark', 'webhook'],
    template_key='order-confirmation',
    variables={
        'orderId': 'ORD-12345',
        'amount': '99.99',
        'customerName': '张三'
    }
)

# 查询日志
logs = client.get_notification_logs(
    user_id='user123',
    limit=10
)
```

### cURL

```bash
# 生成签名
TIMESTAMP=$(date +%s)
BODY='{"user_id":"user123","channels":["lark"],"template_key":"test"}'
PAYLOAD="${TIMESTAMP}${BODY}"
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$API_KEY" -hex | cut -d' ' -f2)

# 发送请求
curl -X POST https://notification.workers.dev/api/send-notification \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -d "$BODY"
```

## 安全最佳实践

### API 密钥管理

1. **不要在代码中硬编码密钥**
2. **使用环境变量或密钥管理服务**
3. **定期轮换密钥**（建议每 90 天）
4. **为不同环境使用不同密钥**
5. **监控密钥使用情况**

### 请求安全

1. **生产环境必须使用 HTTPS**
2. **验证 SSL 证书**
3. **设置合理的超时时间**（建议 30 秒）
4. **实现请求重试机制**（带指数退避）

### 数据保护

1. **最小化数据收集**
2. **敏感数据加密存储**
3. **实施数据保留策略**（默认 90 天）
4. **提供数据导出/删除功能**

### Webhook 安全

#### 发送 Webhook 的签名

系统发送 Webhook 时会包含以下头部：

```http
X-Notification-Signature: sha256=<signature>
X-Notification-Timestamp: <timestamp>
X-Notification-Event: notification.sent
X-Notification-MessageId: ntf_1736100000000_webhook
```

#### 验证 Webhook 签名

接收方应该验证签名：

```javascript
function verifyWebhookSignature(request, secret) {
  const signature = request.headers['x-notification-signature'];
  const timestamp = request.headers['x-notification-timestamp'];
  const body = request.body;
  
  // 检查时间戳（防止重放攻击）
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    throw new Error('Timestamp too old');
  }
  
  // 验证签名
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(timestamp + body)
    .digest('hex');
  
  if (`sha256=${expectedSignature}` !== signature) {
    throw new Error('Invalid webhook signature');
  }
  
  return true;
}
```

#### Webhook 重试机制

- 失败后会自动重试 3 次
- 重试间隔：1 分钟、5 分钟、15 分钟
- 只有 5xx 状态码会触发重试
- 4xx 状态码被视为永久失败

### SSRF 防护

系统自动实施以下保护：
- 阻止私有 IP 地址访问
- 阻止本地主机访问
- 仅允许 http/https 协议
- 限制重定向次数

## 相关文档

- [快速开始](../../01-getting-started/quickstart.md)
- [V2 模板系统](../architecture/v2-template-system.md)
- [安全指南](../../04-security/security-guide.md)
- [Grafana 集成](../../02-guides/integration/grafana.md)

## 常见问题

### Q: 为什么收到 "User has no configured channels" 错误？

A: 这表示用户没有配置任何通知渠道。需要先通过 `/api/user-configs` 接口为用户配置至少一个渠道。

### Q: 幂等性键多久过期？

A: 幂等性键在 24 小时后自动过期。过期后相同的 key 可以重新使用。

### Q: 如何处理签名验证失败？

A: 检查以下几点：
1. 时间戳是否使用秒级精度（10 位数字）
2. 签名计算是否正确（timestamp + body）
3. API 密钥是否正确
4. 系统时钟是否准确（误差不超过 5 分钟）

### Q: 支持批量发送吗？

A: 目前不支持单个请求发送给多个用户。如需批量发送，请并发调用 API（注意速率限制）。

### Q: 通知失败会自动重试吗？

A: 是的，系统会自动重试失败的通知：
- 最多重试 3 次
- 重试间隔：1 分钟、5 分钟、15 分钟
- 仅对临时性错误重试（如网络超时）

---

**最后更新**: 2025-01-05
**版本**: 2.0
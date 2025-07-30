# 快速开始指南

本指南将帮助您在 5 分钟内启动通知系统，支持本地开发和生产部署。

## 目录

- [前置条件](#前置条件)
- [本地开发](#本地开发)
- [生产部署](#生产部署)
- [API 测试](#api-测试)
- [通知渠道配置](#通知渠道配置)
- [常见问题](#常见问题)
- [下一步](#下一步)

## 前置条件

### 本地开发
- Node.js 18+ 和 npm
- Git

### 生产部署
- Cloudflare 账户（免费）
- GitHub 账户
- 基本的命令行知识

## 本地开发

### 1. 克隆项目

```bash
git clone https://github.com/caasxyz/notification.git
cd notification
```

### 2. 安装依赖

```bash
# 使用 npm
npm install

# 或使用项目推荐的 Node 版本
nvm use
npm install
```

### 3. 配置环境变量

创建 `.dev.vars` 文件：

```bash
# 必需的环境变量
API_SECRET_KEY=dev-secret-key-32-characters-long
ENCRYPT_KEY=dev-encrypt-key-must-be-32-chars

# 可选：Grafana 集成
GRAFANA_WEBHOOK_USERNAME=admin
GRAFANA_WEBHOOK_PASSWORD=password

# 可选：自动迁移
AUTO_MIGRATE=true
```

### 4. 初始化数据库

```bash
# 生成数据库 schema
npm run db:generate

# 应用到本地数据库
npm run db:push

# （可选）添加测试数据
npm run seed
```

### 5. 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:8788 启动。

### 6. 验证安装

打开浏览器访问：
- 健康检查：http://localhost:8788/api/health
- 测试界面：http://localhost:8788/test-ui

## 生产部署

### 方式一：GitHub Actions 自动部署（推荐）

#### 步骤 1：创建 Cloudflare 资源

```bash
# 1. 安装 Cloudflare CLI
npm install -g wrangler

# 2. 登录 Cloudflare
wrangler login

# 3. 创建数据库
wrangler d1 create notification-system
# 记录输出的 database_id

# 4. 创建 KV 命名空间
wrangler kv:namespace create "CONFIG_CACHE"
# 记录输出的 id

# 5. 创建队列（如果需要重试功能）
wrangler queues create retry-queue
wrangler queues create failed-queue
```

#### 步骤 2：配置 GitHub Secrets

在您的 GitHub 仓库中，进入 Settings → Secrets and variables → Actions，添加：

| Secret 名称 | 说明 | 获取方式 |
|------------|------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 令牌 | [创建 API Token](https://dash.cloudflare.com/profile/api-tokens) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID | [Dashboard](https://dash.cloudflare.com) 右侧 |
| `PROD_DB_ID` | 数据库 ID | 步骤 1 中创建的 database_id |
| `PROD_KV_ID` | KV 命名空间 ID | 步骤 1 中创建的 id |
| `PROD_API_SECRET` | API 密钥 | `openssl rand -hex 32` |
| `PROD_ENCRYPT_KEY` | 加密密钥（32字符） | `openssl rand -base64 24 \| cut -c1-32` |
| `PROD_GRAFANA_USERNAME` | Grafana 用户名（可选） | 自定义 |
| `PROD_GRAFANA_PASSWORD` | Grafana 密码（可选） | 自定义 |

#### 步骤 3：部署

1. 推送代码到 GitHub
2. 进入 Actions 标签
3. 选择 "Deploy to Cloudflare" workflow
4. 点击 "Run workflow"
5. 选择：
   - Branch: `main`
   - Environment: `production`
   - Initialize database: `true`（首次部署）

### 方式二：手动部署

#### 1. 创建 wrangler.toml

```bash
cp wrangler.toml.template wrangler.toml
```

编辑 `wrangler.toml`，替换占位符：

```toml
name = "notification-system"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "notification-system"
database_id = "YOUR_DATABASE_ID"

[[env.production.kv_namespaces]]
binding = "CONFIG_CACHE"
id = "YOUR_KV_ID"

[[env.production.queues.producers]]
binding = "RETRY_QUEUE"
queue = "retry-queue"

[[env.production.queues.consumers]]
queue = "retry-queue"
max_batch_size = 10
max_batch_timeout = 30
```

#### 2. 设置密钥

```bash
# 设置 API 密钥
wrangler secret put API_SECRET_KEY --env production
# 输入您的 32 字符密钥

# 设置加密密钥
wrangler secret put ENCRYPT_KEY --env production
# 输入您的 32 字符密钥
```

#### 3. 部署

```bash
# 部署
npm run deploy --env production

# 初始化数据库（首次部署后）
wrangler d1 execute notification-system --file ./scripts/database/init-db-v2.sql --env production
```

## API 测试

### 使用测试界面

访问 http://localhost:8788/test-ui（本地）或 https://your-worker.workers.dev/test-ui（生产）

### 使用 curl

#### 1. 健康检查

```bash
curl http://localhost:8788/api/health
```

响应示例：
```json
{
  "status": "healthy",
  "timestamp": "2025-01-05T12:00:00.000Z",
  "services": {
    "database": true,
    "queue": true,
    "cache": true
  }
}
```

#### 2. 发送通知

首先需要创建签名：

```bash
# 生成时间戳
TIMESTAMP=$(date +%s)000

# 请求体
BODY='{
  "user_id": "test-user",
  "channels": ["webhook"],
  "custom_content": {
    "subject": "Test Notification",
    "content": "Hello from Notification System!"
  }
}'

# 生成签名（本地开发）
SIGNATURE=$(echo -n "${TIMESTAMP}${BODY}" | openssl dgst -sha256 -hmac "dev-secret-key-32-characters-long" -binary | base64)

# 发送请求
curl -X POST http://localhost:8788/api/send-notification \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: ${TIMESTAMP}" \
  -H "X-Signature: ${SIGNATURE}" \
  -d "${BODY}"
```

### 使用 SDK

首先需要配置 GitHub Packages 认证：

```bash
# 创建 .npmrc 文件
echo "@caasxyz:registry=https://npm.pkg.github.com" > .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc

# 安装 SDK
npm install @caasxyz/notification-sdk
```

使用示例：

```typescript
import { NotificationClient } from '@caasxyz/notification-sdk';

const client = new NotificationClient({
  baseUrl: 'http://localhost:8788',
  apiKey: 'dev-secret-key-32-characters-long'
});

// 发送通知
const result = await client.send({
  userId: 'test-user',
  channels: ['lark', 'email'],
  templateKey: 'welcome',
  variables: {
    userName: '张三',
    action: '注册'
  }
});

// 查询通知历史
const logs = await client.getLogs({
  userId: 'test-user',
  limit: 10
});

// 管理模板
const template = await client.createTemplate({
  key: 'order-status',
  name: '订单状态更新',
  variables: ['orderNo', 'status', 'time']
});
```

### 使用测试工具

```bash
# 使用脚本测试
npm run test:local

# 测试 Grafana 集成
npm run test:grafana

# 性能测试
npm run test:perf
```

## 通知渠道配置

### Webhook 配置

```json
{
  "webhook_url": "https://your-webhook-endpoint.com/notify",
  "headers": {
    "Authorization": "Bearer your-token"
  },
  "timeout": 30000
}
```

### Lark（飞书）配置

```json
{
  "webhook_url": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
  "secret": "your-lark-secret"
}
```

### Telegram 配置

```json
{
  "bot_token": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
  "chat_id": "-1001234567890"
}
```

### Slack 配置

```json
{
  "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"
}
```

### Email 配置

```json
{
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_user": "your-email@gmail.com",
  "smtp_pass": "your-app-password",
  "from_email": "noreply@yourdomain.com",
  "from_name": "Notification System"
}
```

## 常见问题

### 本地开发

#### 1. 端口已被占用

```bash
# 查找占用端口的进程
lsof -i :8788

# 终止进程
kill -9 <PID>

# 或使用不同端口
npm run dev -- --port 8789
```

#### 2. 数据库错误

```bash
# 重置数据库
rm -rf .wrangler/state/v3/d1
npm run db:push

# 或使用智能设置脚本
./scripts/database/smart-db-setup.sh
```

#### 3. TypeScript 错误

```bash
# 检查类型
npm run typecheck

# 仅检查生产代码
npm run typecheck:prod
```

### 生产部署

#### 1. 部署失败

检查 GitHub Actions 日志，常见原因：
- Secrets 配置错误
- 资源 ID 错误
- API Token 权限不足

#### 2. 503 错误

可能原因：
- Worker 冷启动
- 数据库未初始化
- 环境变量缺失

解决方法：
```bash
# 检查日志
wrangler tail --env production

# 检查数据库
wrangler d1 execute notification-system --command "SELECT name FROM sqlite_master WHERE type='table'" --env production
```

#### 3. 签名验证失败

确保：
- 时间戳是毫秒级
- 请求体完全一致
- 密钥正确配置

## 下一步

### 基础配置

1. **创建用户配置**
   ```bash
   # 使用测试界面创建用户渠道配置
   http://localhost:8788/test-ui
   ```

2. **创建通知模板**
   
   使用 V2 模板系统，一个模板可以支持多个渠道：
   
   ```typescript
   // 创建模板
   const template = {
     key: 'order-notification',
     name: '订单通知',
     variables: ['orderNo', 'amount', 'status']
   };
   
   // 为不同渠道添加内容
   const larkContent = {
     content_template: '订单 {{orderNo}} 状态更新为 {{status}}，金额：{{amount}}',
     content_type: 'text'
   };
   
   const emailContent = {
     subject_template: '订单{{orderNo}}状态更新',
     content_template: '<h1>订单状态更新</h1><p>订单号：{{orderNo}}</p>',
     content_type: 'html'
   };
   ```

3. **配置通知渠道**
   - 查看上面的[通知渠道配置](#通知渠道配置)章节
   - 每个用户可以配置多个渠道
   - 支持加密存储敏感信息

### 高级功能

1. **集成 Grafana 告警**
   ```bash
   # 使用 Grafana webhook
   配置 webhook URL: https://your-worker.workers.dev/api/webhooks/grafana
   设置 Basic Auth 凭据
   ```

2. **实现重试机制**
   - 自动重试失败的通知
   - 死信队列处理
   - 自定义重试策略

3. **监控和日志**
   - 查询通知历史
   - 监控发送成功率
   - 设置告警

### 相关文档

- [API 完整参考](../03-reference/api/complete-api-reference.md)
- [部署指南](../02-guides/deployment.md)
- [开发指南](../02-guides/development.md)
- [安全最佳实践](../04-security/security-guide.md)
- [故障排查](../05-operations/troubleshooting.md)

---

## 快速命令参考

### 开发命令
```bash
npm run dev              # 启动开发服务器
npm run build            # 构建项目
npm run typecheck        # TypeScript 类型检查
npm run typecheck:prod   # 生产代码类型检查
```

### 数据库命令
```bash
npm run db:generate      # 生成迁移文件
npm run db:push          # 应用迁移到本地
npm run db:studio        # 打开数据库 UI
npm run db:setup         # 初始化数据库
npm run seed             # 添加测试数据
```

### 测试命令
```bash
npm test                 # 运行单元测试
npm run test:local       # 测试本地 API
npm run test:grafana     # 测试 Grafana 集成
npm run test:perf        # 性能测试
```

### 部署命令
```bash
npm run deploy           # 部署到默认环境
npm run deploy:verify    # 验证部署状态
npm run deploy:check     # 检查部署准备
```

---

**最后更新**: 2025-01-05
**版本**: 2.1 - 添加渠道配置和命令参考
# Notification System - Claude Code Configuration

## 项目概述

这是一个基于 Cloudflare Workers 的高性能通知系统，支持多渠道消息推送，采用 V2 模板架构，具有重试机制和完整的 TypeScript 支持。

### 核心特性
- 🚀 **多渠道支持**: Webhook, Telegram, Lark (飞书), Slack, Email, SMS
- 📝 **V2 模板系统**: 一个模板支持多渠道，灵活配置
- 🔄 **智能重试**: 失败自动重试，死信队列处理
- 🔐 **安全验证**: HMAC-SHA256 签名验证，API 密钥保护，速率限制
- 📊 **监控日志**: 完整的通知日志和查询功能
- 🎯 **幂等性**: 防止重复发送（24小时过期）
- 🛠️ **TypeScript SDK**: 方便集成的客户端 SDK
- 🔌 **Grafana 集成**: 原生支持 Grafana 告警 webhook
- 🏗️ **自动迁移**: 数据库架构自动迁移支持

## 技术栈

- **Runtime**: Cloudflare Workers (Edge Computing)
- **Database**: Cloudflare D1 (SQLite) - 注意：所有字符串使用 TEXT，布尔值使用 INTEGER
- **Cache**: Cloudflare KV (CONFIG_CACHE 命名空间，5分钟 TTL)
- **Queue**: Cloudflare Queues (RETRY_QUEUE, FAILED_QUEUE)
- **Language**: TypeScript (严格模式)
- **ORM**: Drizzle ORM (单例模式连接池)
- **Test**: Vitest
- **Deploy**: GitHub Actions + Wrangler
- **Router**: itty-router (不使用 Hono)

## 项目结构

```
notification/
├── src/
│   ├── index.ts              # Worker 入口
│   ├── api/
│   │   ├── router.ts         # API 路由
│   │   ├── secureRouter.ts   # 安全增强路由
│   │   └── handlers/         # API 处理器
│   │       ├── sendNotification.ts      # 发送通知
│   │       ├── templateManagementV2.ts  # V2 模板管理
│   │       ├── userConfig.ts            # 用户配置
│   │       ├── notificationLogs.ts      # 日志查询
│   │       ├── grafanaWebhook.ts        # Grafana webhook
│   │       └── testUIv2.ts              # 测试界面
│   ├── services/
│   │   ├── NotificationDispatcherV2.ts  # V2 核心调度器
│   │   ├── TemplateEngineV2.ts          # V2 模板引擎（简单字符串替换）
│   │   ├── QueueProcessorV2.ts          # V2 队列处理
│   │   ├── RetryScheduler.ts            # 重试调度
│   │   └── ConfigCache.ts               # 配置缓存 (KV)
│   ├── adapters/              # 渠道适配器
│   │   ├── BaseAdapter.ts     # 适配器基类
│   │   ├── LarkAdapter.ts     # 飞书适配器
│   │   ├── TelegramAdapter.ts # Telegram 适配器
│   │   ├── WebhookAdapter.ts  # Webhook 适配器
│   │   └── SlackAdapter.ts    # Slack 适配器
│   ├── security/              # 安全功能
│   │   └── SecurityEnhancements.ts  # 安全增强（部分功能待实现）
│   ├── db/                   # 数据库
│   │   ├── index.ts          # Drizzle ORM 配置
│   │   ├── schema.ts         # 数据库模式定义
│   │   └── auto-migrate.ts   # 自动迁移工具
│   └── types/                # TypeScript 类型定义
├── sql/
│   └── schema.sql            # V2 数据库架构
├── scripts/
│   ├── database/             # 数据库脚本
│   │   └── init-db-v2.sql    # V2 初始化脚本
│   ├── test-local.ts         # 本地测试脚本
│   └── test-grafana-webhook.ts # Grafana 测试脚本
├── sdk/                      # TypeScript SDK
│   └── v2/                   # V2 客户端
├── docs/                     # 项目文档（全部使用中文）
│   ├── 01-getting-started/   # 入门指南
│   ├── 02-guides/           # 使用指南
│   ├── 03-reference/        # 参考文档
│   ├── 04-security/         # 安全文档
│   └── 05-operations/       # 运维文档
└── .github/workflows/        # GitHub Actions
```

## 重要实现细节

### 认证机制
- **HMAC-SHA256 签名**: 使用毫秒级时间戳 `Date.now().toString()`
- **签名格式**: `timestamp + requestBody`（GET 请求包含路径和查询参数）
- **时间窗口**: 5分钟容差
- **Header**: `X-Signature` 和 `X-Timestamp`

### 数据库特性（D1/SQLite）
- **字符串字段**: 全部使用 TEXT 类型（不用 VARCHAR）
- **布尔值**: 使用 INTEGER（0=false, 1=true）
- **时间戳**: TEXT 类型，存储 ISO 8601 格式
- **不支持 ENUM**: 使用 CHECK 约束代替
- **外键**: 支持但需要手动启用

### 缓存策略
- **ConfigCache**: 用户配置缓存，5分钟 TTL
- **模板缓存**: TemplateEngineV2 内置，1小时 TTL
- **KV 命名空间**: CONFIG_CACHE
- **缓存键格式**: `{resource}:{id}:{sub_type}`
- **批量操作**: 支持预热和批量获取

### 模板系统
- **V2 架构**: 模板定义与渠道内容分离
- **变量替换**: 简单的 `{{variable}}` 字符串替换（不是 Handlebars）
- **安全处理**: 自动转义 HTML 和限制长度
- **内容类型**: text, markdown, html, json（Lark 专用）
- **变量定义**: 存储在 `variables` 字段（JSON 数组）

### 队列系统
- **重试队列**: RETRY_QUEUE，批量大小 10，超时 5 秒
- **死信队列**: FAILED_QUEUE，批量大小 5
- **重试策略**: 指数退避（10s, 30s），最多 2 次实际重试
- **幂等性**: 24小时内防重复发送，基于 idempotency_key
- **不可重试错误**: 格式错误、认证失败、配置无效

### 安全功能
- **已实现**:
  - HMAC 签名验证
  - 输入验证和清理
  - CORS 配置
  - 速率限制（基础版）
  - PII 脱敏
  - 安全响应头
- **待实现**:
  - 完整的速率限制（用户级别）
  - SSRF 防护
  - 审计日志持久化
  - 威胁检测

## API 端点

### 核心功能
- `POST /api/send-notification` - 发送通知（需要签名验证）
- `GET /api/health` - 健康检查
- `GET /test-ui` - 测试界面

### 模板管理
- `GET /api/templates` - 获取模板列表
- `POST /api/templates/:key` - 创建/更新模板
- `DELETE /api/templates/:key` - 删除模板
- `GET /api/templates/:key/contents` - 获取模板内容
- `POST /api/templates/:key/contents/:channel` - 设置渠道内容

### 用户配置
- `GET /api/users/:userId/configs` - 获取用户配置
- `PUT /api/users/:userId/configs/:channel` - 更新配置
- `DELETE /api/users/:userId/configs/:channel` - 删除配置

### 日志查询
- `GET /api/logs` - 查询通知日志（支持分页）
- `POST /api/cleanup-logs` - 清理旧日志
- `POST /api/trigger-retry` - 手动触发重试

### Grafana 集成
- `POST /api/grafana/webhook` - Grafana 告警 webhook（Basic Auth）
- **自动模板选择**: 通过 `notification_template` 标签
- **提取变量**: status, alertCount, alertname, severity, summary, description
- **渠道指定**: X-Notification-Channels header
- **状态支持**: firing 和 resolved

### 数据库管理
- `GET /api/db/schema` - 检查数据库模式
- `POST /api/db/migrate` - 运行数据库迁移（生产环境需要 force 参数）

## 开发指南

### 本地开发
```bash
# 安装依赖
npm install

# 初始化数据库
npm run db:setup

# 启动开发服务器
npm run dev

# 运行测试
npm test

# 类型检查
npm run typecheck
```

### 测试脚本用法
```bash
# 测试本地 API
npm run test:local

# 测试 Grafana webhook
npm run test:grafana send    # 发送测试通知
npm run test:grafana webhook  # 模拟 Grafana webhook
```

### 环境变量配置
创建 `.dev.vars` 文件：
```env
API_SECRET_KEY=your-32-char-secret-key-minimum
ENCRYPT_KEY=32-character-encryption-key-here
BASIC_AUTH_USER=grafana
BASIC_AUTH_PASSWORD=your-password
ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com
```

## 部署配置

### GitHub Actions 自动部署
1. 推送到 main 分支自动部署到生产环境
2. 支持手动部署到开发/生产环境
3. 首次部署支持数据库初始化

### 需要配置的 GitHub Secrets
- `CLOUDFLARE_API_TOKEN` - API 令牌
- `CLOUDFLARE_ACCOUNT_ID` - 账户 ID
- `PROD_DB_ID` - 生产环境数据库 ID
- `PROD_CONFIG_CACHE_ID` - 配置缓存 KV ID
- `PROD_RATE_LIMIT_KV_ID` - 速率限制 KV ID
- `PROD_API_SECRET` - API 密钥（至少32字符）
- `PROD_ENCRYPT_KEY` - 加密密钥（32字符）
- `PROD_BASIC_AUTH_USER` - Grafana Basic Auth 用户名
- `PROD_BASIC_AUTH_PASSWORD` - Grafana Basic Auth 密码

## 常见问题和解决方案

### 1. 签名验证失败
- 确保使用毫秒级时间戳：`Date.now().toString()`
- 检查时间同步（5分钟容差）
- GET 请求签名包含完整路径和查询参数

### 2. 模板渲染问题
- 模板使用简单的字符串替换，不是 Handlebars
- 变量格式：`{{variableName}}`
- 未定义的变量保留原始占位符

### 3. 数据库类型问题
- D1 不支持 VARCHAR，使用 TEXT
- 布尔值存储为 INTEGER (0/1)
- 日期时间存储为 TEXT (ISO 8601)

### 4. 缓存问题
- KV 缓存是最终一致的
- 写入后可能需要几秒才能全局可读
- 缓存失效使用精确失效或批量失效

### 5. Grafana 集成
- 使用 Basic Auth 认证（独立于 API 签名）
- receiver 字段对应 user_id
- 可通过 X-Notification-Channels header 指定渠道
- 自动从告警中提取模板变量
- 支持 firing/resolved 状态映射

## 性能优化要点

1. **数据库查询**
   - 使用批量查询避免 N+1 问题
   - 利用索引优化查询性能
   - 分页处理大数据集

2. **缓存使用**
   - 热点数据使用 KV 缓存
   - 支持缓存预热
   - 批量操作减少 KV 调用

3. **并发处理**
   - 使用 Promise.all 并行处理
   - 队列批量处理通知
   - 合理设置批处理大小

4. **边缘优化**
   - 减少子请求数量
   - 使用 waitUntil 处理非关键任务
   - 合理使用 Cloudflare 特性

## 文档维护记录

### 2025-01-06 更新
- 完成文档整合和中文化
- 更新所有 API 示例使用毫秒时间戳
- 修正测试脚本命令格式
- 添加实际实现与计划功能的区别说明
- 更新数据库架构为最新 V2 版本
- 添加性能优化和缓存策略详解

### 重要提醒
1. **测试脚本使用子命令而非标志**：`npm run test:grafana send` 而不是 `--send`
2. **时间戳必须是毫秒级**：使用 `Date.now()` 而不是 `Date.now()/1000`
3. **响应格式**：发送通知返回 `results` 数组，包含 `message_id`
4. **数据库字段类型**：TEXT 和 INTEGER only，不要使用其他类型
5. **模板渲染**：简单字符串替换，不是完整的模板引擎

## 渠道特定实现细节

### Lark（飞书）
- **消息类型**: text, interactive（卡片）, markdown
- **签名算法**: HMAC-SHA256，特殊格式 `timestamp\n{secret}` 作为 key
- **内容限制**: 最大 10,000 字符
- **Markdown 转义**: 自动处理特殊字符

### Telegram
- **格式**: MarkdownV2（需要转义特殊字符）
- **配置**: bot_token 和 chat_id
- **速率限制**: 自动重试处理
- **特殊字符**: `_*[]()~>#+-=|{}.!` 需要转义

### Slack
- **格式**: mrkdwn（Slack 特有）
- **集成**: Webhook URL
- **富文本**: 支持附件和交互组件

### Webhook
- **方法**: HTTP POST
- **签名**: 可选 HMAC-SHA256 验证
- **自定义**: 支持自定义 headers
- **格式**: JSON payload

## 速率限制详细配置

- **全局限制**: 100 请求/分钟/IP
- **认证失败**: 5 次/15分钟
- **用户限制**: 30 请求/分钟/用户
- **发送通知**: 10 请求/分钟
- **实现**: Cloudflare KV + 滑动窗口算法

## 数据库索引优化

```sql
-- 用户查询优化
CREATE INDEX idx_user_channel ON user_configs(user_id, channel_type);

-- 日志查询优化
CREATE INDEX idx_notification_created ON notification_logs(created_at DESC);
CREATE INDEX idx_notification_status ON notification_logs(status, retry_count);

-- 幂等性优化
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

## SDK 使用示例

```typescript
// 初始化客户端
const client = new NotificationClient({
  baseUrl: 'https://api.example.com',
  apiKey: 'your-api-key',
  timeout: 30000,
  retryConfig: { 
    maxRetries: 3, 
    retryDelay: 1000 
  }
});

// 发送通知
const result = await client.send({
  user_id: 'user123',
  template_key: 'welcome',
  channels: ['lark', 'email'],
  variables: {
    username: 'John',
    action_url: 'https://app.example.com'
  },
  idempotency_key: 'unique-key-123'
});
```

## 监控和告警

### Prometheus 指标
- `notification_requests_total` - 请求总数
- `notification_duration_seconds` - 请求延迟
- `notification_errors_total` - 错误计数
- `queue_depth` - 队列深度
- `cache_hit_ratio` - 缓存命中率

### 健康检查端点
- `/health` - 基础健康状态
- `/health/db` - 数据库连接
- `/health/kv` - KV 存储状态
- `/health/queue` - 队列状态

## 后续开发计划

### 短期目标（1-2周）
1. 完善速率限制实现（用户级别）
2. 实现 SSRF 防护功能
3. 添加审计日志持久化
4. 优化模板缓存策略

### 中期目标（1个月）
1. 添加 Discord 通知渠道
2. 实现通知聚合功能
3. 添加 WebSocket 实时状态
4. 完善监控指标

### 长期目标（3个月）
1. 实现 OAuth2/JWT 认证
2. 添加 GraphQL API
3. 支持 Durable Objects
4. 实现端到端加密

---

**项目状态**: 生产就绪  
**最后更新**: 2025-01-06  
**维护者**: Claude Code Assistant  
**版本**: 2.0
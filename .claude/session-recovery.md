# Session Recovery Guide - 会话恢复指南

## 快速恢复检查清单

当开始新的 Claude 会话时，请按以下步骤快速恢复项目上下文：

### 1. 阅读核心文档
- [ ] `CLAUDE.md` - 项目概述和技术细节
- [ ] `.claude/context.md` - 深层次背景信息
- [ ] 本文档 - 会话恢复指南

### 2. 验证关键实现细节
```bash
# 检查时间戳实现（应该是毫秒）
grep -n "Date.now()" src/utils/crypto.ts

# 检查模板引擎（应该是简单替换）
grep -n "{{" src/services/TemplateEngineV2.ts

# 检查数据库类型（应该都是 TEXT 和 INTEGER）
grep -E "(VARCHAR|BOOLEAN)" sql/schema.sql
```

### 3. 确认当前分支和状态
```bash
git status
git log --oneline -10
```

### 4. 测试环境就绪
```bash
# 检查本地配置
ls -la .dev.vars
cat .env.example

# 启动开发服务器
npm run dev

# 访问测试界面
open http://localhost:8788/test-ui
```

## 重要提醒事项

### ⚠️ 容易出错的地方

1. **时间戳精度**
   ```javascript
   // ✅ 正确：毫秒
   const timestamp = Date.now().toString();
   
   // ❌ 错误：秒
   const timestamp = Math.floor(Date.now() / 1000).toString();
   ```

2. **测试脚本命令**
   ```bash
   # ✅ 正确：子命令
   npm run test:grafana send
   
   # ❌ 错误：标志参数
   npm run test:grafana --send
   ```

3. **API 响应格式**
   ```javascript
   // ✅ 正确：results 数组
   { "results": [{ "message_id": "xxx" }] }
   
   // ❌ 错误：单个对象
   { "messageId": "xxx" }
   ```

4. **数据库字段类型**
   ```sql
   -- ✅ 正确
   name TEXT NOT NULL,
   is_active INTEGER DEFAULT 1,
   
   -- ❌ 错误
   name VARCHAR(255),
   is_active BOOLEAN DEFAULT true,
   ```

### 📋 常用命令速查

```bash
# 数据库操作
npm run db:setup          # 初始化数据库
npm run db:reset          # 重置数据库
wrangler d1 execute notification-system --command="SELECT * FROM notification_templates_v2"

# 开发测试
npm run dev              # 启动开发服务器
npm run test:local       # 测试本地 API
npm run test:grafana send    # 测试 Grafana 通知

# 类型检查和测试
npm run typecheck        # TypeScript 类型检查
npm test                 # 运行测试

# 日志查看
wrangler tail --env production    # 生产环境日志
wrangler tail                     # 开发环境日志
```

### 🔍 快速定位文件

**核心服务**
- 通知调度: `src/services/NotificationDispatcherV2.ts`
- 模板引擎: `src/services/TemplateEngineV2.ts`
- 缓存管理: `src/services/ConfigCache.ts`
- 队列处理: `src/services/QueueProcessorV2.ts`
- 重试调度: `src/services/RetryScheduler.ts`
- 幂等性: `src/services/IdempotencyService.ts`

**API 处理器**
- 发送通知: `src/api/handlers/sendNotification.ts`
- 模板管理: `src/api/handlers/templateManagementV2.ts`
- Grafana: `src/api/handlers/grafanaWebhook.ts`
- 用户配置: `src/api/handlers/userConfig.ts`
- 日志查询: `src/api/handlers/notificationLogs.ts`

**渠道适配器**
- 基类: `src/adapters/BaseAdapter.ts`
- 飞书: `src/adapters/LarkAdapter.ts`
- Telegram: `src/adapters/TelegramAdapter.ts`
- Slack: `src/adapters/SlackAdapter.ts`
- Webhook: `src/adapters/WebhookAdapter.ts`

**配置文件**
- TypeScript: `tsconfig.prod.json`（生产构建）
- Cloudflare: `wrangler.toml.template`
- 部署: `.github/workflows/deploy.yml`
- 数据库: `sql/schema.sql`, `scripts/database/init-db-v2.sql`

### 🚀 快速开始新功能

1. **添加新通知渠道**
   - 创建 `src/adapters/NewChannelAdapter.ts`
   - 继承 `BaseAdapter`
   - 在 `NotificationDispatcherV2` 注册
   - 更新类型定义

2. **添加新 API 端点**
   - 创建处理器 `src/api/handlers/newHandler.ts`
   - 使用标准签名 `(request: Request, env: Env) => Promise<Response>`
   - 在 `src/api/router.ts` 注册路由
   - 添加到受保护路径（如需要）

3. **修改数据库结构**
   - 更新 `src/db/schema.ts`
   - 创建迁移脚本
   - 测试自动迁移
   - 更新相关文档

## 项目当前状态总结

### ✅ 已完成
- V2 架构迁移完成
- 文档全面中文化和整合
- 基础安全功能实现
- Grafana 集成支持
- 多渠道通知支持
- 完整的测试覆盖

### 🚧 进行中
- 速率限制完善（用户级别）
- 性能优化持续进行
- 监控指标完善

### 📋 待实现
- SSRF 防护
- 审计日志持久化
- 威胁检测
- Discord 渠道
- 通知聚合
- WebSocket 支持

## 调试技巧

### 1. 查看实际请求
```typescript
// 在处理器中添加
console.log('Request:', {
  method: request.method,
  url: request.url,
  headers: Object.fromEntries(request.headers),
  body: await request.text()
});
```

### 2. 检查缓存状态
```bash
# 查看 KV 缓存内容
wrangler kv:key list --namespace-id=CONFIG_CACHE
wrangler kv:key get --namespace-id=CONFIG_CACHE "user_config:user123:webhook"
```

### 3. 数据库调试
```sql
-- 检查模板激活状态
SELECT * FROM notification_templates_v2 WHERE is_active = 1;

-- 查看最近的通知日志
SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 10;

-- 检查用户配置
SELECT * FROM user_configs WHERE user_id = 'user123';
```

### 4. 队列状态
```bash
# 查看队列统计（需要实现相应端点）
curl -X GET http://localhost:8788/api/queue/stats \
  -H "X-Signature: $SIGNATURE" \
  -H "X-Timestamp: $(date +%s)000"
```

## 项目特定知识

### 🌟 飞书通知特点
- 签名算法特殊：`timestamp\n{secret}` 作为 HMAC key
- 支持交互卡片（interactive）
- 内容限制 10,000 字符
- Markdown 需要特殊转义

### 📨 Telegram 通知特点
- 使用 MarkdownV2 格式
- 特殊字符必须转义：`_*[]()~>#+-=|{}.!`
- 速率限制自动重试
- 最大 4096 字符

### 📡 Grafana 集成特点
- 使用 Basic Auth（不是 API 签名）
- 自动提取告警变量
- 通过 `notification_template` 标签选择模板
- X-Notification-Channels header 指定渠道

### 🔄 重试机制细节
- 最多 2 次实际重试（总计 3 次尝试）
- 指数退避：10秒、30秒
- 只重试瞬时错误
- 永久失败进入死信队列

### 🆔 幂等性实现
- 存储在 `idempotency_keys` 表
- 24 小时过期
- 返回缓存的 message_ids
- 复合键：(idempotency_key, user_id)

## 文档维护提醒

更新代码时，请同步更新：
1. `CLAUDE.md` - 主要功能和 API 变更
2. `.claude/context.md` - 重要决策和背景
3. 相关的 `docs/` 文档 - 详细实现说明
4. 本文档 - 新的常见问题或技巧

---

**最后更新**: 2025-01-06  
**用途**: 帮助快速恢复项目工作状态  
**提示**: 遇到问题先查看本文档的"容易出错的地方"部分
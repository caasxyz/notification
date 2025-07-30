# 错误预防指南

本文档记录了通知系统开发过程中遇到的所有错误及其解决方案，帮助开发者避免重复犯错。

## 目录

- [数据库相关错误](#数据库相关错误)
- [TypeScript 类型错误](#typescript-类型错误)
- [签名验证错误](#签名验证错误)
- [模板系统错误](#模板系统错误)
- [部署配置错误](#部署配置错误)
- [队列处理错误](#队列处理错误)
- [安全相关错误](#安全相关错误)
- [数据验证错误](#数据验证错误)
- [开发最佳实践](#开发最佳实践)
- [监控和告警](#监控和告警)
- [故障排查决策树](#故障排查决策树)
- [附录：错误代码速查表](#附录错误代码速查表)

## 数据库相关错误

### 1. D1 事务限制

#### 错误表现
```
Failed query: begin
Error: D1_ERROR: SqliteError: SQL logic error
```

#### 根本原因
Cloudflare D1 在 Workers 环境中对事务支持有限，不能使用 Drizzle ORM 的 `transaction` 方法。

#### 错误代码
```typescript
// ❌ 错误：使用事务
await db.transaction(async (tx) => {
  await tx.insert(notificationTemplatesV2).values(templateData);
  await tx.insert(templateContents).values(contents);
});
```

#### 正确代码
```typescript
// ✅ 正确：顺序执行
try {
  const [template] = await db
    .insert(notificationTemplatesV2)
    .values(templateData)
    .returning();
    
  const contentsWithTemplateId = contents.map(c => ({
    ...c,
    templateId: template.id
  }));
  
  await db
    .insert(templateContents)
    .values(contentsWithTemplateId);
} catch (error) {
  // 手动处理错误和清理
  logger.error('Template creation failed', error);
  throw error;
}
```

### 2. 表字段不匹配

#### 错误表现
```
Error: no such column: is_active
Error: table notification_logs has no column named error
```

#### 问题分析
1. `template_contents` 表没有 `is_active` 字段
2. `notification_logs` 表字段名是 `error_message` 而不是 `error`

#### 预防措施
```typescript
// ✅ 始终从 schema 导入类型
import { notificationLogs, templateContents } from '../db/schema';

// ✅ 使用 Drizzle 的类型推断
type NotificationLog = typeof notificationLogs.$inferSelect;
type NewNotificationLog = typeof notificationLogs.$inferInsert;

// ✅ 查询前检查表结构
const templateContent = await db
  .select()
  .from(templateContents)
  .where(
    and(
      eq(templateContents.templateId, templateId),
      eq(templateContents.channelType, channel)
      // 注意：template_contents 表没有 is_active 字段
    )
  );
```

### 3. 软删除实现错误

#### 问题描述
更新模板时 `is_active` 字段未正确设置为 true，导致模板被标记为已删除。

#### 错误代码
```typescript
// ❌ 更新时未设置 is_active
await db
  .update(notificationTemplatesV2)
  .set({
    templateName: template.name,
    description: template.description,
    updatedAt: now
  })
  .where(eq(notificationTemplatesV2.templateKey, templateKey));
```

#### 正确代码
```typescript
// ✅ 始终设置 is_active = 1
await db
  .update(notificationTemplatesV2)
  .set({
    templateName: template.name,
    description: template.description,
    isActive: 1,  // 重要：确保模板激活
    updatedAt: now
  })
  .where(eq(notificationTemplatesV2.templateKey, templateKey));
```

## TypeScript 类型错误

### 1. 索引签名属性访问

#### 错误表现
```
TS4111: Property comes from an index signature, so it must be accessed with ['property']
```

#### 配置原因
`tsconfig.json` 中启用了 `noPropertyAccessFromIndexSignature`：
```json
{
  "compilerOptions": {
    "noPropertyAccessFromIndexSignature": true
  }
}
```

#### 常见场景和解决方案

**D1 查询结果**
```typescript
// ❌ 错误
const userId = result.user_id;

// ✅ 正确
const userId = result['user_id'];
```

**环境变量动态访问**
```typescript
// ❌ 错误
const value = env.SOME_KEY;

// ✅ 正确：动态访问时使用类型断言
const key = `${service.toUpperCase()}_WEBHOOK_USERNAME`;
const value = env[key as keyof Env] as string;
```

**JSON 数据解析**
```typescript
// ❌ 错误
const config = JSON.parse(configData);
const url = config.webhook_url;

// ✅ 正确：定义接口或使用方括号
interface WebhookConfig {
  webhook_url: string;
  secret: string;
}
const config = JSON.parse(configData) as WebhookConfig;
const url = config.webhook_url;  // 现在可以使用点语法

// 或者
const config = JSON.parse(configData);
const url = config['webhook_url'];
```

### 2. 未使用参数错误

#### 错误表现
```
TS6133: 'ctx' is declared but its value is never read
```

#### 解决方案
```typescript
// ✅ 使用下划线前缀
export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext  // 下划线表示参数未使用
  ): Promise<Response> {
    return router.handle(request, env);
  }
};
```

### 3. 可能未定义的值

#### 错误表现
```
TS2532: Object is possibly 'undefined'
```

#### 解决方案
```typescript
// ❌ 错误
const first = items[0];
console.log(first.id);  // first 可能是 undefined

// ✅ 正确：检查或使用断言
if (first) {
  console.log(first.id);
}

// 或使用可选链
console.log(first?.id);

// 或使用非空断言（确定存在时）
console.log(first!.id);
```

## 签名验证错误

### 1. Lark (飞书) 签名验证失败

#### 错误表现
```
sign match fail or timestamp is not within one hour
```

#### 常见原因
1. **时间戳格式错误**：Lark 使用秒级时间戳，不是毫秒
2. **请求体处理错误**：需要原始字符串，不是解析后的对象
3. **字符串拼接错误**：缺少换行符或顺序错误

#### 正确实现
```typescript
// ✅ 正确的签名验证
async function verifyLarkSignature(
  timestamp: string,
  nonce: string,
  signature: string,
  bodyText: string,
  secret: string
): Promise<boolean> {
  // 1. 验证时间戳（5分钟内）
  const currentTime = Math.floor(Date.now() / 1000);  // 注意：秒级
  const requestTime = parseInt(timestamp, 10);
  
  if (Math.abs(currentTime - requestTime) > 300) {
    logger.warn('Lark signature expired', { 
      currentTime, 
      requestTime, 
      diff: currentTime - requestTime 
    });
    return false;
  }
  
  // 2. 拼接字符串（注意换行符）
  const content = `${timestamp}\n${nonce}\n${bodyText}`;
  
  // 3. 计算签名
  const expectedSignature = await CryptoUtils.generateHmacSha256(
    content,
    secret
  );
  
  // 4. 比较签名
  return signature === expectedSignature;
}
```

### 2. API 签名验证失败

#### 错误表现
```
Invalid signature
Request expired
```

#### 常见问题
1. 时间同步问题
2. 请求体编码问题
3. 签名算法不一致

#### 调试方法
```typescript
// 添加详细日志
logger.info('Signature verification debug', {
  receivedSignature: signature,
  expectedSignature: calculated,
  timestamp: requestTimestamp,
  currentTime: Date.now(),
  bodyLength: body.length,
  bodyFirst100: body.substring(0, 100)
});
```

## 模板系统错误

### 1. 模板内容找不到

#### 错误表现
```
Template content not found for channel: lark
```

#### 常见原因
1. 查询了错误的表
2. 查询条件错误（如检查不存在的 `is_active` 字段）
3. 模板 ID 不匹配

#### 正确查询
```typescript
// ✅ 正确的模板内容查询
const contents = await db
  .select()
  .from(templateContents)
  .where(
    and(
      eq(templateContents.templateId, template.id),
      eq(templateContents.channelType, channel)
    )
  )
  .limit(1);

if (!contents[0]) {
  throw new NotFoundError(
    `Template content not found for channel: ${channel}`
  );
}
```

### 2. 模板变量渲染错误

#### 错误表现
```
Template variable not found: userName
Expected variables: user_name
```

#### 预防措施
```typescript
// ✅ 验证变量名一致性
interface TemplateValidation {
  validateVariables(
    template: string,
    variables: Record<string, any>
  ): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const required = new Set<string>();
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      required.add(match[1]);
    }
    
    const missing = Array.from(required).filter(
      key => !(key in variables)
    );
    
    if (missing.length > 0) {
      throw new ValidationError(
        `Missing template variables: ${missing.join(', ')}`
      );
    }
    
    return Array.from(required);
  }
}
```

## 部署配置错误

### 1. GitHub Secrets 缺失

#### 错误表现
```
Error: Required secret 'PROD_DB_ID' not found
```

#### 必需的 Secrets 清单
```yaml
# 必需
CLOUDFLARE_API_TOKEN      # Cloudflare API 令牌
CLOUDFLARE_ACCOUNT_ID     # Cloudflare 账户 ID
PROD_DB_ID                # 生产环境 D1 数据库 ID
PROD_KV_ID                # 生产环境 KV 命名空间 ID
PROD_API_SECRET           # API 签名密钥
PROD_ENCRYPT_KEY          # 加密密钥（32字符）

# 可选
DEV_DB_ID                 # 开发环境数据库 ID
DEV_KV_ID                 # 开发环境 KV ID
PROD_RETRY_QUEUE_ID       # 重试队列 ID
PROD_FAILED_QUEUE_ID      # 失败队列 ID
```

### 2. wrangler.toml 泄露

#### 预防措施
```gitignore
# .gitignore
wrangler.toml
.dev.vars
*.local.toml
```

#### 正确流程
```bash
# 1. 复制模板
cp wrangler.toml.template wrangler.toml

# 2. 替换占位符
sed -i '' "s/YOUR_DATABASE_ID/$PROD_DB_ID/g" wrangler.toml

# 3. 验证没有占位符
grep "PLACEHOLDER\|YOUR_" wrangler.toml
```

## 队列处理错误

### 1. 消息重复处理

#### 问题描述
未正确实现幂等性，导致消息被多次处理。

#### 解决方案

项目使用 `IdempotencyManager` 类和数据库表来管理幂等性：

```typescript
// ✅ 使用 IdempotencyManager（实际实现）
import { IdempotencyManager } from '../utils/idempotency';

async function processNotification(
  request: SendNotificationRequest,
  env: Env
): Promise<NotificationResult[]> {
  // 检查幂等性
  if (request.idempotency_key) {
    const duplicateCheck = await IdempotencyManager.checkDuplicate(
      request.idempotency_key,
      request.user_id,
      env
    );
    
    if (duplicateCheck.isDuplicate) {
      logger.info('Duplicate request detected', {
        idempotencyKey: request.idempotency_key,
        userId: request.user_id
      });
      return duplicateCheck.results!;
    }
  }
  
  // 处理通知...
  const results = await sendNotifications(request, env);
  
  // 存储结果（存储在数据库中）
  if (request.idempotency_key) {
    await IdempotencyManager.storeResults(
      request.idempotency_key,
      request.user_id,
      results,
      env
    );
  }
  
  return results;
}
```

#### 重试配置

```typescript
// src/services/RetryScheduler.ts
private static readonly MAX_RETRY_COUNT = 2;        // 最多重试2次
private static readonly RETRY_INTERVALS = [10, 30]; // 重试间隔（秒）

// 计算退避时间
function calculateBackoff(retryCount: number): number {
  return RETRY_INTERVALS[Math.min(retryCount, RETRY_INTERVALS.length - 1)];
}
```

### 2. 队列消息未确认

#### 错误表现
消息被重复投递，导致重复处理。

#### 正确处理
```typescript
export async function queue(
  batch: MessageBatch<RetryMessage>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processMessage(message.body, env);
      message.ack();  // 重要：成功后确认消息
    } catch (error) {
      if (shouldRetry(error)) {
        message.retry({ delaySeconds: 60 });
      } else {
        // 不可重试的错误，记录并确认
        await logFailure(message.body, error, env);
        message.ack();
      }
    }
  }
}
```

## 安全相关错误

### 1. 加密密钥配置错误

#### 问题描述
加密密钥长度不符合要求（必须是32字符）。

#### 自动处理机制
```typescript
// src/utils/crypto.ts - 自动填充或截断
const key = encoder.encode(
  encryptKey.padEnd(32, '0').slice(0, 32)
);
```

#### 最佳实践
```bash
# 生成正确长度的密钥
openssl rand -hex 16  # 生成32字符的十六进制密钥

# 设置环境变量
ENCRYPT_KEY=a1b2c3d4e5f6789012345678901234567
```

### 2. 签名时间窗口

#### 配置
```typescript
// API 签名有效期：5分钟
const SIGNATURE_WINDOW = 5 * 60 * 1000;

// Lark 签名有效期：5分钟（300秒）
const LARK_SIGNATURE_WINDOW = 300;
```

### 3. 威胁检测

#### 敏感内容检测
```typescript
// src/utils/security.ts
function detectThreats(content: string): boolean {
  const threats = [
    /\b(password|passwd|pwd)\s*[:=]/i,
    /\b(api[_-]?key|apikey)\s*[:=]/i,
    /\b(secret|token)\s*[:=]/i,
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // 信用卡
  ];
  
  return threats.some(pattern => pattern.test(content));
}
```

#### 错误处理
```typescript
if (detectThreats(content)) {
  throw new NotificationSystemError(
    'Content contains potential security threats',
    'SECURITY_THREAT_DETECTED',
    false
  );
}
```

## 数据验证错误

### 1. JSON 解析错误

#### 安全的 JSON 解析
```typescript
// ✅ 使用安全的解析方法
function parseJsonSafe<T = unknown>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    logger.warn('JSON parse failed', { input: json.substring(0, 100) });
    return null;
  }
}

// 使用示例
const config = parseJsonSafe<WebhookConfig>(configData);
if (!config) {
  throw new ValidationError('Invalid configuration format');
}
```

### 2. URL 验证

#### 验证 webhook URL
```typescript
// ✅ 严格的 URL 验证
function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // 只允许 HTTPS（生产环境）
    if (env.ENVIRONMENT === 'production' && parsed.protocol !== 'https:') {
      return false;
    }
    // 检查是否是内网地址
    const hostname = parsed.hostname;
    const isPrivate = (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.')
    );
    
    return !isPrivate || env.ENVIRONMENT === 'development';
  } catch {
    return false;
  }
}
```

## 开发最佳实践

### 1. 提交前检查清单

```bash
# 1. 类型检查
npm run typecheck
npm run typecheck:prod

# 2. 运行测试
npm test

# 3. 检查敏感文件
git status
ls -la | grep -E "(wrangler\.toml|\.env|\.db)"

# 4. 验证导入路径
grep -r "from '\.\.\/\.\.\/" src/
```

### 2. 添加新功能流程

1. **更新类型定义**
   ```typescript
   // src/types/index.ts
   export interface NewFeature {
     // 定义接口
   }
   ```

2. **更新数据库 schema**
   ```typescript
   // src/db/schema.ts
   export const newTable = sqliteTable('new_table', {
     // 定义表结构
   });
   ```

3. **生成迁移**
   ```bash
   npm run db:generate
   ```

4. **编写测试**
   ```typescript
   // src/__tests__/newFeature.test.ts
   describe('NewFeature', () => {
     // 测试用例
   });
   ```

5. **更新文档**
   - API 文档
   - 配置说明
   - 使用示例

### 3. 调试技巧

#### 本地调试
```bash
# 启用详细日志
LOG_LEVEL=debug npm run dev

# 查看实时日志
wrangler tail

# 测试特定端点
npm run test:local -- --endpoint /api/send-notification
```

#### 生产环境调试
```bash
# 查看生产日志
wrangler tail --env production

# 查询数据库
wrangler d1 execute notification-system \
  --command="SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 10"
```

### 4. 性能优化检查

1. **避免 N+1 查询**
   ```typescript
   // ❌ 错误
   for (const user of users) {
     const config = await getConfig(user.id);
   }
   
   // ✅ 正确
   const configs = await getConfigs(users.map(u => u.id));
   ```

2. **使用缓存**
   ```typescript
   // ✅ 缓存用户配置
   const cached = await env.CONFIG_CACHE.get(cacheKey);
   if (cached) return JSON.parse(cached);
   ```

3. **批量操作**
   ```typescript
   // ✅ 批量插入
   await db.insert(notificationLogs).values(logs);
   ```

## 故障恢复流程

### 1. 数据库错误恢复

```bash
# 1. 检查数据库状态
wrangler d1 info notification-system

# 2. 执行健康检查
curl https://your-worker.workers.dev/api/health

# 3. 手动执行迁移（如需要）
./scripts/database/manual-migration.sh
```

### 2. 队列阻塞恢复

```bash
# 1. 检查队列状态
wrangler queues list

# 2. 清理死信队列
curl -X POST https://your-worker.workers.dev/api/admin/clear-failed-queue \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 监控和告警

### 1. 关键指标监控

```typescript
// 需要监控的关键指标
interface MetricsToMonitor {
  // 成功率
  successRate: number;         // 告警阈值: < 95%
  
  // 响应时间
  avgResponseTime: number;     // 告警阈值: > 1000ms
  p95ResponseTime: number;     // 告警阈值: > 3000ms
  
  // 错误率
  errorRate: number;           // 告警阈值: > 5%
  retryRate: number;           // 告警阈值: > 10%
  
  // 队列健康
  queueDepth: number;          // 告警阈值: > 1000
  deadLetterCount: number;     // 告警阈值: > 100
}
```

### 2. 错误日志分析

```bash
# 查找最常见的错误
wrangler d1 execute notification-system --command="
  SELECT error_message, COUNT(*) as count 
  FROM notification_logs 
  WHERE status = 'failed' 
  AND created_at > datetime('now', '-1 day')
  GROUP BY error_message 
  ORDER BY count DESC 
  LIMIT 10
"

# 查找重试失败的通知
wrangler d1 execute notification-system --command="
  SELECT * FROM notification_logs 
  WHERE retry_count >= 2 
  AND status = 'failed'
  ORDER BY created_at DESC
"
```

## 故障排查决策树

### 通知未收到

1. **检查请求状态**
   ```bash
   # 查询通知日志
   curl https://api.example.com/api/logs?user_id=USER_ID
   ```

2. **验证用户配置**
   ```bash
   # 检查用户渠道配置
   curl https://api.example.com/api/users/USER_ID/configs
   ```

3. **检查模板状态**
   ```sql
   SELECT * FROM notification_templates_v2 
   WHERE template_key = 'YOUR_TEMPLATE' 
   AND is_active = 1;
   ```

4. **验证签名**
   - 检查时间同步
   - 验证密钥配置
   - 查看签名日志

### 性能问题

1. **识别慢查询**
   ```typescript
   // 添加查询计时
   const start = performance.now();
   const result = await db.query(...);
   const duration = performance.now() - start;
   
   if (duration > 100) {
     logger.warn('Slow query detected', { duration, query });
   }
   ```

2. **检查缓存命中率**
   ```typescript
   // 监控缓存效率
   let cacheHits = 0;
   let cacheMisses = 0;
   
   // 定期报告
   const hitRate = cacheHits / (cacheHits + cacheMisses);
   logger.info('Cache performance', { hitRate, hits: cacheHits, misses: cacheMisses });
   ```

## 相关文档

- [TypeScript 开发规范](./typescript-guidelines.md) - 类型系统和编码规范
- [数据库管理指南](../database.md) - Drizzle ORM 使用指南
- [部署指南](../deployment.md) - 部署流程和配置
- [测试指南](../testing.md) - 测试策略和工具
- [安全实施指南](../../04-security/security-guide.md) - 安全最佳实践
- [监控指南](../../05-operations/monitoring.md) - 监控和告警配置

---

## 附录：错误代码速查表

| 错误代码 | HTTP 状态码 | 说明 | 可重试 |
|---------|------------|------|--------|
| VALIDATION_ERROR | 400 | 参数验证失败 | 否 |
| INVALID_REQUEST | 400 | 请求格式错误 | 否 |
| INVALID_USER_ID | 400 | 用户 ID 无效 | 否 |
| INVALID_CHANNELS | 400 | 渠道配置错误 | 否 |
| MISSING_SIGNATURE | 401 | 缺少签名 | 否 |
| INVALID_SIGNATURE | 401 | 签名无效 | 否 |
| REQUEST_EXPIRED | 401 | 请求过期 | 否 |
| NOT_FOUND | 404 | 资源不存在 | 否 |
| RATE_LIMIT_EXCEEDED | 429 | 超过速率限制 | 是 |
| INTERNAL_ERROR | 500 | 内部错误 | 是 |
| DB_ERROR | 503 | 数据库错误 | 是 |
| NETWORK_ERROR | 503 | 网络错误 | 是 |
| TIMEOUT_ERROR | 503 | 超时错误 | 是 |
| SECURITY_THREAT_DETECTED | 400 | 检测到安全威胁 | 否 |
| DB_CONNECTION_ERROR | 503 | 数据库连接失败 | 是 |

---

**最后更新**: 2025-01-05
**版本**: 2.1 - 添加安全相关内容和监控指南
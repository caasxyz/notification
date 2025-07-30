# Notification System - 项目上下文和背景

## 项目演进历史

### V1 → V2 架构迁移
项目从 V1 架构迁移到 V2，主要变化：
- **模板系统**: 从单一模板改为模板定义与渠道内容分离
- **数据库表**: `notification_templates` → `notification_templates_v2` + `template_contents`
- **API 路径**: 保持兼容，内部实现升级
- **缓存策略**: 引入 ConfigCache 服务统一管理

### 重要设计决策

1. **不使用 Hono Framework**
   - 原因：与 Cloudflare Workers 类型系统冲突
   - 解决：使用 itty-router + 自定义处理器模式
   - 签名：`(request: Request, env: Env) => Promise<Response>`

2. **使用毫秒级时间戳**
   - 原因：前端 JavaScript `Date.now()` 返回毫秒
   - 实现：所有签名验证使用毫秒时间戳
   - 注意：文档中曾有秒级时间戳的错误示例

3. **简单模板引擎**
   - 不使用 Handlebars 或其他复杂模板引擎
   - 仅支持 `{{variable}}` 简单替换
   - 原因：减小包体积，提高性能

4. **D1 数据库限制适配**
   - 所有字符串使用 TEXT（不支持 VARCHAR）
   - 布尔值使用 INTEGER（0/1）
   - 不使用 ENUM，改用 CHECK 约束

## 项目重构历史

### 2025-01-06 大规模文档重构
- **背景**: 文档分散、重复、部分过时
- **目标**: 整合文档，全部中文化，确保与代码一致
- **方法**: 每个文档至少 3 次迭代，确保质量
- **结果**: 
  - 从 40+ 文档精简到 15 个核心文档
  - 删除所有重复内容
  - 更新所有 API 示例和配置
  - 修正时间戳精度等关键错误

### 安全增强实施
- **已完成**: 基础安全功能（签名验证、输入验证、CORS）
- **部分完成**: 速率限制（仅全局级别）
- **待实现**: SSRF 防护、审计日志、威胁检测
- **原因**: 优先保证核心功能稳定

## 关键代码模式

### 1. API 处理器模式
```typescript
// 不使用 Hono Context
export async function handler(
  request: Request,
  env: Env,
): Promise<Response> {
  // 实现
}
```

### 2. 数据库连接单例
```typescript
const dbCache = new WeakMap<Env, ReturnType<typeof drizzle>>();
export function getDb(env: Env) {
  if (!dbCache.has(env)) {
    const db = drizzle(env.DB, { schema });
    dbCache.set(env, db);
  }
  return dbCache.get(env)!;
}
```

### 3. 缓存键命名
```
user_config:{userId}:{channelType}
system_config:{configKey}
template:{templateKey}
template:{templateKey}:{channel}
```

### 4. 错误处理
```typescript
// 使用自定义错误类
throw new NotificationSystemError(
  'TEMPLATE_NOT_FOUND',
  `Template ${templateKey} not found`,
  404
);
```

## 测试和调试技巧

### 1. 测试脚本正确用法
```bash
# 正确：使用子命令
npm run test:grafana send
npm run test:grafana webhook

# 错误：使用标志
npm run test:grafana --send  # 不工作！
```

### 2. 签名生成示例
```javascript
// 正确：毫秒时间戳
const timestamp = Date.now().toString();
const payload = timestamp + JSON.stringify(body);
const signature = crypto.createHmac('sha256', API_SECRET)
  .update(payload)
  .digest('hex');

// 错误：秒级时间戳
const timestamp = Math.floor(Date.now() / 1000).toString(); // 不要这样！
```

### 3. 数据库查询调试
```bash
# 查看表结构
wrangler d1 execute notification-system --command="SELECT sql FROM sqlite_master WHERE type='table'"

# 检查数据
wrangler d1 execute notification-system --command="SELECT * FROM notification_templates_v2"
```

## 生产环境注意事项

### 1. 环境变量
- 所有密钥至少 32 字符
- 使用 wrangler secret 设置敏感信息
- 不要在 wrangler.toml 中硬编码密钥

### 2. 数据库迁移
- 生产环境需要 `--force` 参数
- 先在开发环境测试迁移脚本
- 保留回滚方案

### 3. 监控要点
- 关注速率限制命中率
- 监控队列积压情况
- 跟踪缓存命中率
- 检查错误日志模式

### 4. 性能基准
- 单通知延迟: <200ms (P95)
- 批量通知: 100 ops/sec
- 缓存命中率: >90%
- 错误率: <0.1%

## 常见错误和解决方案

### 1. "String to replace not found"
- 原因：MultiEdit 工具字符串匹配失败
- 解决：使用 Read 工具确认准确文本

### 2. 模板渲染返回空
- 检查 `is_active` 字段
- 确认 `template_contents` 表有对应渠道数据
- 验证 JOIN 查询逻辑

### 3. 缓存不一致
- KV 是最终一致的
- 写入后等待几秒再读取
- 使用 `waitUntil` 异步写入

### 4. 队列处理失败
- 检查批处理大小设置
- 验证重试逻辑
- 查看死信队列

## 项目特定业务逻辑

### 飞书签名特殊实现
```typescript
// Lark 特殊的 HMAC 签名实现
const stringToSign = `${timestamp}\n${secret}`;
const signature = crypto
  .createHmac('sha256', stringToSign)
  .update('')  // 空消息体
  .digest('base64');
```

### 模板变量自动提取
```typescript
// Grafana 告警变量提取
const variables = {
  status: alert.status,
  alertCount: alerts.length,
  alertname: alert.labels.alertname,
  severity: alert.labels.severity || 'warning',
  summary: alert.annotations.summary,
  description: alert.annotations.description,
  service: alert.labels.service,
  instance: alert.labels.instance,
  values: alert.values
};
```

### 幂等性实现细节
- 存储在专门表 `idempotency_keys`
- 复合主键: (idempotency_key, user_id)
- 返回缓存的 message_ids
- 自动清理过期键（cron 任务）

### 通知渠道限制
- **Lark**: 最大 10,000 字符
- **Telegram**: MarkdownV2 格式，4096 字符
- **Slack**: mrkdwn 格式，3000 字符
- **Webhook**: 无特定限制，但建议 <100KB

### 队列处理特点
- 批处理优先级：按 created_at 排序
- 失败重试：仅对瞬时错误（网络、超时）
- 死信队列：永久性失败存储
- 手动重试：通过 API 触发

## 未来改进方向

### 技术债务
1. 完善速率限制实现
2. 实现 SSRF 防护
3. 添加审计日志持久化
4. 优化错误处理一致性

### 功能增强
1. 支持更多通知渠道
2. 实现通知模板继承
3. 添加通知调度功能
4. 支持批量导入导出

### 架构优化
1. 考虑使用 Durable Objects 管理状态
2. 实现更智能的缓存策略
3. 优化数据库查询性能
4. 改进队列处理效率

## 特殊的实现决策

### 为什么不使用完整模板引擎
1. **包体积考虑**: Handlebars 等库太大
2. **性能要求**: Workers 有 CPU 时间限制
3. **安全性**: 避免模板注入攻击
4. **需求简单**: 只需要基本变量替换

### 为什么使用 INTEGER 存储布尔值
1. **D1 限制**: SQLite 没有真正的 BOOLEAN 类型
2. **性能**: INTEGER 比 TEXT 更高效
3. **兼容性**: 所有 SQL 数据库都支持
4. **Drizzle ORM**: 自动处理类型转换

### 为什么采用单例模式管理数据库连接
1. **Workers 限制**: 每个请求是新的执行上下文
2. **性能**: 避免重复创建连接
3. **WeakMap**: 自动垃圾回收
4. **线程安全**: Workers 是单线程的

### Grafana Webhook 的特殊处理
1. **Basic Auth**: Grafana 不支持自定义签名
2. **变量提取**: 自动解析告警结构
3. **模板选择**: 通过标签自动选择
4. **状态映射**: firing/resolved 到变量

---

**文档目的**: 保存项目深层次的上下文信息，帮助快速恢复对项目的理解  
**更新时间**: 2025-01-06  
**维护策略**: 遇到重要决策或问题解决方案时更新
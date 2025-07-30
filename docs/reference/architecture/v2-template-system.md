# V2 模板系统架构文档

## 概述

通知系统采用 V2 模板架构，实现了模板定义与渠道内容的分离设计。这种架构允许一个模板支持多个通知渠道，每个渠道可以有独立的内容格式和配置。

## 核心设计理念

### 1. 分离关注点
- **模板定义**：管理模板元数据和变量
- **渠道内容**：每个渠道的具体实现
- **用户配置**：用户的渠道配置信息
- **通知日志**：完整的发送记录

### 2. 灵活性
- 一个模板可以支持任意数量的渠道
- 每个渠道可以有不同的内容格式
- 支持渠道特定的配置

### 3. 可扩展性
- 轻松添加新的通知渠道
- 不影响现有模板和渠道

## 数据库架构

### notification_templates_v2 表
存储模板的核心信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 自增主键 |
| `template_key` | TEXT | 模板唯一标识符 |
| `template_name` | TEXT | 模板显示名称 |
| `description` | TEXT | 模板描述 |
| `variables` | TEXT (JSON) | 模板变量列表 |
| `is_active` | BOOLEAN | 是否激活 |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

**示例数据：**
```json
{
  "template_key": "order-confirmation",
  "template_name": "订单确认",
  "description": "订单确认通知模板",
  "variables": ["orderId", "amount", "customerName", "items"],
  "is_active": true
}
```

### template_contents 表
存储每个渠道的具体内容和配置。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 自增主键 |
| `template_key` | TEXT | 关联的模板 key |
| `channel_type` | TEXT | 渠道类型 |
| `subject_template` | TEXT | 主题模板（可选） |
| `content_template` | TEXT | 内容模板 |
| `content_type` | TEXT | 内容类型 |
| `extra_config` | TEXT (JSON) | 额外配置 |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

**支持的渠道类型：**
- `webhook` - HTTP Webhook
- `telegram` - Telegram 机器人
- `lark` - 飞书/Lark
- `slack` - Slack
- `email` - 电子邮件（预留）
- `sms` - 短信（预留）

**内容类型：**
- `text` - 纯文本
- `html` - HTML 格式
- `markdown` - Markdown 格式
- `json` - JSON 结构

## 模板变量系统

### 变量定义
模板变量在 `notification_templates_v2.variables` 中定义为 JSON 数组：

```json
["orderId", "amount", "customerName", "items", "orderDate"]
```

### 变量使用
使用双花括号语法在模板中引用变量：

```
订单号：{{orderId}}
金额：{{amount}}
客户：{{customerName}}
```

**注意**：系统使用简单的字符串替换，不是完整的 Handlebars 模板引擎。

### 系统变量
系统变量需要开发者在调用时手动提供，不会自动注入。常用的系统变量约定（以下划线开头）：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `_timestamp` | 当前时间戳（秒） | 1736100000 |
| `_date` | 格式化日期 | 2025-01-05 |
| `_time` | 格式化时间 | 14:30:00 |
| `_datetime` | 完整日期时间 | 2025-01-05 14:30:00 |

开发者需要在发送通知时显式传递这些变量：
```json
{
  "variables": {
    "orderId": "12345",
    "_timestamp": "1736100000",
    "_datetime": "2025-01-05 14:30:00"
  }
}

## 渠道特定实现

### 飞书（Lark）渠道

飞书支持富文本卡片消息。注意 `content_template` 字段应该是 JSON 字符串：

```json
{
  "content_template": "{\"msg_type\":\"interactive\",\"card\":{\"header\":{\"title\":{\"content\":\"订单确认 #{{orderId}}\",\"tag\":\"plain_text\"},\"template\":\"blue\"},\"elements\":[{\"tag\":\"div\",\"text\":{\"content\":\"**客户**: {{customerName}}\\n**金额**: ¥{{amount}}\",\"tag\":\"lark_md\"}},{\"tag\":\"div\",\"fields\":[{\"is_short\":true,\"text\":{\"content\":\"**下单时间**\\n{{orderDate}}\",\"tag\":\"lark_md\"}},{\"is_short\":true,\"text\":{\"content\":\"**商品数量**\\n{{items}} 件\",\"tag\":\"lark_md\"}}]}]}}",
  "content_type": "json"
}
```

### Telegram 渠道

Telegram 支持 Markdown 格式：

```json
{
  "content_template": "🛍️ *订单确认*\n\n订单号: `{{orderId}}`\n客户: {{customerName}}\n金额: ¥{{amount}}\n\n_感谢您的购买！_",
  "content_type": "markdown",
  "extra_config": {
    "parse_mode": "MarkdownV2",
    "disable_notification": false
  }
}
```

### Webhook 渠道

Webhook 发送 JSON 格式数据。对于 JSON 类型的内容，`content_template` 应该是 JSON 对象或字符串：

```json
{
  "content_template": "{\"event\":\"order.confirmed\",\"orderId\":\"{{orderId}}\",\"amount\":\"{{amount}}\",\"customer\":\"{{customerName}}\",\"items\":\"{{items}}\",\"timestamp\":\"{{_timestamp}}\"}",
  "content_type": "json",
  "extra_config": {
    "method": "POST",
    "headers": {
      "X-Event-Type": "order-confirmation"
    }
  }
}
```

## API 使用指南

### 1. 创建模板

首先创建模板定义：

```bash
# 生成签名
TIMESTAMP=$(date +%s)
BODY='{"name":"订单确认","description":"发送给客户的订单确认通知","variables":["orderId","amount","customerName","items","orderDate"]}'
SIGNATURE=$(echo -n "${TIMESTAMP}${BODY}" | openssl dgst -sha256 -hmac "$API_SECRET_KEY" -hex | cut -d' ' -f2)

# 发送请求
curl -X POST http://localhost:8788/api/templates/order-confirmation \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -d "$BODY"
```

### 2. 添加渠道内容

为飞书渠道添加内容：

```bash
# 简单文本消息
BODY='{
  "content_template": "{\"msg_type\":\"text\",\"content\":{\"text\":\"订单确认\\n\\n订单号: {{orderId}}\\n客户: {{customerName}}\\n金额: ¥{{amount}}\"}}",
  "content_type": "json"
}'

# 富文本卡片消息
BODY='{
  "content_template": "{\"msg_type\":\"interactive\",\"card\":{\"header\":{\"title\":{\"content\":\"订单确认 #{{orderId}}\",\"tag\":\"plain_text\"},\"template\":\"blue\"},\"elements\":[{\"tag\":\"div\",\"text\":{\"content\":\"**客户**: {{customerName}}\\n**金额**: ¥{{amount}}\",\"tag\":\"lark_md\"}}]}}",
  "content_type": "json"
}'

curl -X POST http://localhost:8788/api/templates/order-confirmation/contents/lark \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -d "$BODY"
```

### 3. 使用模板发送通知

```bash
curl -X POST http://localhost:8788/api/send-notification \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: $SIGNATURE" \
  -d '{
    "user_id": "customer-123",
    "channels": ["lark", "webhook"],
    "template_key": "order-confirmation",
    "variables": {
      "orderId": "ORD-2025-001",
      "amount": "299.99",
      "customerName": "张三",
      "items": [
        {"name": "商品A", "quantity": 2},
        {"name": "商品B", "quantity": 1}
      ],
      "orderDate": "2025-01-05 14:30:00"
    }
  }'
```

## 高级功能

### 高级模板功能

当前系统使用简单的字符串替换机制，**不支持**以下高级功能：

- 条件渲染（if/else）
- 循环渲染（each）
- 辅助函数（uppercase、formatDate 等）
- 嵌套对象访问（如 `{{user.name}}`）

如需实现复杂逻辑，建议：
1. 在应用层预处理数据
2. 使用多个简单变量替代复杂结构
3. 对于 JSON 类型的模板，可以在内容中使用原生 JSON 结构

## 实际使用示例

### 完整的模板创建流程

```bash
# 1. 创建模板定义
TIMESTAMP=$(date +%s)
BODY='{"name":"告警通知","description":"系统告警通知模板","variables":["alertName","severity","instance","description"]}'
SIGNATURE=$(echo -n "${TIMESTAMP}${BODY}" | openssl dgst -sha256 -hmac "$API_SECRET_KEY" -hex | cut -d' ' -f2)

curl -X POST http://localhost:8788/api/templates/system-alert \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -d "$BODY"

# 2. 添加飞书内容
BODY='{
  "content_template": "{\"msg_type\":\"interactive\",\"card\":{\"header\":{\"title\":{\"content\":\"🚨 {{alertName}}\",\"tag\":\"plain_text\"},\"template\":\"red\"},\"elements\":[{\"tag\":\"div\",\"text\":{\"content\":\"**级别**: {{severity}}\\n**实例**: {{instance}}\\n**描述**: {{description}}\",\"tag\":\"lark_md\"}}]}}",
  "content_type": "json"
}'
# ... 发送请求

# 3. 添加 Webhook 内容
BODY='{
  "content_template": "{\"alertName\":\"{{alertName}}\",\"severity\":\"{{severity}}\",\"instance\":\"{{instance}}\",\"description\":\"{{description}}\",\"timestamp\":\"{{_timestamp}}\"}",
  "content_type": "json"
}'
# ... 发送请求

# 4. 使用模板发送通知
TIMESTAMP=$(date +%s)
BODY='{
  "user_id": "ops-team",
  "channels": ["lark", "webhook"],
  "template_key": "system-alert",
  "variables": {
    "alertName": "CPU使用率过高",
    "severity": "critical",
    "instance": "server-01",
    "description": "CPU使用率超过90%持续5分钟",
    "_timestamp": "'$TIMESTAMP'"
  },
  "idempotency_key": "alert-cpu-high-'$TIMESTAMP'"
}'
SIGNATURE=$(echo -n "${TIMESTAMP}${BODY}" | openssl dgst -sha256 -hmac "$API_SECRET_KEY" -hex | cut -d' ' -f2)

curl -X POST http://localhost:8788/api/send-notification \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -d "$BODY"
```

## 模板管理最佳实践

### 1. 命名规范

- 使用小写字母和连字符
- 采用描述性名称
- 按业务领域分组

```
# 订单相关
order-confirmation     # 订单确认
order-shipped         # 订单发货
order-cancelled       # 订单取消

# 用户相关
user-welcome          # 欢迎新用户
user-password-reset   # 密码重置

# 支付相关
payment-success       # 支付成功
payment-failed        # 支付失败

# 系统相关
system-alert          # 系统告警
system-maintenance    # 系统维护
```

### 2. 变量设计

- 使用驼峰命名法
- 避免深层嵌套
- 提供合理的默认值

```json
{
  "orderId": "ORD-123",
  "customerInfo": {
    "name": "张三",
    "email": "zhang@example.com"
  },
  "amount": 299.99,
  "items": []
}
```

### 3. 版本控制

当需要修改模板时：

```bash
# 1. 创建新版本的模板
curl -X POST .../api/templates/order-confirmation-v2 ...

# 2. 复制旧模板内容并修改
curl -X GET .../api/templates/order-confirmation  # 获取旧模板
# 修改后创建新模板内容

# 3. 测试新模板
curl -X POST .../api/send-notification \
  -d '{"template_key":"order-confirmation-v2",...}'

# 4. 逐步迁移
# 在业务代码中根据条件使用不同版本

# 5. 废弃旧模板
curl -X DELETE .../api/templates/order-confirmation
```

### 4. 测试策略

```javascript
// 测试用例示例
const testCases = [
  {
    name: "正常情况",
    variables: {
      orderId: "TEST-001",
      amount: "99.99",
      customerName: "测试用户"
    }
  },
  {
    name: "特殊字符",
    variables: {
      orderId: "TEST-002",
      amount: "<script>alert('xss')</script>",
      customerName: "张\"&<>\u4e09"
    }
  },
  {
    name: "缺少变量",
    variables: {
      orderId: "TEST-003"
      // amount 和 customerName 缺失
    }
  },
  {
    name: "长文本",
    variables: {
      orderId: "TEST-004",
      amount: "99.99",
      customerName: "A".repeat(10000) // 测试长度限制
    }
  }
];

// 使用测试界面进行验证
// 访问 http://localhost:8788/test-ui
```

## 故障排查

### 常见问题

#### 1. 模板变量未替换

**原因**：
- 变量名拼写错误或未传递
- 变量值为 `undefined`（系统会保留原始占位符）
- 变量名不符合正则 `\w+`（只支持字母、数字、下划线）

**解决**：
- 检查模板定义中的变量列表
- 确保传递的变量名完全匹配
- 使用日志查看实际渲染结果

**调试示例**：
```bash
# 查看渲染后的内容
curl -X GET "http://localhost:8788/api/logs?user_id=test&limit=1" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: $SIGNATURE"
```

#### 2. 渠道内容为空

**原因**：
- 未为指定渠道创建内容
- 模板未激活（is_active = false）
- JOIN 查询失败（模板主记录不存在）

**解决**：
1. 检查模板状态：`GET /api/templates/{template_key}`
2. 确认渠道内容存在
3. 使用 API 添加缺失的渠道内容

#### 3. JSON 解析错误

**原因**：
- 模板内容不是有效的 JSON
- 变量替换后破坏了 JSON 结构
- 特殊字符未正确转义

**解决**：
- 对于 JSON 类型的内容，确保 `content_template` 是合法的 JSON 字符串
- 使用 JSON.stringify() 预处理复杂对象
- 注意双引号的转义：`\"`

**正确的 JSON 模板示例**：
```json
{
  "content_template": "{\"event\":\"{{eventType}}\",\"data\":{\"id\":\"{{id}}\",\"name\":\"{{name}}\"}}",
  "content_type": "json"
}
```

### 调试技巧

1. **查看模板详情**
   ```bash
   GET /api/templates/order-confirmation
   ```

2. **检查日志**
   ```bash
   GET /api/logs?user_id=xxx&template_key=order-confirmation
   ```

3. **使用测试界面**
   访问 `/test-ui` 进行可视化测试

4. **查看实时日志**
   ```bash
   wrangler tail --env production
   ```

## 性能优化

### 1. 模板缓存

系统使用 CONFIG_CACHE KV 存储缓存用户配置：
- 缓存时间：5 分钟
- 缓存键：`user:${user_id}:configs`

**注意**：模板内容本身不缓存，每次都从数据库读取以确保获取最新数据。

### 2. 批量处理

当发送给多个渠道时，系统会：
- 使用单个 JOIN 查询获取所有渠道的模板内容
- 依次渲染各渠道内容（for 循环处理）
- 通过 CONFIG_CACHE 缓存用户配置（5 分钟 TTL）
- 使用 Promise.allSettled() 并发发送通知

### 3. 数据库索引

确保以下索引存在：
```sql
CREATE INDEX idx_template_contents_key ON template_contents(template_key);
CREATE INDEX idx_template_contents_channel ON template_contents(template_key, channel_type);
CREATE INDEX idx_templates_v2_key ON notification_templates_v2(template_key);
CREATE INDEX idx_templates_v2_active ON notification_templates_v2(is_active);
```

## 安全考虑

### 1. 输入验证

- 模板 key 格式：`^[a-z0-9-]+$`（3-50 字符）
- 变量名格式：`^[a-zA-Z_][a-zA-Z0-9_]*$`（字母或下划线开头）
- 内容长度限制：通过 `SecurityUtils.sanitizeTemplateValue` 控制
- 特殊字符自动转义：防止 XSS 攻击

### 2. XSS 防护

- 通过 `SecurityUtils.sanitizeTemplateValue` 转义特殊字符
- 限制变量值长度（默认 10,000 字符）
- 自动移除控制字符和不可见字符
- 对 HTML 内容进行特殊处理

### 3. 权限控制

- 模板创建需要管理员权限
- 用户只能发送到自己配置的渠道
- API 密钥认证

### 4. 模板内容安全

- **SQL 注入防护**：使用 Drizzle ORM 参数化查询
- **SSRF 防护**：Webhook URL 验证私有 IP 和本地地址
- **内容长度限制**：默认 10,000 字符
- **特殊字符处理**：自动移除控制字符

## 迁移指南

### 从 V1 迁移到 V2

1. **导出 V1 数据**
   ```sql
   SELECT * FROM notification_templates;
   ```

2. **转换数据格式**
   - 将 `channel_type` 字段移除
   - 创建 `notification_templates_v2` 记录
   - 为每个渠道创建 `template_contents` 记录

3. **更新 API 调用**
   - 使用新的端点路径
   - 更新请求格式

4. **验证迁移**
   - 测试每个模板
   - 检查渲染结果
   - 监控错误日志

## 未来规划

### 即将支持的功能

1. **模板继承**
   - 基础模板和扩展模板
   - 共享通用内容

2. **A/B 测试**
   - 多版本模板
   - 自动分流

3. **模板分析**
   - 打开率统计
   - 点击率跟踪

4. **可视化编辑器**
   - 拖拽式界面
   - 实时预览

## 总结

V2 模板系统的核心特点：

1. **简单易用**：使用简单的字符串替换，避免复杂性
2. **灵活性高**：一个模板支持多渠道，每个渠道独立配置
3. **性能优化**：通过 JOIN 查询和缓存机制提升效率
4. **安全可靠**：内置 XSS 防护和输入验证

使用建议：
- 对于复杂逻辑，在应用层预处理
- 保持变量名简单直观
- 充分测试各种边界情况
- 定期清理不再使用的模板

---

**最后更新**: 2025-01-05
**版本**: 2.0
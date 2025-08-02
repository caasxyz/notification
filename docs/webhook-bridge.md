# Webhook Bridge 功能文档

## 概述

Webhook Bridge 是一个无需认证的转发端点，可以将任意 webhook 请求转发到指定用户的指定通知渠道。这个功能特别适合集成不支持自定义认证的第三方服务。

## 端点信息

```
POST /web_hook/bridge/{user_id}/{channel_type}
```

### 参数说明

- `user_id`: 目标用户 ID
- `channel_type`: 目标通知渠道，支持以下类型：
  - `webhook` - 转发到用户配置的 webhook
  - `telegram` - 发送到 Telegram
  - `lark` - 发送到飞书
  - `slack` - 发送到 Slack

### 特点

- **无需认证**: 不需要 API 密钥或签名验证
- **灵活的内容格式**: 支持 JSON、纯文本、表单数据
- **智能内容提取**: 自动识别常见的 webhook 格式
- **幂等性保证**: 每个请求生成唯一的 idempotency key

## 使用示例

### 1. JSON 格式

```bash
curl -X POST https://api.example.com/web_hook/bridge/user123/lark \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "服务器告警",
    "message": "CPU 使用率超过 90%",
    "severity": "critical"
  }'
```

### 2. 纯文本格式

```bash
curl -X POST https://api.example.com/web_hook/bridge/user123/telegram \
  -H "Content-Type: text/plain" \
  -d "系统维护通知：今晚 10 点进行系统升级"
```

### 3. 表单数据

```bash
curl -X POST https://api.example.com/web_hook/bridge/user123/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "title=新订单&message=您有一个新的订单等待处理&order_id=12345"
```

## 内容映射规则

系统会智能识别并提取以下字段：

### 标题/主题
按优先级查找：
1. `subject`
2. `title`
3. `summary`
4. 默认: "Webhook Notification"

### 内容
按优先级查找：
1. `text`
2. `message`
3. `content`
4. `payload` (如果是字符串或对象)
5. 整个请求体的 JSON 格式化字符串

## 集成场景

### 1. 监控系统集成

许多监控系统（如 Prometheus Alertmanager、Zabbix）支持 webhook 但不支持自定义认证：

```yaml
# Prometheus Alertmanager 配置示例
webhook_configs:
  - url: 'https://api.example.com/web_hook/bridge/ops-team/lark'
    send_resolved: true
```

### 2. CI/CD 集成

GitHub Actions、GitLab CI 等可以直接调用：

```yaml
# GitHub Actions 示例
- name: Send notification
  run: |
    curl -X POST ${{ secrets.WEBHOOK_URL }}/web_hook/bridge/dev-team/slack \
      -H "Content-Type: application/json" \
      -d '{
        "title": "部署完成",
        "message": "版本 ${{ github.sha }} 已部署到生产环境"
      }'
```

### 3. 第三方 SaaS 集成

许多 SaaS 服务只支持简单的 webhook：

- **Stripe**: 支付事件通知
- **Sentry**: 错误告警
- **PagerDuty**: 事件通知
- **Datadog**: 监控告警

## 响应格式

### 成功响应

```json
{
  "success": true,
  "message": "Notification forwarded successfully",
  "message_id": "msg_xxx",
  "duration": 156
}
```

### 错误响应

```json
{
  "success": false,
  "error": "User configuration not found",
  "errors": ["telegram: User config not found"]
}
```

## 安全考虑

1. **URL 保密**: 由于无需认证，请确保 URL 的保密性
2. **用户 ID**: 使用复杂的用户 ID 避免被猜测
3. **速率限制**: 系统会自动应用速率限制防止滥用
4. **内容过滤**: 自动过滤敏感信息

## 测试工具

使用提供的测试脚本：

```bash
# 测试发送到 webhook
npm run test:webhook-bridge test-user webhook

# 测试发送到飞书
npm run test:webhook-bridge test-user lark
```

## 注意事项

1. 用户必须先配置对应的通知渠道
2. 消息大小限制为 1MB
3. 支持的字符编码：UTF-8
4. 建议在生产环境使用 HTTPS
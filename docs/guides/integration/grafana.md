# Grafana 集成指南

本指南详细介绍如何将 Grafana 告警系统与通知系统集成，实现告警的多渠道推送。

## 目录

- [概述](#概述)
- [系统架构](#系统架构)
- [配置步骤](#配置步骤)
- [Grafana 配置](#grafana-配置)
- [API 接口](#api-接口)
- [模板系统](#模板系统)
- [测试方法](#测试方法)
- [最佳实践](#最佳实践)
- [故障排查](#故障排查)

## 概述

通知系统提供专门的 Grafana webhook 端点，支持：

- 接收 Grafana 告警并转发到多个通知渠道
- 使用 Grafana 的 `receiver` 字段作为用户 ID 进行路由
- 将 Grafana 告警格式转换为富文本通知
- 支持 firing（触发）和 resolved（恢复）状态
- 支持自定义模板和批量告警

## 系统架构

```
Grafana Alert Manager
        ↓
   Webhook (Basic Auth)
        ↓
Notification System API
   /api/webhooks/grafana
        ↓
  GrafanaWebhookHandler
        ↓
 GrafanaTransformAdapter
        ↓
NotificationDispatcherV2
        ↓
   Multiple Channels
   (Lark, Telegram, Webhook, etc.)
```

## 配置步骤

### 1. 环境变量配置

在部署环境中设置以下环境变量：

```bash
# 本地开发（.dev.vars）
GRAFANA_WEBHOOK_USERNAME=grafana
GRAFANA_WEBHOOK_PASSWORD=your-secure-password

# 生产环境（GitHub Secrets）
PROD_GRAFANA_USERNAME=grafana
PROD_GRAFANA_PASSWORD=your-production-password
```

### 2. 初始化 Grafana 模板（可选）

系统提供默认的 Grafana 告警模板。您也可以创建自定义模板：

```bash
# 创建默认 Grafana 模板
curl -X POST http://localhost:8788/api/templates \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d '{
    "template_key": "grafana-alert",
    "template_name": "Grafana 默认告警模板",
    "description": "适用于所有 Grafana 告警的通用模板",
    "variables": ["status", "alertCount", "alertname", "severity", "summary", "description", "instance"]
  }'

# 创建严重告警模板
curl -X POST http://localhost:8788/api/templates \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d '{
    "template_key": "grafana-alert-critical",
    "template_name": "Grafana 严重告警模板",
    "description": "用于严重级别告警的特殊模板",
    "variables": ["status", "alertCount", "alertname", "severity", "summary", "description", "instance", "runbook_url"]
  }'
```

### 3. 配置用户通知渠道

确保用户已配置通知渠道。Grafana 告警中的 `receiver` 字段将作为 `user_id` 使用：

```bash
# 示例：为 "ops-team" 配置多个通知渠道

# 1. 配置 Lark（飞书）
curl -X POST http://localhost:8788/api/user-configs \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: $SIGNATURE" \
  -d '{
    "user_id": "ops-team",
    "channel_type": "lark",
    "config": {
      "webhook_url": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
      "secret": "your-lark-secret"
    }
  }'

# 2. 配置 Webhook
curl -X POST http://localhost:8788/api/user-configs \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: $SIGNATURE" \
  -d '{
    "user_id": "ops-team",
    "channel_type": "webhook",
    "config": {
      "webhook_url": "https://your-webhook.com/alerts",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }'

# 3. 配置 Telegram
curl -X POST http://localhost:8788/api/user-configs \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: $SIGNATURE" \
  -d '{
    "user_id": "ops-team",
    "channel_type": "telegram",
    "config": {
      "bot_token": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
      "chat_id": "-1001234567890"
    }
  }'
```

## Grafana 配置

### 1. 创建 Contact Point（联系点）

在 Grafana 中，导航到 **Alerting → Contact points**，创建新的联系点：

```yaml
名称: Notification System - Ops Team
类型: webhook
设置:
  URL: https://your-domain.workers.dev/api/webhooks/grafana
  HTTP Method: POST
  Username: grafana
  Password: ${GRAFANA_WEBHOOK_PASSWORD}
  
  # 自定义头部 - 指定通知渠道
  自定义 HTTP 头:
    X-Notification-Channels: lark,webhook,telegram
```

### 2. 配置告警规则

创建告警规则时，设置 receiver 匹配您的用户 ID：

```yaml
# 示例告警规则
groups:
  - name: system_alerts
    rules:
      - alert: HighCPUUsage
        expr: cpu_usage_percent > 90
        for: 5m
        labels:
          severity: critical
          notification_template: grafana-alert-critical
        annotations:
          summary: CPU 使用率过高
          description: '服务器 {{ $labels.instance }} 的 CPU 使用率超过 90%'
```

### 3. 多团队配置

为不同团队创建不同的联系点：

```yaml
# 开发团队
- 名称: Notification System - Dev Team
  设置:
    URL: https://your-domain.workers.dev/api/webhooks/grafana
    自定义 HTTP 头:
      X-Notification-Channels: slack,email

# 安全团队  
- 名称: Notification System - Security Team
  设置:
    URL: https://your-domain.workers.dev/api/webhooks/grafana
    自定义 HTTP 头:
      X-Notification-Channels: telegram,webhook
```

然后在告警规则中：
- `receiver: dev-team` → 通知发送到 dev-team 的渠道
- `receiver: security-team` → 通知发送到 security-team 的渠道

## API 接口

### 端点信息

```
POST /api/webhooks/grafana
```

### 认证方式

使用 HTTP Basic Authentication：
- 用户名和密码通过环境变量配置
- 认证失败返回 401 状态码和 WWW-Authenticate 头
- 支持自定义用户名密码的环境变量 key

### 请求头

| 头部名称 | 必需 | 说明 |
|---------|------|------|
| `Authorization` | 是 | `Basic <base64(username:password)>` |
| `X-Notification-Channels` | 否 | 通知渠道列表，逗号分隔。默认: `webhook` |
| `Content-Type` | 是 | `application/json` |

### 请求体

标准 Grafana webhook 格式：

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
        "description": "服务器 server-01 的 CPU 使用率超过 90%"
      },
      "startsAt": "2025-01-05T10:00:00Z",
      "endsAt": "0001-01-01T00:00:00Z",
      "generatorURL": "http://grafana.example.com/graph?g0.expr=..."
    }
  ],
  "groupLabels": {
    "alertname": "HighCPUUsage"
  },
  "commonLabels": {
    "severity": "critical"
  },
  "externalURL": "http://grafana.example.com"
}
```

### 响应格式

成功响应：
```json
{
  "success": true,
  "data": {
    "message_ids": ["ntf_1736100000000_lark", "ntf_1736100000000_webhook"],
    "processed_alerts": 1,
    "notification_status": [
      {
        "channelType": "lark",
        "status": "sent",
        "messageId": "ntf_1736100000000_lark",
        "error": null
      },
      {
        "channelType": "webhook",
        "status": "sent",
        "messageId": "ntf_1736100000000_webhook",
        "error": null
      }
    ]
  }
}
```

部分失败响应：
```json
{
  "success": true,
  "data": {
    "message_ids": ["ntf_1736100000000_lark"],
    "processed_alerts": 1,
    "notification_status": [
      {
        "channelType": "lark",
        "status": "sent",
        "messageId": "ntf_1736100000000_lark",
        "error": null
      },
      {
        "channelType": "webhook",
        "status": "failed",
        "messageId": "ntf_1736100000000_webhook",
        "error": "Webhook request failed: 500"
      }
    ]
  }
}
```

## 模板系统

### 使用自定义模板

在 Grafana 告警标签中指定模板：

```yaml
labels:
  notification_template: grafana-alert-critical
```

### 默认模板

系统提供两个默认模板：

1. **grafana-alert** - 标准告警模板
   ```
   🚨 Grafana 告警: {{title}}
   状态: {{status}}
   告警数量: {{alertCount}}
   
   {{#each alerts}}
   告警 {{@index}}: {{this.alertname}}
   严重程度: {{this.severity}}
   摘要: {{this.summary}}
   {{/each}}
   ```

2. **grafana-alert-critical** - 严重告警模板
   ```
   🔴 严重告警: {{title}}
   状态: {{status}}
   
   {{#each alerts}}
   ⚠️ {{this.alertname}}
   级别: {{this.severity}}
   说明: {{this.description}}
   开始时间: {{this.startsAt}}
   {{/each}}
   ```

### 模板变量

当使用模板时，系统会提供以下变量：

**基础变量**（直接访问）：
- `status` - 告警状态 ("firing" 或 "resolved")
- `alertCount` - 告警数量
- `groupKey` - Grafana 分组键
- `externalURL` - Alert Manager URL

**第一个告警的信息**（方便单个告警场景）：
- `alertname` - 告警名称
- `severity` - 严重程度
- `summary` - 告警摘要
- `description` - 告警描述  
- `instance` - 实例名称
- `service` - 服务名称
- `runbook_url` - 操作手册链接

**告警数组** `alerts`：
```javascript
[
  {
    status: "firing",
    alertname: "HighCPUUsage",
    severity: "critical",
    summary: "CPU 使用率过高",
    description: "详细描述...",
    startsAt: "2025-01-05T10:00:00Z",
    endsAt: "0001-01-01T00:00:00Z",
    generatorURL: "http://grafana.example.com/...",
    fingerprint: "abc123",
    labels: { /* 所有标签 */ },
    annotations: { /* 所有注释 */ },
    values: { /* 度量值 */ }
  }
]
```

**其他元数据**：
- `commonLabels` - 公共标签
- `commonAnnotations` - 公共注释
- `groupLabels` - 分组标签

### 无模板时的默认格式

当未指定模板时，系统自动生成格式化通知：

**Lark/飞书格式：**
```
🚨 Grafana 告警

状态: 触发中
告警数量: 2

通用标签:
• alertname: HighCPUUsage
• severity: critical

告警详情:

1. HighCPUUsage
   状态: firing
   开始: 2025-01-05 10:00:00
   摘要: CPU 使用率过高
   描述: 服务器 server-01 的 CPU 使用率超过 90%
   实例: server-01
   查看详情
```

## 测试方法

### 1. 使用测试脚本

通知系统提供了完整的 Grafana 测试工具，支持多种测试场景：

```bash
# 基本测试 - 发送触发告警
npm run test:grafana send

# 发送已解决（恢复）告警
npm run test:grafana resolved

# 发送多个告警（混合状态）
npm run test:grafana multiple

# 查看 Grafana 配置示例
npm run test:grafana config

# 完整参数示例
npm run test:grafana send \
  --user ops-team \
  --channels lark,webhook \
  --template grafana-alert-critical \
  --url http://localhost:8788/api/webhooks/grafana \
  --username grafana \
  --password test-password
```

支持的参数：
- `--user <userId>` - 接收者 ID（默认：test-user）
- `--channels <channels>` - 通知渠道，逗号分隔（默认：webhook）
- `--template <template>` - 使用的模板 key
- `--url <url>` - Webhook URL（默认：http://localhost:8788/api/webhooks/grafana）
- `--username <username>` - Basic Auth 用户名（默认：grafana）
- `--password <password>` - Basic Auth 密码（默认：test-password）
- `--status <status>` - 告警状态 firing/resolved（仅 send 命令）

### 2. 使用 curl 测试

```bash
# 生成 Basic Auth 头
AUTH=$(echo -n "grafana:your-password" | base64)

# 发送测试告警
curl -X POST http://localhost:8788/api/webhooks/grafana \
  -H "Authorization: Basic $AUTH" \
  -H "X-Notification-Channels: lark,webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "receiver": "test-user",
    "status": "firing",
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "测试告警",
        "severity": "warning"
      },
      "annotations": {
        "summary": "这是一个测试告警"
      },
      "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }]
  }'
```

### 3. 查看响应格式

成功响应示例：
```json
{
  "success": true,
  "data": {
    "message_ids": ["ntf_1234567890_lark", "ntf_1234567890_webhook"],
    "processed_alerts": 1,
    "notification_status": [
      {
        "channelType": "lark",
        "status": "sent",
        "messageId": "ntf_1234567890_lark",
        "error": null
      },
      {
        "channelType": "webhook",
        "status": "sent",
        "messageId": "ntf_1234567890_webhook",
        "error": null
      }
    ]
  }
}
```

失败响应示例：
```json
{
  "success": false,
  "error": "User ops-team has no configured channels"
}
```

## 最佳实践

### 1. 用户 ID 命名规范

使用描述性的 receiver 名称：
- 团队：`ops-team`, `dev-team`, `security-team`
- 值班：`oncall-primary`, `oncall-secondary`
- 个人：`john.doe`, `jane.smith`

### 2. 渠道选择策略

根据告警级别选择合适的通知渠道：

| 严重程度 | 推荐渠道 | 说明 |
|---------|---------|------|
| Critical | `telegram,lark,slack` | 立即通知，多渠道确保送达 |
| Warning | `lark,webhook` | 工作时间通知 |
| Info | `webhook` | 仅记录，不打扰 |

### 3. 模板使用建议

- 标准告警使用默认模板
- 关键业务告警使用 `grafana-alert-critical`
- 特定场景创建自定义模板
- 模板中包含足够的上下文信息

### 4. 安全建议

- 使用强密码进行 Basic Authentication
- 生产环境考虑 IP 白名单
- 定期轮换认证凭据
- 监控异常请求

### 5. 性能优化

- 合理设置告警分组，避免告警风暴
- 使用批量发送减少 API 调用
- 设置合理的告警静默期

## 故障排查

### 认证失败

**症状：** 401 Unauthorized

**检查步骤：**
1. 验证用户名密码配置
   ```bash
   # 检查环境变量
   echo $GRAFANA_WEBHOOK_USERNAME
   echo $GRAFANA_WEBHOOK_PASSWORD
   ```

2. 确认 Basic Auth 格式正确
   ```bash
   # 正确的格式
   echo -n "username:password" | base64
   ```

3. 检查环境变量是否生效
   ```bash
   wrangler secret list --env production
   ```

### 用户未找到

**症状：** User ops-team has no configured channels

**解决方法：**
1. 确认 receiver 名称与配置的 user_id 匹配
2. 检查用户是否有激活的渠道配置
   ```bash
   # 查询用户配置
   curl "http://localhost:8788/api/user-configs?user_id=ops-team" \
     -H "X-Timestamp: $(date +%s)" \
     -H "X-Signature: $SIGNATURE"
   ```
3. 检查指定的渠道是否已配置
   - 如果 X-Notification-Channels 指定了 lark，确保用户已配置 lark 渠道
   - 用户只会通过已配置的渠道发送通知

### 通知未发送

**症状：** 请求成功但未收到通知

**检查步骤：**
1. 验证 X-Notification-Channels 包含有效渠道
2. 确认用户配置了指定的渠道
3. 查看通知日志
   ```bash
   # 查询最近的通知日志
   curl "http://localhost:8788/api/notification-logs?user_id=ops-team&limit=10" \
     -H "X-Timestamp: $(date +%s)" \
     -H "X-Signature: $SIGNATURE"
   ```

### 模板错误

**症状：** Template not found 或渲染错误

**解决方法：**
1. 确认模板已创建并激活
2. 检查 notification_template 标签值
3. 查看模板变量是否正确

### 性能问题

**症状：** 大量告警时响应缓慢

**优化方法：**
1. 在 Grafana 中配置告警分组
2. 设置合理的评估间隔
3. 使用告警静默避免重复通知

## 监控指标

建议监控以下指标：

1. **请求指标**
   - Grafana webhook 请求总数
   - 认证失败次数
   - 平均响应时间

2. **告警指标**
   - 接收的告警总数
   - 按严重级别分类的告警数
   - 告警处理成功率

3. **通知指标**
   - 各渠道发送成功率
   - 通知延迟
   - 失败重试次数

## 完整示例

### 场景 1：服务器监控告警

```yaml
# Grafana Alert Rule
groups:
  - name: server_monitoring
    rules:
      - alert: HighCPUUsage
        expr: cpu_usage_percent > 90
        for: 5m
        labels:
          severity: critical
          notification_template: grafana-alert-critical
          team: ops
        annotations:
          summary: "{{ $labels.instance }} CPU 使用率过高"
          description: "CPU 使用率已经达到 {{ $value }}%"
          runbook_url: "https://wiki.internal/runbooks/high-cpu"

# Contact Point
name: Ops Team Critical
type: webhook
settings:
  url: https://notification.workers.dev/api/webhooks/grafana
  username: grafana
  password: ${GRAFANA_WEBHOOK_PASSWORD}
  httpHeaderName1: X-Notification-Channels
  httpHeaderValue1: lark,telegram,webhook

# Notification Policy
receiver: ops-team
```

### 场景 2：数据库告警

```yaml
# 为数据库团队创建专门的模板
curl -X POST http://localhost:8788/api/templates \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d '{
    "template_key": "db-alert",
    "template_name": "数据库告警模板",
    "description": "数据库相关告警的专用模板",
    "variables": ["status", "alertname", "database", "query_time", "connection_count"]
  }'

# 为飞书添加卡片模板
curl -X POST http://localhost:8788/api/templates/db-alert/contents/lark \
  -H "X-Timestamp: $(date +%s)" \
  -H "X-Signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d '{
    "content_template": {
      "msg_type": "interactive",
      "card": {
        "header": {
          "title": {
            "content": "📉 数据库告警: {{alertname}}",
            "tag": "plain_text"
          },
          "template": "red"
        },
        "elements": [
          {
            "tag": "div",
            "text": {
              "content": "**数据库**: {{database}}\n**状态**: {{status}}\n**查询时间**: {{query_time}}ms\n**连接数**: {{connection_count}}",
              "tag": "lark_md"
            }
          },
          {
            "tag": "action",
            "actions": [
              {
                "tag": "button",
                "text": {
                  "content": "查看详情",
                  "tag": "plain_text"
                },
                "type": "primary",
                "url": "{{generatorURL}}"
              }
            ]
          }
        ]
      }
    }
  }'
```

## 支持的通知渠道

目前系统支持以下通知渠道：
- `webhook` - 通用 HTTP Webhook
- `telegram` - Telegram 机器人
- `lark` - 飞书/Lark 机器人
- `slack` - Slack 应用

即将支持：
- `email` - 电子邮件
- `sms` - 短信通知
- `discord` - Discord 机器人
- `wechat` - 企业微信

## 相关文档

- [API 完整参考](../../03-reference/api/complete-api-reference.md)
- [模板系统](../../03-reference/architecture/v2-template-system.md)
- [安全指南](../../04-security/security-guide.md)
- [故障排查](../../05-operations/troubleshooting.md)

---

**最后更新**: 2025-01-05
**版本**: 2.1 - 修正测试脚本文档，添加支持渠道列表
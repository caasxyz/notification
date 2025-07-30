# SDK API 路径更新记录

本文档记录了 SDK 中所有 API 路径的更新，以确保与实际项目保持一致。

## 更新日期：2025-01-30

### 已修复的路径映射

#### 核心 API
1. **发送通知**
   - 旧路径: `/api/send-notification` 和 `/api/notifications`
   - 新路径: `/api/notifications/send`
   - 文件: `client.ts`, `NotificationService.ts`

2. **重试通知**
   - 旧路径: `/api/trigger-retry` 和 `/api/notifications/{id}/retry`
   - 新路径: `/api/notifications/retry`
   - 文件: `client.ts`, `NotificationService.ts`
   - 注意: 重试 API 现在接受 `notification_id` 在请求体中，而不是 URL 参数

3. **健康检查**
   - 旧路径: `/api/health`
   - 新路径: `/health`
   - 文件: `client.ts`

#### 日志 API
4. **查询日志**
   - 旧路径: `/api/logs`
   - 新路径: `/api/notification-logs`
   - 文件: `client.ts`, `LogService.ts`

5. **清理日志**
   - 旧路径: `/api/cleanup-logs` 和 `/api/logs/cleanup`
   - 新路径: `/api/notification-logs/cleanup`
   - 文件: `client.ts`, `LogService.ts`
   - 注意: 方法从 POST 改为 DELETE

#### 用户配置 API
6. **用户配置管理**
   - 旧路径: `/api/users/{userId}/configs/{channel}`
   - 新路径: `/api/user-configs` (使用查询参数)
   - 文件: `client.ts`, `ConfigService.ts`
   - 注意: 所有操作现在使用查询参数而不是路径参数

#### 模板 API
7. **模板更新**
   - 旧方法: PUT
   - 新方法: POST
   - 路径保持不变: `/api/templates/{key}`
   - 文件: `TemplateService.ts`

### 认证方式更新

- **旧方式**: Bearer Token (`Authorization: Bearer {token}`)
- **新方式**: HMAC-SHA256 签名
  - Headers: `X-Timestamp` 和 `X-Signature`
  - 签名格式: `timestamp + payload`
  - GET/DELETE: payload = path + query
  - POST/PUT: payload = request body

### 未实现的端点

以下端点在实际 API 中不存在，SDK 方法已修改为抛出错误：

#### Client.ts
- 用户 CRUD 操作 (`/api/users/*`)
- 配置激活/停用 (`/api/users/{userId}/configs/{channel}/activate|deactivate`)
- 模板渲染 (`/api/templates/{key}/render`)
- 获取单个日志 (`/api/notification-logs/{id}`)
- 按请求 ID 获取日志 (`/api/notification-logs/request/{id}`)
- 重试统计 (`/api/users/{userId}/retry-stats`)

#### NotificationService.ts
- 获取通知状态 (`/api/notifications/{id}/status`)
- 取消通知 (`/api/notifications/{id}/cancel`)
- 预览通知 (`/api/notifications/preview`)
- 验证通知 (`/api/notifications/validate`)

#### TemplateService.ts
- 激活/停用模板 (`/api/templates/{key}/activate|deactivate`)
- 预览模板 (`/api/templates/{key}/preview`)
- 验证模板 (`/api/templates/validate`)
- 克隆模板 (`/api/templates/{key}/clone`)
- 模板统计 (`/api/templates/{key}/stats`)
- 批量操作 (`/api/templates/bulk`)

#### ConfigService.ts
- 激活/停用配置 (`/api/users/{userId}/configs/{channel}/activate|deactivate`)

#### UserService.ts
- 所有用户 CRUD 操作

### 实际存在的 API 端点总结

基于 router.ts，以下是所有实际可用的端点：

1. **通知**
   - `POST /api/notifications/send` - 发送通知
   - `POST /api/notifications/retry` - 重试通知

2. **用户配置**
   - `GET /api/user-configs` - 获取配置（带查询参数）
   - `POST /api/user-configs` - 创建/更新配置
   - `DELETE /api/user-configs` - 删除配置（带查询参数）

3. **模板**
   - `GET /api/templates` - 获取模板列表
   - `POST /api/templates` - 创建/更新模板
   - `DELETE /api/templates` - 删除模板

4. **日志**
   - `GET /api/notification-logs` - 查询日志
   - `DELETE /api/notification-logs/cleanup` - 清理日志

5. **数据库**
   - `GET /api/db/schema` - 检查架构
   - `POST /api/db/migrate` - 运行迁移

6. **Webhook**
   - `POST /api/webhooks/grafana` - Grafana webhook（使用 Basic Auth）

7. **系统**
   - `GET /health` - 健康检查
   - `GET /metrics` - 指标
   - `GET /health/scheduled-tasks` - 定时任务健康检查

8. **测试** (仅开发环境)
   - `GET /test-ui` - 测试界面

### 建议

1. **服务器端实现**: 考虑实现 SDK 中标记为"未实现"的有用端点
2. **SDK 简化**: 移除或明确标记未实现的方法
3. **文档更新**: 更新 SDK 文档以反映实际可用的 API
4. **版本控制**: 考虑为 SDK 添加版本号以跟踪这些更改
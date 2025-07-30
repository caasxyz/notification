# SDK 集成测试指南

## 概述

SDK 集成测试使用实际的 SDK 客户端来测试通知系统的所有功能，确保 SDK 与 API 的兼容性和功能完整性。

## 测试覆盖范围

SDK 集成测试覆盖以下功能：

1. **基础功能**
   - 健康检查
   - 认证（HMAC 签名）

2. **用户配置管理**
   - 创建渠道配置
   - 获取配置列表
   - 删除配置

3. **模板管理**
   - 创建模板
   - 列出所有模板
   - 渲染模板
   - 删除模板

4. **通知发送**
   - 简单文本通知
   - 使用模板发送
   - 批量发送
   - 幂等性保证

5. **日志查询**
   - 按用户查询
   - 按状态过滤
   - 分页支持

6. **错误处理**
   - 无效用户
   - 不存在的模板
   - 网络错误重试

## 本地运行

### 前置条件

1. 安装依赖：
```bash
npm install
cd sdk && npm install && npm run build && cd ..
```

2. 设置环境变量：
```bash
export API_BASE_URL=https://notification.caas.xyz
export API_SECRET_KEY=your-api-secret-key
export TEST_USER_ID=test-user-123
export LARK_WEBHOOK=https://open.larksuite.com/open-apis/bot/v2/hook/your-webhook
export LARK_SECRET=your-lark-secret
```

### 运行测试

```bash
# 构建 SDK 并运行测试
npm run test:integration-sdk

# 或者分步运行
cd sdk && npm run build && cd ..
npx tsx scripts/testing/integration-test-sdk.ts
```

### 测试输出

测试会生成以下输出：

1. **控制台日志**：实时显示每个测试的执行状态
2. **测试报告**：保存为 `sdk-test-report-{timestamp}.json`

示例输出：
```
🚀 开始 SDK 集成测试
基础 URL: https://notification.caas.xyz
测试用户: test-user-123
API 密钥: 已设置
Lark Webhook: 已配置

================================================================================

📋 第一步: 测试基础功能

测试: 健康检查
✅ 成功 - 142ms
响应: {
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-30T12:34:56.789Z"
  }
}

...

📊 测试报告

总测试数: 20
✅ 成功: 18
❌ 失败: 2
总耗时: 5432ms
平均耗时: 271ms
```

## GitHub Actions 集成

### 自动触发

SDK 集成测试会在以下情况自动运行：

1. **推送到 main 分支**：当 SDK 或 API 代码变更时
2. **Pull Request**：验证更改不会破坏 SDK 功能
3. **生产部署后**：作为部署验证的一部分

### 工作流文件

- `.github/workflows/sdk-integration-test.yml`：独立的 SDK 测试
- `.github/workflows/deploy.yml`：部署流程中包含 SDK 测试

### 配置 Secrets

在 GitHub 仓库设置中配置以下 Secrets：

- `TEST_API_SECRET_KEY`：测试环境的 API 密钥
- `TEST_LARK_WEBHOOK`：Lark webhook URL
- `TEST_LARK_SECRET`：Lark webhook 密钥
- `PROD_API_SECRET`：生产环境 API 密钥（用于部署后测试）

## 测试策略

### 1. 隔离测试

- 使用唯一的测试用户 ID
- 测试结束后清理所有创建的数据
- 使用时间戳避免冲突

### 2. 幂等性测试

```typescript
const idempotencyKey = `sdk-test-${Date.now()}`;
await client.sendNotification({
  user_id: testUserId,
  channels: ['lark'],
  content: 'Test message',
  idempotency_key: idempotencyKey,
});
```

### 3. 错误场景

测试包含预期失败的场景：
- 未实现的功能（用户管理 API）
- 无效参数
- 不存在的资源

### 4. 并发测试

批量发送测试验证 SDK 的并发处理能力：
```typescript
await client.sendBatchNotifications([
  { user_id, channels: ['lark'], content: 'Message 1' },
  { user_id, channels: ['lark'], content: 'Message 2' },
  { user_id, channels: ['lark'], content: 'Message 3' },
]);
```

## 故障排查

### 常见问题

1. **认证失败**
   - 检查 API_SECRET_KEY 是否正确
   - 确认时间同步（5分钟容差）

2. **连接错误**
   - 验证 API_BASE_URL 是否可访问
   - 检查网络连接

3. **Lark 通知失败**
   - 确认 webhook URL 有效
   - 检查 secret 是否匹配

### 调试模式

启用详细日志：
```typescript
const client = new NotificationClient({
  baseUrl: config.baseUrl,
  apiKey: config.apiSecret,
  debug: true, // 启用调试日志
});
```

## 扩展测试

### 添加新测试

在 `integration-test-sdk.ts` 中添加：

```typescript
await testFeature('新功能测试', async () => {
  // 测试逻辑
  const result = await client.newFeature();
  
  // 验证结果
  if (!result.success) {
    throw new Error('Feature failed');
  }
  
  return result;
});
```

### 性能测试

可以扩展测试来包含性能指标：
- 响应时间
- 并发能力
- 重试机制效率

## 最佳实践

1. **保持测试独立**：每个测试不应依赖其他测试的结果
2. **清理资源**：测试结束后删除创建的数据
3. **使用真实场景**：测试应模拟实际使用情况
4. **记录详细日志**：便于问题定位
5. **定期更新**：随着 API 更新同步更新测试

## 相关文档

- [SDK 使用指南](../02-guides/sdk-usage.md)
- [API 参考](../03-reference/api/complete-api-reference.md)
- [GitHub Packages 设置](./github-packages-setup.md)
# 测试脚本说明

本目录包含各种测试脚本，用于测试通知系统的不同功能。

## 生产环境 SDK 测试

### production-sdk-test.ts

专门用于在生产环境中测试 SDK 的各项功能，确保 SDK 在真实环境中正常工作。

#### 使用方法

```bash
# 基础快速测试（推荐）
API_SECRET_KEY=your-secret-key npm run test:production-quick

# 完整测试所有功能
API_SECRET_KEY=your-secret-key npm run test:production-full

# 自定义参数
API_SECRET_KEY=your-secret-key npx tsx scripts/testing/production-sdk-test.ts \
  --user-id custom-test-user \
  --api-url https://api.example.com \
  --cleanup
```

#### 命令行参数

- `--quick` - 只测试核心功能（默认）
- `--full` - 完整测试所有功能，包括高级特性和性能测试
- `--cleanup` - 测试后清理数据（删除创建的配置和模板）
- `--user-id <id>` - 自定义测试用户 ID（默认: sdk-prod-test-user）
- `--api-url <url>` - 自定义 API URL（默认: https://notification.caas.xyz）

#### 环境变量

必需：
- `API_SECRET_KEY` - API 密钥

可选：
- `API_BASE_URL` - API 基础 URL（会被命令行参数覆盖）
- `LARK_WEBHOOK` - Lark webhook URL（用于 Lark 通知测试）
- `LARK_SECRET` - Lark webhook 密钥
- `TEST_EMAIL` - 测试邮箱地址（默认: test@example.com）
- `VERBOSE` - 显示详细的测试结果

#### 测试内容

1. **基础功能测试**
   - 健康检查
   - SDK 版本兼容性

2. **配置管理测试**
   - 创建 Lark 配置
   - 创建 Email 配置
   - 查询用户配置

3. **智能发送测试**
   - 自动检测渠道
   - 带主题的智能发送

4. **链式 API 测试**
   - 基础链式调用
   - 指定渠道的链式调用

5. **快速发送测试**
   - 快速 Lark 发送
   - 快速 Email 发送

6. **模板功能测试**
   - 创建测试模板
   - 使用模板发送
   - 删除测试模板（如果启用 cleanup）

7. **高级功能测试**（仅 --full 模式）
   - 批量发送
   - 会话模式
   - 预设模板

8. **错误处理测试**
   - 无效用户 ID
   - 无效渠道

9. **性能测试**（仅 --full 模式）
   - 响应时间测试

10. **数据清理**（仅 --cleanup）
    - 删除用户配置
    - 清理测试日志

#### 输出示例

```
🚀 生产环境 SDK 测试

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 API URL: https://notification.caas.xyz
👤 测试用户: sdk-prod-test-user
🔑 API 密钥: 已设置
📱 Lark Webhook: 已配置
✉️  测试邮箱: test@example.com
🧪 测试模式: 快速测试
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 基础功能测试

  ✓ 健康检查 (125ms)
  ✓ SDK 版本兼容性 (2ms)

🔧 配置管理测试

  ✓ 创建 Lark 配置 (156ms)
  ✓ 创建 Email 配置 (143ms)
  ✓ 查询用户配置 (134ms)

[... 更多测试结果 ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 测试报告

测试类别统计:
  basic        2/2 (100%)
  config       3/3 (100%)
  smart        2/2 (100%)
  chain        2/2 (100%)
  quick        2/2 (100%)
  template     2/2 (100%)
  error        2/2 (100%)

总体统计:
  总测试数: 15
  ✅ 成功: 15
  ❌ 失败: 0
  ⏱️  总耗时: 1523ms
  📈 成功率: 100.0%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 所有测试通过！SDK 在生产环境运行正常。
```

## 其他测试脚本

### integration-test.ts
原始的集成测试脚本，直接调用 API 接口。

### integration-test-sdk-v2.ts
使用增强版 SDK 的集成测试，保持与原始测试相同的输出格式。

### integration-test-sdk-enhanced.ts
展示增强版 SDK 所有新功能的测试脚本。

### test-grafana-webhook.ts
测试 Grafana webhook 集成功能。

### performance-test.ts
性能测试脚本，测试系统的并发处理能力。

### test-local.ts
本地开发测试脚本。

## 最佳实践

1. **在部署后运行快速测试**
   ```bash
   # 部署后验证
   npm run test:production-quick
   ```

2. **定期运行完整测试**
   ```bash
   # 每周运行一次完整测试
   npm run test:production-full
   ```

3. **CI/CD 集成**
   ```yaml
   # GitHub Actions 示例
   - name: Run production tests
     env:
       API_SECRET_KEY: ${{ secrets.PROD_API_SECRET }}
     run: npm run test:production-quick
   ```

4. **监控集成**
   - 可以将测试脚本集成到监控系统
   - 定期运行并报告结果
   - 设置告警阈值
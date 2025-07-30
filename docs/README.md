# 📚 通知系统文档中心

欢迎使用通知系统文档！本系统是基于 Cloudflare Workers 的高性能多渠道通知平台，支持 Webhook、Telegram、飞书等多种通知渠道。

## 🚀 快速开始

如果您是第一次使用本系统，请按照以下顺序阅读：

1. **[快速开始指南](getting-started/quickstart.md)** - 5分钟内部署系统
2. **[部署指南](guides/deployment.md)** - 详细的生产环境部署
3. **[API 参考](reference/api/complete-api-reference.md)** - 完整的 API 文档

## 📖 文档结构

### 入门指南 (getting-started/)
适合初次使用者，包含系统安装、配置和快速上手的内容。

- **[快速开始](getting-started/quickstart.md)** - 5分钟快速部署到 Cloudflare Workers

### 使用指南 (guides/)
深入的功能使用和最佳实践指南。

#### 核心指南
- **[部署指南](guides/deployment.md)** - 完整的部署文档（Cloudflare、GitHub Actions、蓝绿部署）
- **[开发指南](guides/development.md)** - 本地开发环境设置、调试技巧、最佳实践
- **[Grafana 集成](guides/integration/grafana.md)** - Grafana 告警接收和配置

#### 开发参考
- **[TypeScript 规范](guides/development/typescript-guidelines.md)** - 严格模式下的开发规范
- **[错误预防](guides/development/error-prevention.md)** - 常见错误和解决方案

### 参考文档 (reference/)
详细的技术参考和 API 文档。

#### API 文档
- **[完整 API 参考](reference/api/complete-api-reference.md)** - 所有 API 端点、认证、示例（必读）

#### 架构文档
- **[系统设计](reference/architecture/system-design.md)** - 整体架构设计和技术决策
- **[V2 模板系统](reference/architecture/v2-template-system.md)** - 多渠道模板系统详解
- **[性能调优](reference/architecture/performance-tuning.md)** - 性能优化最佣实践

### 安全文档 (security/)
安全相关的指南和最佳实践。

- **[安全指南](security/security-guide.md)** - 完整的安全实施指南

## 📚 综合文档

以下是经过整合优化的核心文档：

- **[数据库管理](database.md)** - D1 数据库、Drizzle ORM、迁移和优化（整合版）
- **[监控运维](monitoring.md)** - 监控、告警、维护任务完整指南（整合版）
- **[测试指南](testing.md)** - 单元测试、集成测试、性能测试（增强版）
- **[故障排查](troubleshooting.md)** - 诊断工具、常见问题、紧急响应（增强版）

## 🔍 快速查找

### 按角色查找

**开发者**
- [开发指南](guides/development.md)
- [数据库管理](database.md)
- [测试指南](testing.md)
- [完整 API 参考](reference/api/complete-api-reference.md)
- [TypeScript 规范](guides/development/typescript-guidelines.md)

**运维人员**
- [部署指南](guides/deployment.md)
- [监控运维](monitoring.md)
- [故障排查](troubleshooting.md)
- [性能调优](reference/architecture/performance-tuning.md)

**集成工程师**
- [Grafana 集成](guides/integration/grafana.md)
- [完整 API 参考](reference/api/complete-api-reference.md)
- [系统设计](reference/architecture/system-design.md)

### 按任务查找

**首次部署**
1. [快速开始](getting-started/quickstart.md)
2. [部署指南](guides/deployment.md) - 包含 GitHub Actions 配置
3. [数据库初始化](database.md#初始化设置)

**添加新功能**
1. [系统架构](reference/architecture/system-design.md)
2. [开发指南](guides/development.md)
3. [V2 模板系统](reference/architecture/v2-template-system.md)
4. [测试指南](testing.md)

**处理问题**
1. [故障排查](troubleshooting.md) - 包含诊断工具和常见问题
2. [错误预防](guides/development/error-prevention.md)
3. [监控告警](monitoring.md#告警配置)

**性能优化**
1. [性能调优指南](reference/architecture/performance-tuning.md)
2. [数据库优化](database.md#性能优化)
3. [监控指标](monitoring.md#性能监控)

## 📝 重要说明

### 关于签名验证
系统使用 **毫秒级时间戳** 进行 HMAC-SHA256 签名验证：
```javascript
const timestamp = Date.now().toString(); // 毫秒，不是秒！
const payload = timestamp + JSON.stringify(body);
const signature = crypto.createHmac('sha256', API_SECRET_KEY)
  .update(payload)
  .digest('hex');
```

### 关于测试脚本
测试脚本使用子命令而非标志：
```bash
npm run test:grafana send    # 正确
npm run test:grafana --send  # 错误
```

## 🛠️ 技术栈

- **运行时**: Cloudflare Workers (Edge Computing)
- **数据库**: Cloudflare D1 (SQLite)
- **缓存**: Cloudflare KV
- **队列**: Cloudflare Queues
- **ORM**: Drizzle ORM
- **语言**: TypeScript (严格模式)

## 📝 文档维护

- 所有文档使用**中文**编写
- 每个文档经过至少 3 次迭代确保质量
- 代码示例与实际实现保持一致
- 定期更新以反映最新的系统状态

## 🤝 获取帮助

如果您在文档中找不到所需信息：

1. 查看 [故障排查指南](troubleshooting.md)
2. 搜索 GitHub Issues
3. 提交新的 Issue 或 Discussion
4. 参考 [SDK 示例代码](../sdk/)

## 🔄 最近更新

- 2025-01-06: 文档重构完成，整合重复内容
- 2025-01-06: 更新所有文档为中文
- 2025-01-06: 修复时间戳精度文档错误

---

**最后更新**: 2025-01-06
**版本**: 2.0
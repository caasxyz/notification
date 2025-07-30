# 测试完整指南

本文档提供通知系统的完整测试策略、工具使用和最佳实践，涵盖单元测试、集成测试、性能测试和端到端测试。

## 目录

- [概述](#概述)
- [测试架构](#测试架构)
- [开发环境配置](#开发环境配置)
- [单元测试](#单元测试)
- [集成测试](#集成测试)
- [端到端测试](#端到端测试)
- [性能测试](#性能测试)
- [测试工具](#测试工具)
- [持续集成](#持续集成)
- [测试最佳实践](#测试最佳实践)
- [故障排查](#故障排查)

## 概述

通知系统采用全面的测试策略，确保代码质量和系统可靠性：

- **测试覆盖率目标**: 80%+
- **测试类型**: 单元测试、集成测试、端到端测试、性能测试
- **自动化程度**: 95%+ 测试自动化
- **持续集成**: 每次提交自动运行测试

### 核心原则

1. **测试驱动开发 (TDD)**: 先写测试，再写实现
2. **快速反馈**: 单元测试 < 10s，集成测试 < 60s
3. **隔离性**: 测试相互独立，无副作用
4. **可重复性**: 测试结果一致可靠
5. **可维护性**: 测试代码清晰易懂

## 测试架构

### 技术栈

| 工具 | 用途 | 说明 |
|------|------|------|
| Vitest | 单元测试框架 | 快速、支持 TypeScript |
| tsx | TypeScript 执行器 | 运行测试脚本 |
| Docker | 测试环境 | 隔离的测试数据库 |
| k6 | 负载测试 | 性能和压力测试 |
| Playwright | E2E 测试 | 测试 Web UI |

### 目录结构

```
notification/
├── src/
│   ├── **/*.ts          # 源代码
│   └── **/*.test.ts     # 单元测试（同目录）
├── test/                # 测试资源
│   ├── fixtures/        # 测试数据
│   ├── helpers/         # 测试辅助函数
│   └── setup/           # 测试配置
├── scripts/testing/     # 测试脚本
│   ├── integration-test.ts
│   ├── performance-test.ts
│   ├── e2e-test.ts
│   └── test-local.ts
└── .github/workflows/   # CI 配置
    └── test.yml
```

## 开发环境配置

### 环境准备

```bash
# 1. 安装依赖
npm install

# 2. 设置环境变量
cp .env.example .env.test
# 编辑 .env.test 设置测试专用的值

# 3. 初始化测试数据库
npm run db:setup -- --test
# 或使用智能设置脚本
./scripts/database/smart-db-setup.sh --test

# 4. 验证环境
npm run test -- --run src/utils/validation.test.ts
```

### 环境变量配置

```env
# .env.test
NODE_ENV=test
DATABASE_URL=file:./test.db
API_SECRET_KEY=test-secret-key-for-testing
ENCRYPT_KEY=test-encrypt-key-32-characters-x
LOG_LEVEL=debug
TEST_USER_ID=test-user-001
TEST_WEBHOOK_URL=https://httpbin.org/post
TEST_LARK_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/test
TEST_TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TEST_TELEGRAM_CHAT_ID=-1001234567890
```

### VS Code 配置

```json
{
  "vitest.enable": true,
  "vitest.commandLine": "npm run test --",
  "testing.automaticallyOpenPeekView": "failureInVisibleDocument",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## 单元测试

### 运行测试

```bash
# 运行所有单元测试
npm test

# 运行特定文件
npm test src/services/TemplateEngineV2.test.ts

# 运行匹配模式的测试
npm test -- --grep "notification"

# 监听模式
npm run test:watch

# 只运行特定测试套件
npm test -- --reporter=verbose --run

# 测试覆盖率
vitest run --coverage

# 生成覆盖率报告
vitest run --coverage --reporter=html
```

### 编写单元测试

#### 1. 基础测试结构

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('TemplateEngineV2', () => {
  let engine: TemplateEngineV2;
  let mockDb: any;
  
  beforeEach(() => {
    // 设置测试环境
    mockDb = createMockDb();
    engine = new TemplateEngineV2(mockDb);
  });
  
  afterEach(() => {
    // 清理
    vi.clearAllMocks();
  });
  
  describe('render', () => {
    it('应该正确渲染模板变量', () => {
      const template = 'Hello {{name}}, welcome to {{service}}!';
      const variables = { name: '张三', service: '通知系统' };
      
      const result = engine.render(template, variables);
      
      expect(result).toBe('Hello 张三, welcome to 通知系统!');
    });
    
    it('应该处理嵌套对象变量', () => {
      const template = '订单 {{order.id}} 金额: {{order.amount}}';
      const variables = {
        order: { id: 'ORD123', amount: '99.99' }
      };
      
      const result = engine.render(template, variables);
      
      expect(result).toBe('订单 ORD123 金额: 99.99');
    });
  });
});
```

#### 2. 测试异步代码

```typescript
import { NotificationDispatcherV2 } from '../services/NotificationDispatcherV2';
import { getDb } from '../db';

describe('NotificationDispatcherV2', () => {
  let mockEnv: Env;
  
  beforeEach(() => {
    mockEnv = {
      DB: createMockD1Database(),
      CONFIG_CACHE: createMockKV(),
      NOTIFICATION_QUEUE: createMockQueue(),
      API_SECRET_KEY: 'test-key',
      ENCRYPT_KEY: 'test-encrypt-key-32-characters-xx'
    };
  });
  
  it('应该成功发送通知', async () => {
    // 准备测试数据
    const request = {
      user_id: 'test-user',
      channels: ['webhook'] as NotificationChannel[],
      custom_content: {
        subject: '测试通知',
        content: '测试内容'
      }
    };
    
    // 模拟用户配置
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: 1,
            user_id: 'test-user',
            channel_type: 'webhook',
            config_data: JSON.stringify({
              webhook_url: 'https://example.com/webhook'
            }),
            is_active: true
          }])
        })
      })
    } as any);
    
    const result = await NotificationDispatcherV2.sendNotification(request, mockEnv);
    
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('sent');
    expect(result[0].messageId).toMatch(/^ntf_\d+_webhook$/);
  });
  
  it('应该处理发送失败', async () => {
    const notification = createTestNotification();
    mockAdapter.send.mockRejectedValue(new Error('Network error'));
    
    await expect(dispatcher.send(notification))
      .rejects.toThrow('Failed to send notification');
  });
  
  it('应该在超时后重试', async () => {
    const notification = createTestNotification();
    const sendSpy = vi.fn()
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({ success: true });
    
    const result = await dispatcher.sendWithRetry(notification);
    
    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });
});
```

#### 3. 模拟依赖

```typescript
// 模拟数据库
vi.mock('../db', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([{ id: 1 }])
  }))
}));

// 模拟外部服务
vi.mock('../adapters/LarkAdapter', () => ({
  LarkAdapter: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ success: true, messageId: 'msg123' })
  }))
}));

// 模拟时间
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-06 10:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});
```

#### 4. 测试错误场景

```typescript
describe('错误处理', () => {
  it('应该验证必需参数', () => {
    expect(() => new NotificationService(null))
      .toThrow('Database connection is required');
  });
  
  it('应该处理无效的模板语法', () => {
    const template = 'Hello {{name';
    
    expect(() => engine.render(template, {}))
      .toThrow('Invalid template syntax');
  });
  
  it('应该限制变量替换深度', () => {
    const template = '{{a}}';
    const variables = { a: '{{b}}', b: '{{a}}' };
    
    expect(() => engine.render(template, variables))
      .toThrow('Maximum template depth exceeded');
  });
});
```

### 测试覆盖率

```bash
# 生成覆盖率报告
npm run test:coverage

# 查看 HTML 报告
open coverage/index.html

# 设置覆盖率阈值
# vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
});
```

## 集成测试

### 运行集成测试

```bash
# 本地环境
npm run test:integration

# 指定环境
ENV=staging npm run test:integration

# 带详细日志
DEBUG=* npm run test:integration

# 只运行特定测试套件
npm run test:integration -- --suite notification
```

### 集成测试实现

```typescript
// scripts/testing/integration-test-core.ts
import { generateSignature } from '../utils/crypto';

export class IntegrationTestSuite {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}
  
  async runAllTests() {
    console.log('🧪 开始集成测试...');
    
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
    
    // 测试套件
    const suites = [
      this.testHealthCheck.bind(this),
      this.testUserConfig.bind(this),
      this.testTemplateManagement.bind(this),
      this.testNotificationSend.bind(this),
      this.testNotificationLogs.bind(this),
      this.testErrorHandling.bind(this)
    ];
    
    for (const suite of suites) {
      try {
        await suite();
        results.passed++;
      } catch (error) {
        results.failed++;
        results.errors.push(error);
      }
      results.total++;
    }
    
    // 输出结果
    console.log('\n📊 测试结果:');
    console.log(`总计: ${results.total}`);
    console.log(`通过: ${results.passed} ✅`);
    console.log(`失败: ${results.failed} ❌`);
    
    if (results.failed > 0) {
      console.error('\n错误详情:');
      results.errors.forEach(err => console.error(err));
      process.exit(1);
    }
  }
  
  async testNotificationSend() {
    console.log('\n📨 测试通知发送...');
    
    // 1. 使用自定义内容发送
    const customResponse = await this.sendRequest('/api/send-notification', 'POST', {
      user_id: 'test-user',
      channels: ['webhook'],
      custom_content: {
        subject: '集成测试通知',
        content: `测试时间: ${new Date().toISOString()}`
      },
      idempotency_key: `test-${Date.now()}`
    });
    
    this.assertResponse(customResponse, {
      status: 200,
      body: {
        success: true,
        results: [{
          status: 'sent',
          channelType: 'webhook'
        }]
      }
    });
    
    // 2. 使用模板发送
    const templateResponse = await this.sendRequest('/api/send-notification', 'POST', {
      user_id: 'test-user',
      channels: ['webhook'],
      template_key: 'test-template',
      variables: {
        name: '集成测试',
        action: '验证功能'
      }
    });
    
    this.assertResponse(templateResponse, {
      status: 200,
      body: { success: true }
    });
    
    console.log('✅ 通知发送测试通过');
  }
  
  private async sendRequest(path: string, method: string, body?: any) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = body ? timestamp + JSON.stringify(body) : timestamp + path;
    const signature = generateSignature(payload, this.apiKey);
    
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Signature': signature
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    const responseBody = await response.json();
    return { status: response.status, body: responseBody };
  }
  
  private assertResponse(actual: any, expected: any) {
    if (actual.status !== expected.status) {
      throw new Error(`状态码不匹配: ${actual.status} !== ${expected.status}`);
    }
    
    if (expected.body) {
      this.deepAssert(actual.body, expected.body);
    }
  }
}
```

### 测试数据管理

```typescript
// test/helpers/test-data.ts
export class TestDataManager {
  private createdResources: Array<{ type: string; id: string }> = [];
  
  async createUser(data: Partial<User> = {}): Promise<string> {
    const userId = `test-user-${Date.now()}`;
    const user = {
      id: userId,
      name: 'Test User',
      email: 'test@example.com',
      ...data
    };
    
    await db.insert(users).values(user);
    this.trackResource('user', userId);
    
    return userId;
  }
  
  async createTemplate(data: Partial<Template> = {}): Promise<string> {
    const templateKey = `test-template-${Date.now()}`;
    const template = {
      template_key: templateKey,
      template_name: 'Test Template',
      variables: ['name', 'action'],
      ...data
    };
    
    await db.insert(templates).values(template);
    this.trackResource('template', templateKey);
    
    return templateKey;
  }
  
  async cleanup(): Promise<void> {
    // 按相反顺序清理资源
    for (const resource of this.createdResources.reverse()) {
      await this.deleteResource(resource.type, resource.id);
    }
    this.createdResources = [];
  }
  
  private trackResource(type: string, id: string): void {
    this.createdResources.push({ type, id });
  }
  
  private async deleteResource(type: string, id: string): Promise<void> {
    switch (type) {
      case 'user':
        await db.delete(users).where(eq(users.id, id));
        break;
      case 'template':
        await db.delete(templates).where(eq(templates.template_key, id));
        break;
    }
  }
}
```

## 端到端测试

### 配置 Playwright

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  retries: 2,
  workers: 4,
  use: {
    baseURL: 'http://localhost:8788',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    }
  ]
});
```

### E2E 测试示例

```typescript
// test/e2e/notification-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('通知发送流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-ui');
  });
  
  test('应该通过 UI 发送测试通知', async ({ page }) => {
    // 1. 选择 API
    await page.selectOption('#api-select', 'send-notification');
    
    // 2. 填写表单
    await page.fill('#user-id', 'test-user');
    await page.click('#channel-lark');
    await page.fill('#template-key', 'welcome');
    await page.fill('#variables', JSON.stringify({
      name: 'E2E Test User'
    }));
    
    // 3. 发送请求
    await page.click('#send-button');
    
    // 4. 验证响应
    await expect(page.locator('#response-status')).toContainText('200');
    await expect(page.locator('#response-body')).toContainText('success');
    
    // 5. 检查通知历史
    await page.click('#history-tab');
    await expect(page.locator('.history-item').first()).toContainText('sent');
  });
  
  test('应该显示错误信息', async ({ page }) => {
    await page.selectOption('#api-select', 'send-notification');
    await page.fill('#user-id', '');
    await page.click('#send-button');
    
    await expect(page.locator('.error-message'))
      .toContainText('User ID is required');
  });
});
```

### 视觉回归测试

```typescript
test('UI 组件视觉测试', async ({ page }) => {
  await page.goto('/test-ui');
  
  // 全页面截图
  await expect(page).toHaveScreenshot('test-ui-full.png');
  
  // 组件截图
  await expect(page.locator('#api-form'))
    .toHaveScreenshot('api-form.png');
  
  // 响应式测试
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page).toHaveScreenshot('test-ui-mobile.png');
});
```

## 性能测试

### 使用 k6 进行负载测试

```bash
# 安装 k6
brew install k6  # macOS
# 或
curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz

# 运行负载测试
k6 run test/performance/load-test.js

# 使用云服务（可视化结果）
k6 cloud test/performance/load-test.js
```

```javascript
// test/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // 预热到 100 用户
    { duration: '5m', target: 100 },  // 保持 100 用户
    { duration: '2m', target: 200 },  // 增加到 200 用户
    { duration: '5m', target: 200 },  // 保持 200 用户
    { duration: '2m', target: 0 },    // 降到 0 用户
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% 请求小于 500ms
    errors: ['rate<0.1'],             // 错误率小于 10%
  },
};

export default function () {
  const payload = JSON.stringify({
    user_id: `user-${__VU}`,
    channels: ['webhook'],
    template_key: 'test',
    variables: {
      timestamp: Date.now()
    }
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': Math.floor(Date.now() / 1000).toString(),
      'X-Signature': generateSignature(payload)
    },
  };
  
  const res = http.post(
    'https://notification-api.example.com/api/send-notification',
    payload,
    params
  );
  
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has message_id': (r) => JSON.parse(r.body).message_id !== undefined,
  });
  
  errorRate.add(!success);
  sleep(1);
}
```

### 性能基准测试

```typescript
// scripts/testing/performance-benchmark.ts
import { performance } from 'perf_hooks';

class PerformanceBenchmark {
  async runBenchmark() {
    const results = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      benchmarks: []
    };
    
    // 1. API 响应时间测试
    results.benchmarks.push(
      await this.benchmarkAPI('健康检查', '/api/health', 'GET', null, 50)
    );
    
    results.benchmarks.push(
      await this.benchmarkAPI('发送通知', '/api/send-notification', 'POST', {
        user_id: 'test-user',
        channels: ['webhook'],
        content: 'Benchmark test'
      }, 200)
    );
    
    // 2. 数据库查询性能
    results.benchmarks.push(
      await this.benchmarkQuery('用户查询', async () => {
        await db.select().from(users).where(eq(users.id, 'test-user'));
      }, 10)
    );
    
    // 3. 模板渲染性能
    results.benchmarks.push(
      await this.benchmarkFunction('模板渲染', () => {
        engine.render('Hello {{name}}, {{action}} at {{time}}', {
          name: 'User',
          action: 'logged in',
          time: new Date().toISOString()
        });
      }, 100)
    );
    
    // 生成报告
    this.generateReport(results);
  }
  
  private async benchmarkAPI(
    name: string,
    endpoint: string,
    method: string,
    body: any,
    targetMs: number
  ) {
    const iterations = 100;
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers: this.getHeaders(body),
        body: body ? JSON.stringify(body) : undefined
      });
      const duration = performance.now() - start;
      times.push(duration);
    }
    
    return this.calculateStats(name, times, targetMs);
  }
  
  private calculateStats(name: string, times: number[], targetMs: number) {
    times.sort((a, b) => a - b);
    
    return {
      name,
      iterations: times.length,
      min: times[0],
      max: times[times.length - 1],
      mean: times.reduce((a, b) => a + b) / times.length,
      p50: times[Math.floor(times.length * 0.5)],
      p95: times[Math.floor(times.length * 0.95)],
      p99: times[Math.floor(times.length * 0.99)],
      target: targetMs,
      passed: times[Math.floor(times.length * 0.95)] < targetMs
    };
  }
}
```

## 测试工具

### 本地测试工具

```typescript
// scripts/testing/test-local.ts
#!/usr/bin/env tsx

import { program } from 'commander';
import { createInterface } from 'readline/promises';
import chalk from 'chalk';

class LocalTestRunner {
  private rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  async run() {
    console.log(chalk.blue('=== 通知系统本地测试工具 ===\n'));
    
    while (true) {
      const choice = await this.showMenu();
      
      switch (choice) {
        case '1':
          await this.testSendNotification();
          break;
        case '2':
          await this.testUserConfig();
          break;
        case '3':
          await this.testTemplate();
          break;
        case '4':
          await this.testQueryLogs();
          break;
        case '5':
          await this.runAllTests();
          break;
        case '0':
          console.log(chalk.yellow('\n再见！'));
          process.exit(0);
        default:
          console.log(chalk.red('无效选择，请重试'));
      }
    }
  }
  
  private async showMenu(): Promise<string> {
    console.log(chalk.cyan('\n请选择要测试的功能：'));
    console.log('1. 发送通知');
    console.log('2. 用户配置管理');
    console.log('3. 模板管理');
    console.log('4. 查询日志');
    console.log('5. 运行所有测试');
    console.log('0. 退出');
    
    return await this.rl.question('\n请输入选择: ');
  }
  
  private async testSendNotification() {
    console.log(chalk.green('\n=== 测试发送通知 ==='));
    
    const userId = await this.rl.question('用户 ID (默认: test-user): ') || 'test-user';
    const channels = await this.rl.question('渠道 (逗号分隔, 默认: webhook): ') || 'webhook';
    const templateKey = await this.rl.question('模板 key (可选): ');
    
    const payload = {
      user_id: userId,
      channels: channels.split(',').map(c => c.trim()),
      ...(templateKey ? { template_key: templateKey } : {
        custom_content: {
          subject: '测试通知',
          content: '这是一条来自本地测试工具的通知'
        }
      })
    };
    
    try {
      const response = await this.sendRequest('/api/send-notification', 'POST', payload);
      console.log(chalk.green('✅ 发送成功！'));
      console.log(chalk.gray(JSON.stringify(response, null, 2)));
    } catch (error) {
      console.log(chalk.red('❌ 发送失败：'), error.message);
    }
  }
  
  private async sendRequest(endpoint: string, method: string, body?: any) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = body ? JSON.stringify(body) : '';
    const signature = this.generateSignature(timestamp + payload);
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Signature': signature
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
  }
}

// 运行测试工具
new LocalTestRunner().run();
```

### Grafana 测试工具

```typescript
// scripts/testing/test-grafana-webhook.ts
export class GrafanaWebhookTester {
  async sendTestAlert(options: {
    severity: 'critical' | 'warning' | 'info';
    alertName: string;
    instance?: string;
    description?: string;
  }) {
    const alert = {
      receiver: 'notification-system',
      status: 'firing',
      alerts: [{
        status: 'firing',
        labels: {
          alertname: options.alertName,
          severity: options.severity,
          instance: options.instance || 'test-server-01',
          notification_channels: 'lark,webhook',
          notification_user: 'ops-team'
        },
        annotations: {
          summary: `[${options.severity.toUpperCase()}] ${options.alertName}`,
          description: options.description || '这是一条测试告警'
        },
        startsAt: new Date().toISOString(),
        generatorURL: 'http://grafana.example.com/alerting/list'
      }],
      groupLabels: {
        alertname: options.alertName
      },
      commonLabels: {
        severity: options.severity
      }
    };
    
    const response = await fetch(`${BASE_URL}/api/webhooks/grafana`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from('grafana:password').toString('base64')}`
      },
      body: JSON.stringify(alert)
    });
    
    return response.json();
  }
  
  async runTestScenarios() {
    console.log('运行 Grafana 告警测试场景...\n');
    
    // 场景 1: 严重告警
    console.log('1. 测试严重告警...');
    await this.sendTestAlert({
      severity: 'critical',
      alertName: 'HighCPUUsage',
      description: 'CPU 使用率超过 90%'
    });
    
    // 场景 2: 告警恢复
    console.log('2. 测试告警恢复...');
    await this.sendResolvedAlert('HighCPUUsage');
    
    // 场景 3: 批量告警
    console.log('3. 测试批量告警...');
    await this.sendBatchAlerts([
      { alertName: 'DiskSpaceLow', severity: 'warning' },
      { alertName: 'MemoryHigh', severity: 'warning' },
      { alertName: 'ServiceDown', severity: 'critical' }
    ]);
  }
}
```

## 持续集成

### GitHub Actions 配置

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: 设置 Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: 安装依赖
      run: npm ci
    
    - name: 类型检查
      run: npm run typecheck
    
    - name: 代码风格检查
      run: npm run lint
    
    - name: 单元测试
      run: npm run test:ci
      env:
        CI: true
    
    - name: 上传测试覆盖率
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info
        flags: unittests
    
    - name: 集成测试
      run: npm run test:integration:ci
      env:
        TEST_API_URL: ${{ secrets.TEST_API_URL }}
        TEST_API_KEY: ${{ secrets.TEST_API_KEY }}
    
    - name: E2E 测试
      run: npx playwright test
      
    - name: 上传测试报告
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: test-reports
        path: |
          coverage/
          test-results/
          playwright-report/
```

### 测试报告

```typescript
// scripts/testing/generate-test-report.ts
export class TestReportGenerator {
  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      },
      coverage: await this.getCoverageData(),
      performance: await this.getPerformanceData(),
      failures: []
    };
    
    // 生成 HTML 报告
    const html = this.generateHTML(report);
    await fs.writeFile('test-report.html', html);
    
    // 生成 Markdown 报告（用于 PR 评论）
    const markdown = this.generateMarkdown(report);
    await fs.writeFile('test-report.md', markdown);
  }
  
  private generateMarkdown(report: TestReport): string {
    return `
# 测试报告

**时间**: ${report.timestamp}
**环境**: ${report.environment}

## 摘要

| 指标 | 数值 |
|------|------|
| 总测试数 | ${report.summary.total} |
| 通过 | ${report.summary.passed} ✅ |
| 失败 | ${report.summary.failed} ❌ |
| 跳过 | ${report.summary.skipped} ⏭️ |
| 耗时 | ${report.summary.duration}ms |

## 测试覆盖率

| 类型 | 覆盖率 |
|------|--------|
| 行覆盖率 | ${report.coverage.lines}% |
| 函数覆盖率 | ${report.coverage.functions}% |
| 分支覆盖率 | ${report.coverage.branches}% |
| 语句覆盖率 | ${report.coverage.statements}% |

## 性能测试

| API | P95 响应时间 | 目标 | 状态 |
|-----|-------------|------|------|
| 健康检查 | ${report.performance.health.p95}ms | <50ms | ${report.performance.health.passed ? '✅' : '❌'} |
| 发送通知 | ${report.performance.send.p95}ms | <200ms | ${report.performance.send.passed ? '✅' : '❌'} |

${report.failures.length > 0 ? `
## 失败的测试

${report.failures.map(f => `- ${f.name}: ${f.error}`).join('\n')}
` : ''}
`;
  }
}
```

## 测试最佳实践

### 测试编写原则

1. **F.I.R.S.T 原则**
   - **Fast** (快速): 测试应该快速执行
   - **Independent** (独立): 测试相互独立
   - **Repeatable** (可重复): 任何环境下结果一致
   - **Self-Validating** (自验证): 明确的通过/失败结果
   - **Timely** (及时): 在生产代码之前编写

2. **测试覆盖率目标**
   ```typescript
   // vitest.config.ts
   export default defineConfig({
     test: {
       coverage: {
         provider: 'v8',
         thresholds: {
           lines: 80,
           functions: 80,
           branches: 80,
           statements: 80
         },
         exclude: [
           'node_modules',
           'test',
           '**/*.test.ts',
           '**/*.spec.ts',
           '**/types.ts'
         ]
       }
     }
   });
   ```

3. **测试组织结构**
   ```typescript
   describe('NotificationService', () => {
     describe('when user exists', () => {
       describe('and has valid config', () => {
         it('should send notification successfully', () => {});
       });
       
       describe('and has invalid config', () => {
         it('should throw ConfigurationError', () => {});
       });
     });
     
     describe('when user does not exist', () => {
       it('should throw UserNotFoundError', () => {});
     });
   });
   ```

### 1. 测试命名规范

```typescript
// ✅ 好的测试名称 - 描述期望行为
it('应该在签名无效时返回 401 错误')
it('当用户不存在时应该抛出 UserNotFoundError')
it('应该在 5 秒内发送 100 条通知')

// ❌ 不好的测试名称
it('测试错误')
it('验证功能')
it('测试1')
```

### 2. 测试结构 (AAA 模式)

```typescript
it('应该成功创建用户配置', async () => {
  // Arrange - 准备测试数据
  const userId = 'test-user-123';
  const channelConfig = {
    channel_type: 'webhook',
    webhook_url: 'https://example.com/webhook'
  };
  
  // Act - 执行测试操作
  const result = await userService.createConfig(userId, channelConfig);
  
  // Assert - 验证结果
  expect(result).toBeDefined();
  expect(result.user_id).toBe(userId);
  expect(result.channel_type).toBe('webhook');
});
```

### 3. 测试隔离

```typescript
describe('NotificationService', () => {
  let service: NotificationService;
  let testData: TestDataManager;
  
  beforeEach(async () => {
    // 每个测试使用独立的数据
    testData = new TestDataManager();
    service = new NotificationService(createTestDb());
  });
  
  afterEach(async () => {
    // 清理测试数据
    await testData.cleanup();
    // 重置所有模拟
    vi.resetAllMocks();
  });
});
```

### 4. 测试数据工厂

```typescript
// test/factories/notification.factory.ts
export const notificationFactory = {
  build: (overrides: Partial<Notification> = {}): Notification => ({
    id: faker.datatype.uuid(),
    user_id: faker.datatype.uuid(),
    channel_type: faker.helpers.arrayElement(['webhook', 'lark', 'telegram']),
    status: 'pending',
    created_at: faker.date.recent(),
    ...overrides
  }),
  
  buildList: (count: number, overrides: Partial<Notification> = {}): Notification[] => {
    return Array.from({ length: count }, () => notificationFactory.build(overrides));
  }
};
```

### 5. 异步测试最佳实践

```typescript
// 使用 async/await
it('应该处理并发请求', async () => {
  const promises = Array.from({ length: 10 }, (_, i) => 
    service.sendNotification({ id: `notification-${i}` })
  );
  
  const results = await Promise.all(promises);
  
  expect(results).toHaveLength(10);
  expect(results.every(r => r.success)).toBe(true);
});

// 测试超时处理
it('应该在超时后抛出错误', async () => {
  const slowOperation = new Promise((resolve) => 
    setTimeout(resolve, 10000)
  );
  
  await expect(
    withTimeout(slowOperation, 1000)
  ).rejects.toThrow('Operation timed out');
}, 2000); // 测试本身的超时时间
```

### 6. 模拟策略

```typescript
// 部分模拟
vi.mock('../services/EmailService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    sendEmail: vi.fn().mockResolvedValue({ success: true })
  };
});

// 条件模拟
beforeEach(() => {
  if (process.env.USE_REAL_API !== 'true') {
    vi.mock('../api/client');
  }
});

// 智能模拟策略
export class SmartMock {
  static createAdapterMock(type: 'webhook' | 'lark' | 'telegram') {
    const baseMock = {
      send: vi.fn(),
      validate: vi.fn().mockReturnValue(true),
      getName: vi.fn().mockReturnValue(type)
    };
    
    switch (type) {
      case 'webhook':
        baseMock.send.mockResolvedValue({
          success: true,
          statusCode: 200,
          messageId: `webhook_${Date.now()}`
        });
        break;
        
      case 'lark':
        baseMock.send.mockResolvedValue({
          success: true,
          messageId: `lark_${Date.now()}`,
          data: { code: 0, msg: 'success' }
        });
        break;
        
      case 'telegram':
        baseMock.send.mockResolvedValue({
          success: true,
          messageId: Date.now(),
          chat_id: '-1001234567890'
        });
        break;
    }
    
    return baseMock;
  }
  
  static createDatabaseMock() {
    const queries = new Map();
    
    return {
      prepare: vi.fn((sql: string) => ({
        all: vi.fn().mockImplementation(() => {
          const key = sql.toLowerCase();
          if (key.includes('select') && key.includes('user_configs')) {
            return { results: queries.get('user_configs') || [] };
          }
          return { results: [] };
        }),
        first: vi.fn().mockImplementation(() => {
          const results = queries.get('first') || {};
          return results;
        }),
        run: vi.fn().mockResolvedValue({ success: true })
      })),
      
      // 设置模拟数据
      setMockData: (table: string, data: any[]) => {
        queries.set(table, data);
      }
    };
  }
}
```

## 故障排查

### 常见测试问题

#### 1. 测试在 CI 中失败但本地通过

**可能原因**：
- 时区差异
- 环境变量缺失
- 依赖版本不一致
- 并发测试相互影响

**解决方案**：
```typescript
// 固定时区
process.env.TZ = 'UTC';

// 使用固定时间
vi.setSystemTime(new Date('2025-01-06T10:00:00Z'));

// 隔离并发测试
test.concurrent.each([...])('并发测试 %s', async (scenario) => {
  // 每个测试使用独立的资源
});
```

#### 2. 模拟不生效

**问题**：`vi.mock()` 似乎没有效果

**解决方案**：
```typescript
// 确保 mock 在导入前
vi.mock('../db');
import { service } from '../service'; // 必须在 mock 之后

// 或使用动态导入
beforeEach(async () => {
  vi.mock('../db');
  const { service } = await import('../service');
});
```

#### 3. 数据库连接错误

**问题**：测试无法连接到数据库

**解决方案**：
```bash
# 使用内存数据库进行测试
DATABASE_URL=:memory: npm test

# 或使用 Docker
docker run -d -p 5432:5432 postgres:15
DATABASE_URL=postgresql://localhost:5432/test npm test
```

#### 4. 测试性能问题

**问题**：测试运行缓慢

**解决方案**：
```typescript
// 并行运行独立测试
describe.concurrent('独立测试套件', () => {
  test.concurrent('测试1', async () => {});
  test.concurrent('测试2', async () => {});
});

// 共享昂贵的设置
let sharedResource;
beforeAll(async () => {
  sharedResource = await createExpensiveResource();
});
```

### 调试技巧

```typescript
// 1. 使用调试输出
it('调试测试', async () => {
  const result = await complexOperation();
  
  // 临时添加调试信息
  console.log('Result:', JSON.stringify(result, null, 2));
  
  expect(result).toBeDefined();
});

// 2. 使用调试器
it('使用调试器', async () => {
  debugger; // 在此处设置断点
  const result = await service.process();
});

// 3. 只运行特定测试
it.only('只运行这个测试', () => {});
it.skip('跳过这个测试', () => {});

// 4. 使用测试快照
it('应该匹配快照', () => {
  const result = generateReport(data);
  expect(result).toMatchSnapshot();
});
```

## 相关文档

- [开发指南](../02-guides/development.md)
- [API 参考](../03-reference/api/complete-api-reference.md)
- [监控运维](./monitoring.md)
- [故障排查](./troubleshooting.md)
- [性能优化](../03-reference/architecture/performance-tuning.md)
- [数据库管理](./database.md)
- [安全指南](../04-security/security-guide.md)
- [部署指南](../02-guides/deployment.md)

---

**最后更新**: 2025-01-06
**版本**: 2.0
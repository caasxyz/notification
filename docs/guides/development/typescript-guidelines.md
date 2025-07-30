# TypeScript 开发规范

本文档定义了通知系统项目中 TypeScript 代码的编写规范和最佳实践。

## 目录

- [编译器配置](#编译器配置)
- [类型系统规范](#类型系统规范)
- [命名规范](#命名规范)
- [代码组织](#代码组织)
- [错误处理](#错误处理)
- [异步编程](#异步编程)
- [数据库操作](#数据库操作)
- [测试规范](#测试规范)
- [性能优化](#性能优化)
- [Cloudflare Workers 特定规范](#cloudflare-workers-特定规范)
- [调试和日志](#调试和日志)
- [迁移指南](#迁移指南)

## 编译器配置

项目使用严格的 TypeScript 配置，确保类型安全和代码质量。

### 核心配置

项目使用的完整 TypeScript 配置如下：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "moduleResolution": "node",
    "rootDir": "./src",
    "outDir": "./dist",
    
    // 严格模式
    "strict": true,                              // 启用所有严格类型检查
    "noImplicitAny": true,                      // 禁止隐式 any
    "strictNullChecks": true,                   // 严格的 null 检查
    "strictFunctionTypes": true,                // 严格的函数类型
    "strictBindCallApply": true,                // 严格的 bind/call/apply 检查
    "strictPropertyInitialization": true,       // 严格的属性初始化
    "alwaysStrict": true,                       // 总是使用严格模式
    
    // 额外的严格检查
    "noUncheckedIndexedAccess": true,           // 索引访问返回 T | undefined
    "exactOptionalPropertyTypes": true,          // 精确的可选属性类型
    "noPropertyAccessFromIndexSignature": true,  // 禁止从索引签名使用点语法
    "noImplicitOverride": true,                 // 需要显式 override 关键字
    
    // 代码质量检查
    "noUnusedLocals": true,                     // 禁止未使用的局部变量
    "noUnusedParameters": true,                 // 禁止未使用的参数
    "noImplicitReturns": true,                  // 禁止隐式返回
    "noFallthroughCasesInSwitch": true,         // 禁止 switch 语句穿透
    "allowUnusedLabels": false,                 // 禁止未使用的标签
    "allowUnreachableCode": false,              // 禁止不可达代码
    
    // 模块解析
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

### 生产环境配置

`tsconfig.prod.json` 排除测试文件和脚本：

```json
{
  "extends": "./tsconfig.json",
  "exclude": [
    "node_modules", 
    "dist", 
    "src/**/*.test.ts", 
    "src/__tests__/**/*", 
    "scripts/**/*",
    "**/archive/**/*"
  ]
}
```

### 重要规则说明

#### 1. 索引签名访问 (noPropertyAccessFromIndexSignature)

```typescript
// ❌ 错误 - 来自索引签名的属性不能使用点语法
const config: Record<string, any> = getData();
const value = config.someProperty;  // 错误！

// ✅ 正确 - 使用方括号语法
const value = config['someProperty'];

// ✅ 正确 - 明确定义的接口属性可以使用点语法
interface UserConfig {
  userId: string;
  channelType: string;
}
const userConfig: UserConfig = { userId: '123', channelType: 'lark' };
const userId = userConfig.userId;  // OK
```

#### 2. 环境变量动态访问

当需要动态访问环境变量时，使用类型断言：

```typescript
// 实际代码示例 - src/api/middleware/basicAuth.ts
const usernameEnvKey = `${service.toUpperCase()}_WEBHOOK_USERNAME`;
const passwordEnvKey = `${service.toUpperCase()}_WEBHOOK_PASSWORD`;

const expectedUsername = env[usernameEnvKey as keyof Env] as string;
const expectedPassword = env[passwordEnvKey as keyof Env] as string;
```

#### 3. 未检查的索引访问 (noUncheckedIndexedAccess)

```typescript
// 数组和记录的索引访问返回 T | undefined
const items = [1, 2, 3];
const firstItem = items[0];  // number | undefined

// 必须进行空值检查
if (firstItem !== undefined) {
  console.log(firstItem + 1);  // OK
}

// 或使用断言（确定存在时）
const definitelyExists = items[0]!;  // number
```

#### 4. 精确的可选属性 (exactOptionalPropertyTypes)

```typescript
// 可选属性不能显式设置为 undefined
interface NotificationOptions {
  timeout?: number;
  retryCount?: number;
}

// ❌ 错误
const options: NotificationOptions = { timeout: undefined };

// ✅ 正确
const options1: NotificationOptions = {};
const options2: NotificationOptions = { timeout: 5000 };
```

## 类型系统规范

### 1. 类型定义原则

#### 优先使用 interface

```typescript
// ✅ 推荐 - 对象类型使用 interface
interface NotificationRequest {
  userId: string;
  channelType: NotificationChannel;
  subject: string;
  content: string;
}

// ⚠️ 仅在需要联合类型、交叉类型或映射类型时使用 type
type NotificationStatus = 'pending' | 'sent' | 'failed' | 'retry';
type Nullable<T> = T | null;
type ReadonlyConfig = Readonly<NotificationRequest>;
```

#### 避免使用 any

```typescript
// ❌ 避免
function processData(data: any) {
  return data.someProperty;
}

// ✅ 使用 unknown 或具体类型
function processData(data: unknown) {
  // 类型守卫
  if (isNotificationRequest(data)) {
    return data.userId;
  }
  throw new Error('Invalid data format');
}

// 类型守卫函数
function isNotificationRequest(data: unknown): data is NotificationRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    'userId' in data &&
    'channelType' in data
  );
}
```

### 2. 类型导入导出

```typescript
// ✅ 使用 type-only imports 提高构建性能
import type { Env, Context } from '../types';
import type { UserConfig } from '../db/schema';

// ✅ 分离类型导入和值导入
import type { Logger } from '../utils/logger';
import { createLogger } from '../utils/logger';

// ✅ 导出类型时使用 type 关键字
export type { NotificationRequest, NotificationResponse };
export type { UserConfig } from '../db/schema';
```

### 3. 泛型使用

```typescript
// ✅ 有意义的泛型参数名
interface Repository<TEntity extends BaseEntity, TId = string> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<TEntity>;
  delete(id: TId): Promise<boolean>;
}

// ✅ 泛型约束
interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

function sortByDate<T extends Timestamped>(items: T[]): T[] {
  return items.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
```

## 命名规范

### 1. 基本规则

```typescript
// 接口和类型 - PascalCase
interface NotificationService {}
type ChannelAdapter = {};
class NotificationDispatcher {}

// 枚举 - PascalCase，成员 UPPER_SNAKE_CASE
enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed'
}

// 变量和函数 - camelCase
const userId = 'user-123';
function sendNotification() {}

// 常量 - UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT = 30000;
const API_BASE_URL = 'https://api.example.com';

// 私有属性 - 前缀下划线
class CacheService {
  private _cache: Map<string, any>;
  private _ttl: number;
}
```

### 2. 文件命名

```typescript
// 类和接口文件 - PascalCase
NotificationDispatcher.ts
UserConfigService.ts
BaseAdapter.ts

// 工具和辅助函数 - camelCase
crypto.ts
logger.ts
validation.ts

// 测试文件 - 与源文件同名加 .test
NotificationDispatcher.test.ts
crypto.test.ts

// 类型定义文件
types/index.ts
types/notification.ts
```

## 代码组织

### 1. 模块结构

```typescript
// 1. License/Header 注释（如需要）

// 2. 导入 - 按类型分组，每组内按字母顺序
// 2.1 Node 内置模块
import { Buffer } from 'node:buffer';

// 2.2 外部依赖
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

// 2.3 内部模块 - 类型导入
import type { Env, NotificationRequest } from '../types';
import type { UserConfig } from '../db/schema';

// 2.4 内部模块 - 值导入
import { getDb } from '../db';
import { Logger } from '../utils/logger';
import { NotificationError } from '../utils/errors';

// 3. 模块级常量
const DEFAULT_RETRY_COUNT = 3;
const CACHE_TTL = 300; // 5 minutes

// 4. 类型定义
interface LocalConfig {
  timeout: number;
  maxRetries: number;
}

// 5. 主要导出
export class NotificationService {
  // 实现
}

// 6. 辅助函数
function validateConfig(config: unknown): LocalConfig {
  // 实现
}
```

### 2. 类组织

```typescript
export class NotificationDispatcherV2 {
  // 1. 静态属性
  private static readonly DEFAULT_TIMEOUT = 30000;
  private static readonly logger = new Logger('NotificationDispatcher');
  
  // 2. 实例属性
  private readonly db: D1Database;
  private cache: Map<string, CachedConfig>;
  
  // 3. 构造函数
  constructor(private readonly env: Env) {
    this.db = getDb(env);
    this.cache = new Map();
  }
  
  // 4. 公共方法
  async dispatch(request: NotificationRequest): Promise<NotificationResult> {
    this.validateRequest(request);
    const config = await this.getUserConfig(request.userId);
    return await this.send(request, config);
  }
  
  // 5. 受保护方法
  protected async send(
    request: NotificationRequest,
    config: UserConfig
  ): Promise<NotificationResult> {
    // 实现
  }
  
  // 6. 私有方法
  private validateRequest(request: unknown): asserts request is NotificationRequest {
    // 验证逻辑
  }
  
  private async getUserConfig(userId: string): Promise<UserConfig> {
    // 实现
  }
}
```

## 错误处理

### 1. 自定义错误类

项目中实际使用的错误类定义在 `src/utils/errors.ts` 和 `src/types/index.ts`：

```typescript
// src/utils/errors.ts - 基础错误类
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

// src/types/index.ts - 系统错误类
export class NotificationSystemError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'NotificationSystemError';
  }
}
```

### 2. 错误处理模式

```typescript
// ✅ 使用 try-catch 处理异步错误
export async function handleNotification(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const data = await request.json();
    const result = await processNotification(data, env);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return handleError(error);
  }
}

// 统一的错误处理函数
function handleError(error: unknown): Response {
  const logger = new Logger('ErrorHandler');
  
  if (error instanceof NotificationSystemError) {
    logger.warn('Business error', { error: error.toJSON() });
    
    return new Response(JSON.stringify({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      }
    }), {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // 未预期的错误
  logger.error('Unexpected error', error);
  
  return new Response(JSON.stringify({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    }
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### 3. Result 类型模式

```typescript
// Result 类型定义
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// 使用 Result 类型处理预期错误
function parseJSON<T>(json: string): Result<T, ValidationError> {
  try {
    const data = JSON.parse(json);
    return { success: true, data };
  } catch {
    return {
      success: false,
      error: new ValidationError('Invalid JSON format'),
    };
  }
}

// 使用示例
const result = parseJSON<UserConfig>(jsonString);
if (result.success) {
  // 使用 result.data
  console.log(result.data.userId);
} else {
  // 处理 result.error
  logger.error('Parse error', result.error);
}
```

## 异步编程

### 1. async/await 最佳实践

```typescript
// ✅ 正确的异步错误处理
export async function sendToChannel(
  channel: string,
  message: NotificationMessage,
  env: Env
): Promise<void> {
  const adapter = getAdapter(channel);
  
  try {
    await adapter.send(message);
    await logSuccess(message.id, env);
  } catch (error) {
    await logFailure(message.id, error, env);
    
    if (shouldRetry(error)) {
      await scheduleRetry(message, env);
    }
    
    throw error;
  }
}

// ✅ 并发执行独立操作
export async function loadUserData(
  userId: string,
  env: Env
): Promise<UserDashboard> {
  // 并发执行所有独立的数据获取
  const [user, configs, recentLogs, stats] = await Promise.all([
    getUser(userId, env),
    getUserConfigs(userId, env),
    getRecentLogs(userId, env),
    getUserStats(userId, env),
  ]);
  
  return {
    user,
    configs,
    recentLogs,
    stats,
  };
}

// ✅ 使用 Promise.allSettled 处理部分失败
export async function notifyAllChannels(
  message: NotificationMessage,
  channels: string[],
  env: Env
): Promise<NotificationResults> {
  const results = await Promise.allSettled(
    channels.map(channel => sendToChannel(channel, message, env))
  );
  
  return {
    successful: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').map(r => ({
      channel: channels[results.indexOf(r)],
      error: (r as PromiseRejectedResult).reason,
    })),
  };
}
```

### 2. Promise 工具函数

```typescript
// 带超时的 Promise
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

// 重试机制
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: 'linear' | 'exponential';
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 'exponential',
    shouldRetry = () => true,
  } = options;
  
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      
      const waitTime = backoff === 'exponential'
        ? delay * Math.pow(2, attempt - 1)
        : delay * attempt;
        
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}
```

## 数据库操作

### 1. Drizzle ORM 类型安全

```typescript
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { userConfigs, notificationLogs } from '../db/schema';
import type { UserConfig, NewUserConfig } from '../db/schema';

// ✅ 类型安全的查询
export async function getUserConfigs(
  userId: string,
  channels: string[],
  env: Env
): Promise<UserConfig[]> {
  const db = getDb(env);
  
  const configs = await db
    .select()
    .from(userConfigs)
    .where(
      and(
        eq(userConfigs.userId, userId),
        inArray(userConfigs.channelType, channels),
        eq(userConfigs.isActive, 1)
      )
    );
    
  return configs;
}

// ✅ 使用事务确保数据一致性
export async function createTemplateWithContents(
  templateData: NewTemplate,
  contents: NewTemplateContent[],
  env: Env
): Promise<void> {
  const db = getDb(env);
  
  await db.transaction(async (tx) => {
    // 插入模板
    await tx
      .insert(notificationTemplatesV2)
      .values(templateData);
    
    // 插入模板内容
    if (contents.length > 0) {
      await tx
        .insert(templateContents)
        .values(contents);
    }
  });
}

// ✅ 处理可能为空的查询结果
export async function getTemplateByKey(
  key: string,
  env: Env
): Promise<Template> {
  const db = getDb(env);
  
  const templates = await db
    .select()
    .from(notificationTemplatesV2)
    .where(eq(notificationTemplatesV2.templateKey, key))
    .limit(1);
    
  if (!templates[0]) {
    throw new NotFoundError('Template', key);
  }
  
  return templates[0];
}

// ✅ 复杂查询示例
export async function getNotificationStats(
  userId: string,
  startDate: string,
  endDate: string,
  env: Env
): Promise<NotificationStats[]> {
  const db = getDb(env);
  
  const stats = await db
    .select({
      date: sql<string>`date(${notificationLogs.createdAt})`,
      status: notificationLogs.status,
      channel: notificationLogs.channelType,
      count: sql<number>`count(*)`,
    })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.userId, userId),
        sql`${notificationLogs.createdAt} >= ${startDate}`,
        sql`${notificationLogs.createdAt} < ${endDate}`
      )
    )
    .groupBy(
      sql`date(${notificationLogs.createdAt})`,
      notificationLogs.status,
      notificationLogs.channelType
    )
    .orderBy(desc(sql`date(${notificationLogs.createdAt})`));
    
  return stats;
}
```

### 2. 数据验证和转换

```typescript
// 使用 Zod 进行运行时验证
import { z } from 'zod';

// 定义验证模式
const ConfigDataSchema = z.object({
  webhookUrl: z.string().url(),
  secret: z.string().min(1),
  timeout: z.number().positive().optional(),
});

// 验证和转换数据库中的 JSON
export async function getValidatedConfig(
  userId: string,
  channel: string,
  env: Env
): Promise<ValidatedConfig> {
  const db = getDb(env);
  
  const configs = await db
    .select()
    .from(userConfigs)
    .where(
      and(
        eq(userConfigs.userId, userId),
        eq(userConfigs.channelType, channel)
      )
    )
    .limit(1);
    
  if (!configs[0]) {
    throw new NotFoundError('UserConfig', `${userId}:${channel}`);
  }
  
  // 解析和验证 JSON 数据
  try {
    const configData = JSON.parse(configs[0].configData);
    const validated = ConfigDataSchema.parse(configData);
    
    return {
      ...configs[0],
      configData: validated,
    };
  } catch (error) {
    throw new ValidationError('Invalid config data format', { error });
  }
}
```

## 测试规范

### 1. 单元测试结构

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockedFunction } from 'vitest';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof getDb>;
  
  beforeEach(() => {
    // 设置 mock
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    } as any;
    
    mockEnv = {
      DB: {} as D1Database,
      CONFIG_CACHE: {
        get: vi.fn(),
        put: vi.fn(),
      } as any,
    };
    
    // 模拟 getDb
    vi.mocked(getDb).mockReturnValue(mockDb);
    
    service = new NotificationService(mockEnv);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('sendNotification', () => {
    it('应该成功发送通知', async () => {
      // Arrange
      const request: NotificationRequest = {
        userId: 'user-123',
        channelType: 'lark',
        subject: '测试通知',
        content: '这是测试内容',
      };
      
      const mockConfig: UserConfig = {
        id: 1,
        userId: 'user-123',
        channelType: 'lark',
        configData: JSON.stringify({ webhookUrl: 'https://...' }),
        isActive: 1,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      };
      
      mockDb.limit = vi.fn().mockResolvedValue([mockConfig]);
      
      // Act
      const result = await service.sendNotification(request);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(mockDb.where).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          channelType: 'lark',
        })
      );
    });
    
    it('应该在配置不存在时抛出错误', async () => {
      // Arrange
      const request: NotificationRequest = {
        userId: 'user-123',
        channelType: 'lark',
        subject: '测试',
        content: '内容',
      };
      
      mockDb.limit = vi.fn().mockResolvedValue([]);
      
      // Act & Assert
      await expect(service.sendNotification(request))
        .rejects
        .toThrow(NotFoundError);
    });
  });
});
```

### 2. 测试工具和模式

```typescript
// 测试数据工厂
export class TestDataFactory {
  static createUser(overrides?: Partial<User>): User {
    return {
      id: `user-${Date.now()}`,
      name: 'Test User',
      email: 'test@example.com',
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }
  
  static createNotificationRequest(
    overrides?: Partial<NotificationRequest>
  ): NotificationRequest {
    return {
      userId: 'test-user',
      channelType: 'webhook',
      subject: 'Test Subject',
      content: 'Test Content',
      ...overrides,
    };
  }
}

// 异步测试辅助函数
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    errorMessage?: string;
  } = {}
): Promise<void> {
  const {
    timeout = 5000,
    interval = 100,
    errorMessage = 'Condition not met within timeout',
  } = options;
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(errorMessage);
}

// Mock 辅助函数
export function createMockAdapter(): MockedAdapter {
  return {
    send: vi.fn().mockResolvedValue({ success: true }),
    validate: vi.fn().mockReturnValue(true),
  };
}
```

## 性能优化

### 1. 避免不必要的计算

```typescript
// ❌ 在循环中重复计算
function processNotifications(notifications: Notification[], config: Config) {
  for (const notification of notifications) {
    const template = compileTemplate(config.template); // 重复编译
    const message = template(notification);
    send(message);
  }
}

// ✅ 提前计算
function processNotifications(notifications: Notification[], config: Config) {
  const template = compileTemplate(config.template); // 一次编译
  
  for (const notification of notifications) {
    const message = template(notification);
    send(message);
  }
}
```

### 2. 使用适当的数据结构

```typescript
// ✅ 使用 Map 进行频繁查找
export class ConfigCache {
  private cache = new Map<string, CachedConfig>();
  
  getCacheKey(userId: string, channel: string): string {
    return `${userId}:${channel}`;
  }
  
  get(userId: string, channel: string): CachedConfig | undefined {
    return this.cache.get(this.getCacheKey(userId, channel));
  }
  
  set(userId: string, channel: string, config: UserConfig): void {
    this.cache.set(this.getCacheKey(userId, channel), {
      config,
      timestamp: Date.now(),
    });
  }
}

// ✅ 使用 Set 检查唯一性
function getUniqueChannels(notifications: Notification[]): string[] {
  const channels = new Set<string>();
  
  for (const notification of notifications) {
    channels.add(notification.channel);
  }
  
  return Array.from(channels);
}
```

### 3. 批处理优化

```typescript
// ❌ 逐个处理
async function saveNotifications(notifications: Notification[]) {
  for (const notification of notifications) {
    await db.insert(notificationLogs).values(notification);
  }
}

// ✅ 批量处理
async function saveNotifications(notifications: Notification[]) {
  // 分批处理，避免超出数据库限制
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
    const batch = notifications.slice(i, i + BATCH_SIZE);
    await db.insert(notificationLogs).values(batch);
  }
}
```

## 安全实现

### 1. 安全头配置

项目在 `src/security/SecurityEnhancements.ts` 中实现了完整的安全头：

```typescript
export class SecurityEnhancements {
  static applySecurityHeaders(response: Response): Response {
    const headers = new Headers(response.headers);
    
    // 内容安全策略
    headers.set('Content-Security-Policy', "default-src 'self'");
    
    // 防止点击劫持
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-Content-Type-Options', 'nosniff');
    
    // 强制 HTTPS
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    // XSS 防护
    headers.set('X-XSS-Protection', '1; mode=block');
    
    // 引用策略
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
```

### 2. 速率限制

使用 Cloudflare KV 实现多层速率限制：

```typescript
// 速率限制配置
const RATE_LIMITS = {
  global: { limit: 100, window: 60 },           // 每分钟 100 请求
  authFailure: { limit: 5, window: 900 },       // 15 分钟内最多 5 次失败
  perUser: { limit: 30, window: 60 },           // 每用户每分钟 30 请求
  apiEndpoint: {
    '/api/send-notification': { limit: 10, window: 60 },
    '/api/templates': { limit: 50, window: 60 },
  },
};
```

### 3. Basic Auth 中间件

用于 Grafana webhook 等需要 Basic Auth 的端点：

```typescript
export async function basicAuthMiddleware(
  request: Request,
  env: Env,
  service: string = 'grafana'
): Promise<Response | null> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new Response('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Webhook"' },
    });
  }
  
  // 验证凭据...
}
```

## Cloudflare Workers 特定规范

### 1. 请求处理

```typescript
// ✅ 正确的 Worker 入口
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // 使用 waitUntil 处理后台任务
    ctx.waitUntil(logRequest(request, env));
    
    try {
      // 路由处理
      return await router.handle(request, env, ctx);
    } catch (error) {
      return handleError(error);
    }
  },
  
  // 队列处理器
  async queue(
    batch: MessageBatch<QueueMessage>,
    env: Env
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processMessage(message.body, env);
        message.ack();
      } catch (error) {
        message.retry();
      }
    }
  },
};
```

### 2. 环境变量类型定义

```typescript
// ✅ 完整的环境变量类型
export interface Env {
  // 数据库
  DB: D1Database;
  
  // KV 存储
  CONFIG_CACHE: KVNamespace;
  RATE_LIMIT_KV?: KVNamespace; // 可选
  
  // 队列
  RETRY_QUEUE: Queue<RetryMessage>;
  FAILED_QUEUE: Queue<FailedMessage>;
  
  // 密钥和配置
  API_SECRET_KEY: string;
  ENCRYPT_KEY: string;
  
  // 可选配置
  DEBUG?: string;
  LOG_LEVEL?: string;
  
  // 第三方服务凭据
  GRAFANA_USERNAME?: string;
  GRAFANA_PASSWORD?: string;
}
```

### 3. KV 存储使用

```typescript
// ✅ KV 存储最佳实践
export class KVCache {
  constructor(
    private kv: KVNamespace,
    private prefix: string = ''
  ) {}
  
  private getKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }
  
  async get<T>(key: string): Promise<T | null> {
    const value = await this.kv.get(this.getKey(key));
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value as T;
    }
  }
  
  async set<T>(
    key: string,
    value: T,
    options?: { expirationTtl?: number }
  ): Promise<void> {
    const serialized = typeof value === 'string' 
      ? value 
      : JSON.stringify(value);
      
    await this.kv.put(this.getKey(key), serialized, options);
  }
  
  async delete(key: string): Promise<void> {
    await this.kv.delete(this.getKey(key));
  }
}
```

## 调试和日志

### 1. 结构化日志

```typescript
export class Logger {
  constructor(private context: string) {}
  
  private log(level: string, message: string, meta?: Record<string, unknown>) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      ...meta,
    };
    
    console.log(JSON.stringify(entry));
  }
  
  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }
  
  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }
  
  error(message: string, error: unknown, meta?: Record<string, unknown>): void {
    this.log('error', message, {
      ...meta,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    });
  }
}
```

### 2. 性能监控

```typescript
// 性能测量装饰器
export function measurePerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    const logger = new Logger(`${target.constructor.name}.${propertyKey}`);
    
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      
      logger.info('Method completed', {
        duration,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      logger.error('Method failed', error, {
        duration,
        success: false,
      });
      
      throw error;
    }
  };
  
  return descriptor;
}

// 使用示例
class NotificationService {
  @measurePerformance
  async sendNotification(request: NotificationRequest): Promise<void> {
    // 实现
  }
}
```

## 队列系统

### 1. 重试机制

项目使用 Cloudflare Queues 实现智能重试：

```typescript
// 重试队列消息格式
export interface RetryMessage {
  logId: number;
  retryCount: number;
  type: 'retry_notification';
  scheduledAt: number;
  expectedProcessAt: number;
}

// 队列处理器
export async function processRetryQueue(
  batch: MessageBatch<RetryMessage>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await QueueProcessorV2.processRetry(message.body, env);
      message.ack();
    } catch (error) {
      if (message.body.retryCount >= MAX_RETRY_COUNT) {
        await env.FAILED_QUEUE.send(message.body);
        message.ack();
      } else {
        message.retry({ delaySeconds: calculateBackoff(message.body.retryCount) });
      }
    }
  }
}
```

### 2. 幂等性保证

使用 `idempotency_key` 防止重复发送：

```typescript
// 检查幂等性
async function checkIdempotency(
  key: string,
  userId: string,
  env: Env
): Promise<DuplicateCheckResult> {
  const existingResults = await env.CONFIG_CACHE.get(
    `idempotency:${userId}:${key}`,
    'json'
  );
  
  if (existingResults) {
    return {
      isDuplicate: true,
      results: existingResults as NotificationResult[],
    };
  }
  
  return { isDuplicate: false };
}
```

## Grafana 集成

### 1. Webhook 端点

专门的 Grafana webhook 处理：

```typescript
// 路径：/api/webhooks/grafana
export async function handleGrafanaWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  // Basic Auth 验证
  const authResult = await basicAuthMiddleware(request, env, 'grafana');
  if (authResult) return authResult;
  
  // 转换 Grafana 格式
  const grafanaData = await request.json() as GrafanaAlertData;
  const notifications = GrafanaTransformAdapter.transform(grafanaData);
  
  // 发送通知
  const results = await NotificationDispatcherV2.sendBatch(notifications, env);
  
  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### 2. 环境变量配置

```typescript
// 必需的环境变量
GRAFANA_WEBHOOK_USERNAME: string;
GRAFANA_WEBHOOK_PASSWORD: string;
```

## 模板系统 V2

### 1. 数据库架构

模板系统使用两个表实现多渠道支持：

```typescript
// notification_templates_v2 - 模板基本信息
export const notificationTemplatesV2 = sqliteTable('notification_templates_v2', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateKey: text('template_key').notNull().unique(),
  templateName: text('template_name').notNull(),
  description: text('description'),
  variables: text('variables'), // JSON 数组
  isActive: integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// template_contents - 各渠道的模板内容
export const templateContents = sqliteTable('template_contents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateId: integer('template_id').notNull(),
  channelType: text('channel_type').notNull(),
  subjectTemplate: text('subject_template'),
  contentTemplate: text('content_template').notNull(),
  contentType: text('content_type').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

### 2. 使用示例

```typescript
// 创建模板
const template = await createTemplate({
  templateKey: 'alert-notification',
  templateName: '告警通知',
  variables: ['alertName', 'severity', 'message'],
});

// 添加多渠道内容
await addTemplateContent(template.id, 'lark', {
  contentTemplate: '🚨 {{alertName}} - {{severity}}\n{{message}}',
  contentType: 'text',
});

await addTemplateContent(template.id, 'email', {
  subjectTemplate: '[{{severity}}] {{alertName}}',
  contentTemplate: '<h1>{{alertName}}</h1><p>{{message}}</p>',
  contentType: 'html',
});
```

## 迁移指南

### 从旧代码迁移到新规范

1. **运行类型检查**
   ```bash
   npm run typecheck       # 开发环境检查
   npm run typecheck:prod  # 生产环境检查（排除测试文件）
   ```

2. **修复索引签名访问**
   ```bash
   # 搜索需要修改的代码
   grep -r "row\." src/
   grep -r "config\." src/
   
   # 修改为方括号语法
   # row.user_id → row['user_id']
   # config.someKey → config['someKey']
   ```

3. **添加缺失的类型定义**
   - 为所有函数参数添加类型
   - 为所有函数返回值添加类型
   - 避免隐式 any

4. **处理可能的 undefined**
   ```typescript
   // 检查数组访问
   const first = array[0]; // 可能是 undefined
   if (first) {
     // 使用 first
   }
   
   // 或使用默认值
   const first = array[0] ?? defaultValue;
   ```

5. **更新导入语句**
   ```typescript
   // 分离类型导入
   import type { Env } from './types';
   import { createEnv } from './types';
   ```

## 工具和资源

### VS Code 配置

推荐的 `.vscode/settings.json` 配置：

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.wrangler": true
  }
}
```

### 推荐的 VS Code 扩展

- TypeScript and JavaScript Language Features
- ESLint
- Prettier - Code formatter
- Error Lens（实时显示错误）
- Pretty TypeScript Errors（更好的错误提示）

### 有用的 TypeScript 工具

- [ts-reset](https://github.com/total-typescript/ts-reset) - 改进内置类型
- [type-fest](https://github.com/sindresorhus/type-fest) - 常用类型工具
- [zod](https://github.com/colinhacks/zod) - 运行时类型验证
- [ts-pattern](https://github.com/gvergnaud/ts-pattern) - 模式匹配

### 参考资源

- [TypeScript 官方手册](https://www.typescriptlang.org/docs/handbook/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Cloudflare Workers TypeScript](https://developers.cloudflare.com/workers/languages/typescript/)
- [Drizzle ORM TypeScript](https://orm.drizzle.team/docs/typescript)
- [Matt Pocock's TypeScript Tips](https://www.totaltypescript.com/)

---

## 最佳实践总结

### 项目特有的模式

1. **使用 Drizzle ORM 的类型推断**
   ```typescript
   // 不要手动定义类型，使用 Drizzle 的类型推断
   export type UserConfig = typeof userConfigs.$inferSelect;
   export type NewUserConfig = typeof userConfigs.$inferInsert;
   ```

2. **环境变量类型安全访问**
   ```typescript
   // 在 types/index.ts 中定义完整的 Env 接口
   // 使用时直接通过 env.PROPERTY 访问
   const apiKey = env.API_SECRET_KEY;
   ```

3. **错误处理标准化**
   ```typescript
   // 使用项目定义的错误类
   throw new ValidationError('参数错误');
   throw new NotFoundError('资源不存在');
   ```

4. **API 响应标准化**
   ```typescript
   // 使用 ApiResponse 类型
   const response: ApiResponse<T> = {
     success: true,
     data: result,
   };
   ```

5. **日志记录规范**
   ```typescript
   // 使用 Logger 单例
   const logger = Logger.getInstance();
   logger.info('操作成功', { userId, action });
   logger.error('操作失败', error, { context });
   ```

---

**最后更新**: 2025-01-05
**版本**: 3.0 - 完全重写，与实际代码完全一致
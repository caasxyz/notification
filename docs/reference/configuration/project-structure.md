# 项目结构和配置文件详解

## 概述

本文档详细介绍通知系统的项目结构、配置文件和开发环境设置。通过理解项目的组织方式，开发者可以快速定位代码、配置和资源，提高开发效率。

## 项目目录结构

```
notification/
├── src/                          # 源代码目录
│   ├── index.ts                  # Worker 入口文件
│   ├── api/                      # API 相关代码
│   │   ├── router.ts            # 路由定义
│   │   └── handlers/            # API 处理器
│   │       ├── sendNotification.ts       # 发送通知
│   │       ├── templateManagementV2.ts   # V2 模板管理
│   │       ├── userConfig.ts             # 用户配置
│   │       ├── notificationLogs.ts       # 日志查询
│   │       └── testUIv2.ts              # 测试界面
│   ├── services/                 # 核心服务
│   │   ├── NotificationDispatcherV2.ts  # V2 通知调度器
│   │   ├── TemplateEngineV2.ts          # V2 模板引擎
│   │   ├── QueueProcessorV2.ts          # V2 队列处理器
│   │   ├── RetryScheduler.ts            # 重试调度器
│   │   ├── ConfigCache.ts               # 配置缓存服务
│   │   └── IdempotencyService.ts        # 幂等性服务
│   ├── adapters/                 # 通知渠道适配器
│   │   ├── BaseAdapter.ts       # 适配器基类
│   │   ├── WebhookAdapter.ts    # Webhook 适配器
│   │   ├── TelegramAdapter.ts   # Telegram 适配器
│   │   ├── LarkAdapter.ts       # 飞书适配器
│   │   ├── SlackAdapter.ts      # Slack 适配器
│   │   ├── EmailAdapter.ts      # 邮件适配器
│   │   └── SmsAdapter.ts        # 短信适配器
│   ├── db/                       # 数据库相关
│   │   ├── index.ts             # 数据库连接和导出
│   │   ├── schema.ts            # Drizzle ORM 模式定义
│   │   └── auto-migrate.ts      # 自动迁移功能
│   ├── utils/                    # 工具函数
│   │   ├── logger.ts            # 日志工具
│   │   ├── crypto.ts            # 加密工具
│   │   ├── validation.ts        # 验证工具
│   │   ├── security.ts          # 安全工具
│   │   └── response.ts          # 响应工具
│   ├── security/                 # 安全增强
│   │   └── SecurityEnhancements.ts  # 安全增强实现
│   └── types/                    # TypeScript 类型定义
│       └── index.ts             # 类型导出
├── scripts/                      # 脚本文件
│   ├── database/                # 数据库脚本
│   │   ├── init-db.ts          # 数据库初始化
│   │   ├── reset-db.ts         # 数据库重置
│   │   └── seed-data.ts        # 种子数据
│   ├── deployment/              # 部署脚本
│   │   ├── deploy-check.ts     # 部署前检查
│   │   └── verify-deploy.ts    # 部署验证
│   ├── setup/                   # 设置脚本
│   │   ├── init-kv.ts          # KV 命名空间初始化
│   │   └── init-queues.ts      # 队列初始化
│   ├── testing/                 # 测试脚本（子目录）
│   └── utilities/              # 工具脚本
│   
│   # 根目录脚本
│   ├── test-local.ts           # 本地测试脚本
│   ├── test-grafana-webhook.ts # Grafana 测试
│   ├── integration-test.ts     # 集成测试
│   ├── performance-test.ts     # 性能测试
│   └── seed-database.ts        # 数据库种子
├── sdk/                          # TypeScript SDK
│   ├── index.ts                 # SDK 入口
│   ├── client.ts               # 客户端实现
│   ├── types.ts                # SDK 类型定义
│   └── v2/                     # V2 SDK
│       └── index.ts            # V2 客户端
├── test/                         # 测试文件
│   ├── unit/                    # 单元测试
│   ├── integration/             # 集成测试
│   └── fixtures/                # 测试数据
├── sql/                          # SQL 文件
│   ├── schema.sql              # 数据库架构
│   └── indexes.sql             # 索引定义
├── drizzle/                      # Drizzle 迁移文件
│   └── migrations/              # 迁移历史
├── docs/                         # 项目文档
│   ├── 01-getting-started/      # 入门指南
│   ├── 02-guides/               # 使用指南
│   ├── 03-reference/            # 参考文档
│   ├── 04-security/             # 安全文档
│   └── 05-operations/           # 运维文档
├── .github/                      # GitHub 配置
│   └── workflows/               # GitHub Actions
│       └── deploy.yml          # 部署工作流
└── [配置文件]                    # 各种配置文件（见下文）
```

## 配置文件详解

### TypeScript 配置

#### tsconfig.json - 基础配置
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "types": ["@cloudflare/workers-types", "vitest/globals"]
  },
  "include": ["src/**/*", "scripts/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### tsconfig.prod.json - 生产构建配置
继承基础配置，添加更严格的检查：
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "test/**/*", "scripts/**/*"]
}
```

#### tsconfig.test.json - 测试配置
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals", "@cloudflare/workers-types"]
  },
  "include": ["src/**/*", "test/**/*"]
}
```

### Cloudflare Workers 配置

#### wrangler.toml.template - 配置模板
```toml
name = "notification-system"
main = "src/index.ts"
compatibility_date = "2024-01-01"
workers_dev = true

# 环境变量（生产环境通过 GitHub Secrets 注入）
[vars]
ENVIRONMENT = "production"
LOG_LEVEL = "info"
ENABLE_SECURITY_HEADERS = "true"
ENABLE_RATE_LIMITING = "true"
ENABLE_INPUT_VALIDATION = "true"
ENABLE_OUTPUT_ENCODING = "true"
ENABLE_AUDIT_LOGGING = "false"
ENABLE_THREAT_DETECTION = "false"
ENABLE_SSRF_PROTECTION = "false"

# KV 命名空间绑定
[[kv_namespaces]]
binding = "CONFIG_CACHE"
id = "{{KV_CONFIG_CACHE_ID}}"

# D1 数据库绑定
[[d1_databases]]
binding = "DB"
database_name = "notification-system"
database_id = "{{DB_ID}}"

# 队列绑定
[[queues.producers]]
binding = "RETRY_QUEUE"
queue = "notification-retry"

[[queues.consumers]]
queue = "notification-retry"
max_batch_size = 10
max_batch_timeout = 30

# 环境秘钥（通过 wrangler secret 设置）
# API_SECRET_KEY
# ENCRYPT_KEY
```

#### wrangler.toml.dev - 开发环境配置
```toml
name = "notification-system-dev"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "development"
LOG_LEVEL = "debug"

# 开发环境使用本地资源
[[kv_namespaces]]
binding = "CONFIG_CACHE"
id = "local-kv-namespace"
preview_id = "local-kv-namespace"

[[d1_databases]]
binding = "DB"
database_name = "notification-system-dev"
database_id = "local-db-id"
```

### 包管理配置

#### package.json - NPM 配置
```json
{
  "name": "notification-system",
  "version": "2.0.0",
  "description": "高性能多渠道通知系统",
  "main": "src/index.ts",
  "type": "module",
  "scripts": {
    // 开发脚本
    "dev": "wrangler dev --config wrangler.toml.dev",
    "dev:remote": "wrangler dev --remote",
    
    // 构建和部署
    "build": "tsc -p tsconfig.prod.json",
    "deploy": "wrangler deploy",
    "deploy:dev": "wrangler deploy --config wrangler.toml.dev",
    
    // 测试脚本
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:local": "tsx scripts/test-local.ts",
    "test:grafana": "tsx scripts/test-grafana-webhook.ts",
    "test:integration": "tsx scripts/integration-test.ts",
    "test:performance": "tsx scripts/performance-test.ts",
    
    // 数据库脚本
    "db:setup": "npm run db:execute -- --file=./scripts/database/init-db-v2.sql",
    "db:reset": "npm run db:drop && npm run db:create && npm run db:setup",
    "db:seed": "tsx scripts/seed-database.ts",
    "db:migrate": "drizzle-kit migrate",
    "db:generate": "drizzle-kit generate:sqlite",
    "db:studio": "drizzle-kit studio",
    "db:execute": "wrangler d1 execute notification-system",
    "db:create": "wrangler d1 create notification-system",
    "db:drop": "wrangler d1 execute notification-system --command='DROP TABLE IF EXISTS notification_templates_v2'",
    
    // 工具脚本
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write .",
    
    // 部署辅助
    "deploy:check": "tsx scripts/check-deployment.ts",
    "deploy:verify": "tsx scripts/verify-production-setup.sh"
  },
  "dependencies": {
    "@cloudflare/workers-types": "^4.20240117.0",
    "drizzle-orm": "^0.29.3",
    "itty-router": "^4.0.26"
  },
  "devDependencies": {
    "@types/node": "^20.11.16",
    "@typescript-eslint/eslint-plugin": "^6.21.0",
    "@typescript-eslint/parser": "^6.21.0",
    "@vitest/coverage-v8": "^1.2.2",
    "drizzle-kit": "^0.20.14",
    "eslint": "^8.56.0",
    "prettier": "^3.2.5",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.2",
    "wrangler": "^3.28.2"
  }
}
```

### 测试配置

#### vitest.config.ts - Vitest 配置
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      kvNamespaces: ['CONFIG_CACHE'],
      d1Databases: ['DB'],
      queues: ['RETRY_QUEUE'],
      bindings: {
        ENVIRONMENT: 'test',
        API_SECRET_KEY: 'test-secret',
        ENCRYPT_KEY: 'test-encrypt-key-32-chars-minimum'
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts'
      ]
    }
  }
});
```

### Drizzle ORM 配置

#### drizzle.config.ts
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  driver: 'd1',
  dbCredentials: {
    wranglerConfigPath: process.env.ENVIRONMENT === 'production' 
      ? 'wrangler.toml' 
      : 'wrangler.toml.dev',
    dbName: 'DB'
  },
  verbose: true,
  strict: true
} satisfies Config;
```

### 开发工具配置

#### .gitignore
```gitignore
# 依赖
node_modules/

# 构建输出
dist/
.wrangler/

# 环境变量
.dev.vars
.env
.env.local
.env.*.local

# 日志
*.log
npm-debug.log*

# 测试覆盖率
coverage/
.nyc_output/

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# 临时文件
*.tmp
*.temp
.cache/

# Wrangler
.wrangler/
wrangler.toml
!wrangler.toml.template
!wrangler.toml.dev
```

#### .eslintrc.json
```json
{
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "env": {
    "node": true,
    "es2022": true
  },
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { 
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }],
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

#### .prettierrc
```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

#### .editorconfig
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{json,yml,yaml}]
indent_size = 2

[Makefile]
indent_style = tab
```

#### .nvmrc
```
18.17.0
```

### 环境变量配置

#### .env.example
```bash
# API 配置
API_SECRET_KEY=your-32-char-secret-key-minimum

# Cloudflare 资源
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token

# 数据库
DB_NAME=notification-system
DB_ID=your-db-id

# KV 命名空间
KV_CONFIG_CACHE_ID=your-kv-id

# 队列
QUEUE_RETRY=notification-retry
QUEUE_FAILED=notification-failed

# 加密密钥（必须至少 32 字符）
ENCRYPT_KEY=your-encryption-key-32-chars-minimum

# 开发环境
ENVIRONMENT=development
LOG_LEVEL=debug

# 测试配置
TEST_USER_ID=test-user-123
TEST_WEBHOOK_URL=https://example.com/webhook
TEST_TELEGRAM_CHAT_ID=123456789
TEST_LARK_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx

# Grafana 集成
GRAFANA_WEBHOOK_USER=admin
GRAFANA_WEBHOOK_PASSWORD=your-password
```

#### .dev.vars（本地开发密钥）
```bash
# 此文件不应提交到版本控制
# 包含实际的开发环境密钥
API_SECRET_KEY=dev-secret-key-for-local-testing-32chars
ENCRYPT_KEY=dev-encrypt-key-for-local-testing-32chars
```

## 项目文档结构

### 文档组织原则
- **01-getting-started**: 快速入门和安装指南
- **02-guides**: 详细的使用指南和教程
- **03-reference**: API 和架构参考文档
- **04-security**: 安全相关文档
- **05-operations**: 运维和监控文档

### 重要文档
- **README.md**: 项目概述和快速开始
- **CLAUDE.md**: Claude Code 配置和项目规范
- **QUICKSTART.md**: 快速开始指南

## 配置管理最佳实践

### 1. 环境隔离
- 使用不同的配置文件区分环境
- 环境变量通过 `.dev.vars`（开发）和 GitHub Secrets（生产）管理
- 避免在代码中硬编码配置值

### 2. 密钥安全
- 所有密钥通过环境变量注入
- 使用 `wrangler secret` 管理生产密钥
- 定期轮换密钥
- 密钥长度要求：至少 32 字符

### 3. 配置版本控制
- 配置模板文件（`.template`）纳入版本控制
- 实际配置文件排除在 `.gitignore` 中
- 使用 `.env.example` 记录所需环境变量

### 4. TypeScript 配置
- 基础配置供所有环境使用
- 生产配置启用严格检查
- 测试配置包含测试相关类型

### 5. 依赖管理
- 生产依赖保持最小化
- 开发依赖包含所有工具
- 定期更新依赖版本
- 使用 `package-lock.json` 锁定版本

## 开发工作流配置

### 本地开发设置
1. 安装 Node.js 18.17.0（使用 `.nvmrc`）
2. 复制 `.env.example` 为 `.env`
3. 复制 `wrangler.toml.template` 为 `wrangler.toml.dev`
4. 创建 `.dev.vars` 文件并填入开发密钥
5. 运行 `npm install` 安装依赖
6. 运行 `npm run db:setup` 初始化数据库
7. 运行 `npm run dev` 启动开发服务器

### 生产部署配置
1. 在 GitHub 设置所需的 Secrets
2. 使用 GitHub Actions 自动部署
3. 配置通过环境变量注入
4. 密钥通过 `wrangler secret` 管理

## 常见配置问题

### 1. TypeScript 严格模式错误
**问题**: 生产构建时出现未使用变量错误
**解决**: 使用下划线前缀标记未使用参数：`_unusedParam`

### 2. Cloudflare Workers 限制
**问题**: 脚本大小超过 1MB
**解决**: 
- 检查并移除未使用的依赖
- 使用 Tree Shaking 优化
- 考虑代码分割

### 3. 环境变量未找到
**问题**: 运行时提示环境变量未定义
**解决**:
- 检查 `.dev.vars` 文件是否存在
- 确认 `wrangler.toml` 中的绑定配置
- 验证 GitHub Secrets 设置

### 4. 数据库连接问题
**问题**: D1 数据库连接失败
**解决**:
- 确认数据库 ID 正确
- 检查 `wrangler.toml` 中的数据库绑定
- 验证数据库已创建并初始化

## 性能优化配置

### 构建优化
- 使用 `tsconfig.prod.json` 进行生产构建
- 启用 Tree Shaking 减小包体积
- 移除开发时的调试代码

### 运行时优化
- KV 缓存 TTL 设置为 300 秒
- 队列批处理大小设置为 10
- 启用 Cloudflare 的自动压缩

### 监控配置
- 日志级别根据环境调整
- 生产环境关闭详细日志
- 启用性能指标收集

## 配置文件模板和示例

### 完整的 wrangler.toml 示例
```toml
name = "notification-system"
main = "src/index.ts"
compatibility_date = "2024-01-01"
workers_dev = false
route = "api.notification.example.com/*"

[vars]
ENVIRONMENT = "production"
LOG_LEVEL = "info"
ENABLE_SECURITY_HEADERS = "true"
ENABLE_RATE_LIMITING = "true"
ENABLE_INPUT_VALIDATION = "true"
ENABLE_OUTPUT_ENCODING = "true"
ENABLE_AUDIT_LOGGING = "false"
ENABLE_THREAT_DETECTION = "false"
ENABLE_SSRF_PROTECTION = "false"

# 性能配置
CACHE_TTL = "300"
MAX_BATCH_SIZE = "10"
MAX_RETRY_COUNT = "3"
RETRY_DELAY = "60000"

# KV 命名空间
[[kv_namespaces]]
binding = "CONFIG_CACHE"
id = "your-kv-namespace-id"

# D1 数据库
[[d1_databases]]
binding = "DB"
database_name = "notification-system"
database_id = "your-database-id"

# 生产者队列
[[queues.producers]]
binding = "RETRY_QUEUE"
queue = "notification-retry"

[[queues.producers]]
binding = "FAILED_QUEUE"
queue = "notification-failed"

# 消费者队列
[[queues.consumers]]
queue = "notification-retry"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3
dead_letter_queue = "notification-failed"

[[queues.consumers]]
queue = "notification-failed"
max_batch_size = 5
max_batch_timeout = 60

# 限制配置
[limits]
cpu_ms = 50

# 构建配置
[build]
command = "npm run build"
[build.upload]
format = "modules"
main = "./src/index.ts"

# 兼容性标志
[compatibility_flags]
formdata_parser_supports_files = true
```

### GitHub Actions 部署配置示例
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'production'
        type: choice
        options:
          - development
          - staging
          - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run typecheck
      
      - name: Run tests
        run: npm test
      
      - name: Build project
        run: npm run build
      
      - name: Create wrangler.toml
        run: |
          cp wrangler.toml.template wrangler.toml
          sed -i 's/{{DB_ID}}/${{ secrets.PROD_DB_ID }}/g' wrangler.toml
          sed -i 's/{{KV_CONFIG_CACHE_ID}}/${{ secrets.PROD_KV_ID }}/g' wrangler.toml
      
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
          secrets: |
            API_SECRET_KEY
            ENCRYPT_KEY
        env:
          API_SECRET_KEY: ${{ secrets.PROD_API_SECRET }}
          ENCRYPT_KEY: ${{ secrets.PROD_ENCRYPT_KEY }}
```

## 项目初始化脚本

### 快速初始化脚本
创建 `scripts/init-project.sh`:
```bash
#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 初始化通知系统项目${NC}"

# 检查 Node.js 版本
REQUIRED_NODE_VERSION="18.17.0"
NODE_VERSION=$(node -v | cut -d'v' -f2)

if [ "$NODE_VERSION" != "$REQUIRED_NODE_VERSION" ]; then
    echo -e "${YELLOW}⚠️  Node.js 版本不匹配。需要: $REQUIRED_NODE_VERSION, 当前: $NODE_VERSION${NC}"
    
    if command -v nvm &> /dev/null; then
        echo "使用 nvm 切换版本..."
        nvm use
    else
        echo -e "${RED}请安装 Node.js $REQUIRED_NODE_VERSION${NC}"
        exit 1
    fi
fi

# 安装依赖
echo -e "${GREEN}📦 安装依赖...${NC}"
npm ci

# 创建配置文件
if [ ! -f ".env" ]; then
    echo -e "${GREEN}📝 创建 .env 文件...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}请编辑 .env 文件并填入实际配置${NC}"
fi

if [ ! -f ".dev.vars" ]; then
    echo -e "${GREEN}📝 创建 .dev.vars 文件...${NC}"
    cat > .dev.vars << EOF
API_SECRET_KEY=dev-secret-key-for-local-testing-32chars
ENCRYPT_KEY=dev-encrypt-key-for-local-testing-32chars
EOF
fi

if [ ! -f "wrangler.toml" ]; then
    echo -e "${GREEN}📝 创建 wrangler.toml 文件...${NC}"
    cp wrangler.toml.dev wrangler.toml
fi

# 初始化数据库
echo -e "${GREEN}🗄️  初始化数据库...${NC}"
npm run db:setup

# 运行类型检查
echo -e "${GREEN}🔍 运行类型检查...${NC}"
npm run typecheck

# 完成
echo -e "${GREEN}✅ 项目初始化完成！${NC}"
echo -e "${GREEN}运行 'npm run dev' 启动开发服务器${NC}"
```

### 数据库迁移脚本模板
```typescript
// scripts/database/migrate.ts
import { drizzle } from 'drizzle-orm/d1';
import { migrate } from 'drizzle-orm/d1/migrator';
import * as schema from '../../src/db/schema';

interface Env {
  DB: D1Database;
}

export async function runMigrations(env: Env) {
  const db = drizzle(env.DB, { schema });
  
  console.log('🔄 开始数据库迁移...');
  
  try {
    await migrate(db, {
      migrationsFolder: './drizzle/migrations',
    });
    
    console.log('✅ 数据库迁移完成');
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  // 本地开发环境迁移逻辑
  console.log('执行本地数据库迁移...');
}
```

### 实际使用的数据库初始化脚本
项目中实际使用的是 `scripts/database/init-db-v2.sql`：
```sql
-- 创建 V2 模板表
CREATE TABLE IF NOT EXISTS notification_templates_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  variables TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建模板内容表
CREATE TABLE IF NOT EXISTS template_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  subject_template TEXT,
  content_template TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_key) REFERENCES notification_templates_v2(template_key) ON DELETE CASCADE,
  UNIQUE(template_key, channel_type)
);

-- 创建用户配置表
CREATE TABLE IF NOT EXISTS user_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('webhook', 'telegram', 'lark', 'slack', 'email', 'sms')),
  config_data TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, channel_type)
);

-- 创建通知日志表
CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  template_key TEXT,
  channel_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  content TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TEXT,
  idempotency_key TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT
);

-- 创建索引
CREATE INDEX idx_notifications_user_status ON notification_logs(user_id, status, created_at DESC);
CREATE INDEX idx_notifications_pending ON notification_logs(status, retry_count, next_retry_at) 
  WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_user_configs_active ON user_configs(user_id, channel_type, is_active) 
  WHERE is_active = 1;
CREATE INDEX idx_templates_active ON notification_templates_v2(template_key, is_active) 
  WHERE is_active = 1;
CREATE UNIQUE INDEX idx_idempotency ON notification_logs(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;
```

## 持续集成配置

### pre-commit 钩子配置
创建 `.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# 运行类型检查
npm run typecheck

# 运行 lint
npm run lint

# 运行测试
npm test
```

### commitlint 配置
创建 `commitlint.config.js`:
```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修复
        'docs',     // 文档
        'style',    // 格式
        'refactor', // 重构
        'perf',     // 性能
        'test',     // 测试
        'chore',    // 构建
        'revert',   // 回滚
        'ci'        // CI
      ]
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case']],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72]
  }
};
```

## 开发环境配置详解

### VS Code 推荐配置
创建 `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/.git": true,
    "**/.DS_Store": true,
    "**/node_modules": true,
    "**/.wrangler": true,
    "**/dist": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.wrangler": true,
    "**/coverage": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### VS Code 推荐扩展
创建 `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "streetsidesoftware.code-spell-checker",
    "EditorConfig.EditorConfig",
    "redhat.vscode-yaml",
    "eamodio.gitlens",
    "GitHub.copilot",
    "vitest.explorer"
  ]
}
```

### 调试配置
创建 `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Wrangler Dev",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "name": "Run Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Script",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/scripts/${input:scriptName}",
      "runtimeArgs": ["--loader", "tsx"],
      "console": "integratedTerminal"
    }
  ],
  "inputs": [
    {
      "id": "scriptName",
      "type": "promptString",
      "description": "输入脚本名称 (例如: test-local.ts)"
    }
  ]
}
```

## 重要配置注意事项

### Cloudflare D1 数据库特性
1. **所有字符串字段使用 TEXT 类型**：不使用 VARCHAR
2. **布尔值使用 INTEGER**：0 = false，1 = true
3. **时间戳使用 TEXT**：存储 ISO 8601 格式
4. **不支持 ENUM**：使用 CHECK 约束代替

### Cloudflare Workers 限制
1. **CPU 时间**: 10ms（免费）/ 50ms（付费）
2. **内存**: 128MB
3. **脚本大小**: 1MB（压缩后）
4. **子请求**: 50（免费）/ 1000（付费）
5. **KV 操作**: 每请求 1000 次读写

### API 认证特点
1. **使用毫秒级时间戳**：`Date.now().toString()`
2. **HMAC-SHA256 签名**：时间戳 + 请求体
3. **时间窗口**：默认 5 分钟
4. **幂等性关键字**：24 小时过期

### 缓存配置
1. **KV 命名空间**: CONFIG_CACHE
2. **默认 TTL**: 300 秒（5 分钟）
3. **模板缓存**: 3600 秒（1 小时）
4. **缓存键格式**: `{resource}:{id}:{sub_type}`

## 总结

项目的配置体系设计考虑了：
1. **开发效率**: 清晰的项目结构和脚本组织
2. **环境隔离**: 开发、测试、生产环境完全分离
3. **安全性**: 密钥和敏感信息妥善管理
4. **可维护性**: 配置模板化，易于复制和修改
5. **性能优化**: 针对 Cloudflare Workers 特性优化
6. **自动化**: CI/CD 和代码质量检查自动化
7. **标准化**: 统一的代码风格和提交规范

通过遵循这些配置规范，团队可以高效地开发、测试和部署通知系统。配置文件的模板化设计使得新环境的搭建变得简单快速，同时保证了配置的一致性和安全性。

---

**最后更新**: 2025-01-06  
**版本**: 2.0  
**状态**: 第三次迭代完成
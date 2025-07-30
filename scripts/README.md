# 📜 Scripts 目录说明

本目录包含了 Notification System 的各种自动化脚本，按功能分类组织。

## 📂 目录结构

### 🚀 setup/ - 初始化和设置脚本
用于系统初始化、环境设置和快速启动。

- **cloudflare-init.sh** - Cloudflare 资源初始化
- **quick-init.sh** - 快速初始化脚本
- **quick-start.sh** - 完整的快速启动流程
- **quick-start-simple.sh** - 简化版快速启动
- **setup-test-user.sh** - 创建测试用户
- **init-templates-v2.ts** - 初始化 V2 模板数据

### 🗄️ database/ - 数据库管理脚本
数据库初始化、迁移、维护相关脚本。

- **check-db-init.sh** - 检查数据库初始化状态
- **db-status.sh** - 查看数据库状态
- **drizzle-migrate-production.sh** - 生产环境 Drizzle 迁移
- **drizzle-reset-database.sh** - 重置 Drizzle 数据库
- **init-db-v2.sql** - V2 数据库初始化 SQL
- **init-production-database.sh** - 生产数据库初始化
- **init-production-templates.sql** - 生产环境模板数据
- **reset-database.sh** - 重置数据库
- **seed-database.ts** - 填充测试数据
- **smart-db-setup.sh** - 智能数据库设置
- **fix-template-contents.sql** - 修复模板内容
- **apply-performance-indexes.sh** - 应用性能索引

### 🚢 deployment/ - 部署相关脚本
部署、验证和清理相关脚本。

- **deploy-helper.ts** - 部署辅助工具
- **check-github-actions.ts** - 检查 GitHub Actions 配置
- **verify-production-setup.sh** - 验证生产环境设置
- **clean-sensitive-files.sh** - 清理敏感文件

### 🧪 testing/ - 测试脚本
各种测试和验证脚本。

- **integration-test.ts** - 集成测试套件
- **performance-test.ts** - 性能测试
- **test-grafana-webhook.ts** - Grafana Webhook 测试
- **test-local.ts** - 本地 API 测试

### 🛠️ utilities/ - 工具脚本
通用工具和辅助脚本（预留目录）。

## 🎯 使用指南

### 快速开始
```bash
# 1. 初始化 Cloudflare 资源
./setup/cloudflare-init.sh

# 2. 设置数据库
./database/smart-db-setup.sh

# 3. 运行快速启动
./setup/quick-start.sh
```

### 数据库操作
```bash
# 检查数据库状态
./database/db-status.sh

# 重置数据库
./database/reset-database.sh

# 应用生产迁移
./database/drizzle-migrate-production.sh
```

### 测试
```bash
# 运行本地测试
npm run test:local

# 运行集成测试
npm run test:integration

# 性能测试
npm run test:performance
```

### 部署
```bash
# 验证部署配置
./deployment/check-github-actions.ts

# 清理敏感文件
./deployment/clean-sensitive-files.sh
```

## Table of Contents

1. [Development Scripts](#development-scripts)
2. [Database Scripts](#database-scripts)  
3. [Testing Scripts](#testing-scripts)
4. [Deployment Scripts](#deployment-scripts)
5. [Utility Scripts](#utility-scripts)

## Development Scripts

### `test-local.ts`

Interactive local testing tool for the notification system.

**Usage:**
```bash
# Interactive mode
npm run test:local -- interactive

# Test specific endpoint
npm run test:local -- send --user test-user --template welcome

# Run all tests
npm run test:local -- all

# Show help
npm run test:local -- --help
```

**Features:**
- Interactive CLI interface
- Individual endpoint testing
- Batch testing mode
- Real-time result visualization
- Test data setup instructions

### `quick-start.sh`

Quick setup script for new developers.

**Usage:**
```bash
./scripts/quick-start.sh
```

**Actions:**
- Installs dependencies
- Sets up local database
- Seeds test data
- Starts development server

## Database Scripts

### `seed-database.ts`

Seeds the database with test data using different profiles.

**Usage:**
```bash
# Use default (standard) profile
npm run db:seed

# Use minimal profile
npm run db:seed -- --profile minimal

# Use comprehensive profile
npm run db:seed -- --profile comprehensive

# Use custom seed file
npm run db:seed -- --file custom-seed.json

# Preview without inserting
npm run db:seed -- --dry-run
```

**Profiles:**
- **minimal**: Basic setup (2 users, 3 templates)
- **standard**: Typical dev setup (5 users, 8 templates, 20 notifications)
- **comprehensive**: Full test data (10 users, 15 templates, 100 notifications)

### `smart-db-setup.sh`

Intelligent database setup that detects existing data.

**Usage:**
```bash
npm run db:setup
```

**Features:**
- Checks for existing database
- Prompts before destructive actions
- Applies migrations automatically
- Seeds initial data

### `drizzle-reset-database.sh`

Completely resets the database.

**Usage:**
```bash
npm run db:reset
```

**Warning:** This will delete all data!

### `init-db-v2.sql`

SQL script for initializing V2 database schema.

**Usage:**
```bash
wrangler d1 execute notification-system --file scripts/init-db-v2.sql
```

## Testing Scripts

### `integration-test.ts`

Runs comprehensive integration tests against deployed environments.

**Usage:**
```bash
# Test production environment
API_SECRET_KEY=your-production-api-key npm run test:integration

# Test local environment
BASE_URL=http://localhost:8788 API_SECRET_KEY=test-key npm run test:integration
```

**Features:**
- Tests all API endpoints
- Creates real notifications
- Verifies Lark integration
- Automatic cleanup
- Detailed test reports

**Test Flow:**
1. GET endpoint tests (health, metrics, etc.)
2. Create Lark user configuration
3. Create test template
4. Send notifications (custom & template)
5. Query notification logs
6. Clean up test data

### `check-actual-time.ts`

Utility to verify time synchronization for HMAC signatures.

**Usage:**
```bash
tsx scripts/check-actual-time.ts
```

## Deployment Scripts

### `deploy-helper.ts`

Pre-deployment checks and post-deployment verification.

**Usage:**
```bash
# Basic pre-flight check
npm run deploy:check

# Full check including tests
npm run deploy:check -- --full

# Check specific environment
npm run deploy:check -- --env production

# Verify deployment
npm run deploy:verify production
```

**Checks:**
- Git status and branch
- Dependencies
- TypeScript compilation
- Test results
- Build size
- Database migrations
- Secret configuration

### `cloudflare-init.sh`

Initializes Cloudflare resources for a new project.

**Usage:**
```bash
./scripts/cloudflare-init.sh
```

**Creates:**
- D1 database
- KV namespace
- Queue bindings
- Initial secrets

### `verify-production-setup.sh`

Verifies production environment configuration.

**Usage:**
```bash
./scripts/verify-production-setup.sh
```

## Utility Scripts

### `clean-sensitive-files.sh`

Removes sensitive files before sharing code.

**Usage:**
```bash
./scripts/clean-sensitive-files.sh
```

**Removes:**
- `.env` files
- `wrangler.toml`
- Log files
- Temporary files

### `db-status.sh`

Shows current database status and statistics.

**Usage:**
```bash
./scripts/db-status.sh
```

**Shows:**
- Table counts
- Recent notifications
- Active templates
- System configuration

## Best Practices

### Script Development

1. **Use TypeScript**: Write scripts in TypeScript for type safety
2. **Add Help Text**: Include `--help` option with clear documentation
3. **Error Handling**: Provide clear error messages and recovery suggestions
4. **Dry Run Mode**: Add `--dry-run` option for destructive operations
5. **Progress Indicators**: Use ora spinners for long operations
6. **Color Output**: Use chalk for better readability

### Script Organization

```typescript
// Standard script structure
#!/usr/bin/env tsx

import { program } from 'commander';
import chalk from 'chalk';

// Configuration
const config = {
  // ...
};

// Main logic
async function main() {
  // ...
}

// CLI setup
program
  .name('script-name')
  .description('Script description')
  .version('1.0.0')
  .option('-o, --option <value>', 'Option description')
  .action(async (options) => {
    // Handle command
  });

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse();
```

## Adding New Scripts

1. Create script in `scripts/` directory
2. Make it executable: `chmod +x scripts/new-script.sh`
3. Add npm script in `package.json` if needed
4. Document in this README
5. Add TypeScript types if applicable

## Environment Variables

Scripts may use these environment variables:

- `BASE_URL`: API base URL (default: http://localhost:8788)
- `API_SECRET`: API secret key for authentication
- `NODE_ENV`: Environment (development/staging/production)
- `LOG_LEVEL`: Logging verbosity (debug/info/warn/error)

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   chmod +x scripts/*.sh
   ```

2. **Command Not Found**
   ```bash
   npm install -g tsx
   ```

3. **Database Connection Failed**
   ```bash
   wrangler d1 list
   wrangler d1 info notification-system
   ```

4. **TypeScript Errors**
   ```bash
   npm run typecheck
   ```

## Contributing

When adding new scripts:

1. Follow existing patterns
2. Add comprehensive error handling
3. Include help documentation
4. Test on all platforms (macOS, Linux, Windows with WSL)
5. Update this README
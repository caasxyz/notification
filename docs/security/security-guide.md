# 安全实施指南

本指南详细介绍通知系统的安全机制和最佳实践，帮助您构建和维护一个安全可靠的通知服务。

## 目录

- [概述](#概述)
- [认证机制](#认证机制)
- [速率限制](#速率限制)
- [输入验证](#输入验证)
- [加密与数据保护](#加密与数据保护)
- [SSRF 防护](#ssrf-防护)
- [安全头部](#安全头部)
- [审计日志](#审计日志)
- [实施步骤](#实施步骤)
- [监控与告警](#监控与告警)
- [应急响应](#应急响应)

## 概述

通知系统采用多层安全架构，确保数据传输和存储的安全性。主要安全特性包括：

- **HMAC-SHA256 签名认证**：所有 API 请求必须经过签名验证
- **速率限制**：防止 API 滥用和 DDoS 攻击
- **输入验证**：严格的参数验证和清理
- **数据加密**：敏感配置信息加密存储
- **SSRF 防护**：阻止内部网络访问
- **审计日志**：完整的安全事件记录

## 认证机制

### HMAC-SHA256 签名认证

所有需要认证的 API 端点都使用 HMAC-SHA256 签名验证。

### 受保护的端点

以下路径需要签名认证：

```typescript
const PROTECTED_PATHS = [
  '/api/send-notification',     // 发送通知
  '/api/user-configs',          // 用户配置管理
  '/api/templates',             // 模板管理
  '/api/notification-logs',     // 日志查询
  '/api/db/schema',            // 数据库架构
  '/api/db/migrate',           // 数据库迁移
  '/api/notifications/send',    // 发送通知（兼容）
  '/api/notifications/retry',   // 重试通知
  '/api/notification-logs/cleanup', // 清理日志
  '/metrics',                   // 系统指标
];
```

### 公开端点

以下端点无需签名：
- `/health` - 健康检查
- `/test-ui` - 测试界面（仅开发环境）
- `/api/webhooks/grafana` - Grafana webhook（使用 Basic Auth）

### 签名算法实现

```javascript
// 签名生成算法
function generateSignature(payload, apiKey) {
  return crypto
    .createHmac('sha256', apiKey)
    .update(payload)
    .digest('hex');
}

// POST/PUT 请求
const timestamp = Date.now().toString(); // 毫秒级时间戳
const payload = timestamp + requestBody;
const signature = generateSignature(payload, API_SECRET_KEY);

// GET/DELETE 请求
const url = new URL(request.url);
const pathAndQuery = url.pathname + url.search;
const payload = timestamp + pathAndQuery;
const signature = generateSignature(payload, API_SECRET_KEY);
```

### 请求头要求

```http
X-Timestamp: <毫秒级时间戳>
X-Signature: <HMAC-SHA256签名>
```

### 时间戳验证

- 时间戳为**毫秒级**精度（13 位数字）
- 时间戳必须在服务器时间 5 分钟内
- 防止重放攻击
- 确保系统时钟同步

**注意事项**：
1. API 文档可能标注为秒级时间戳，但实际实现使用毫秒级
2. 生成签名时确保使用正确的时间戳精度

## 速率限制

### 实现状态

⚠️ **注意**：当前系统尚未实现速率限制功能。以下为建议的实现方案。

### 建议的速率限制配置

```typescript
// 建议配置
const RATE_LIMIT_WINDOW_MS = 60000; // 1分钟
const RATE_LIMIT_MAX_REQUESTS = 100; // 每分钟100次

// IP 基础的速率限制
async function checkRateLimit(ip: string, env: Env): Promise<boolean> {
  const key = `rate_limit:${ip}:${getCurrentWindow()}`;
  const count = await env.CONFIG_CACHE.get(key);
  
  if (parseInt(count || '0') >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // 超过限制
  }
  
  await env.CONFIG_CACHE.put(key, String(parseInt(count || '0') + 1), {
    expirationTtl: RATE_LIMIT_WINDOW_MS / 1000
  });
  
  return true;
}
```

### 端点特定限制

| 端点 | 限制 | 窗口 |
|------|------|------|
| `/api/send-notification` | 50次 | 1分钟 |
| `/api/templates/*` | 30次 | 1分钟 |
| `/api/logs` | 20次 | 1分钟 |
| 认证失败 | 5次 | 15分钟 |

### 实现示例

```typescript
// 在 API 路由中应用速率限制
export async function handleApiRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  
  // 检查全局速率限制
  if (!await checkRateLimit(ip, env)) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Rate limit exceeded. Please try again later.'
    }), {
      status: 429,
      headers: {
        'Retry-After': '60',
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() + RATE_LIMIT_WINDOW_MS)
      }
    });
  }
  
  // 继续处理请求...
}
```

## 输入验证

### 验证工具类

系统实现了全面的输入验证和安全检查：

```typescript
// src/utils/validation.ts
export class ValidationUtils {
  // 验证用户 ID
  static validateUserId(userId: unknown): string {
    if (typeof userId !== 'string' || !userId.trim()) {
      throw new Error('Invalid user_id');
    }
    
    if (userId.length > 100) {
      throw new Error('user_id too long');
    }
    
    // 只允许字母、数字、下划线、连字符
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      throw new Error('Invalid user_id format');
    }
    
    return userId;
  }
  
  // 验证模板键
  static validateTemplateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Template key is required');
    }
    if (key.length > 100) {
      throw new Error('Template key must not exceed 100 characters');
    }
    // 允许字母、数字、连字符、下划线、点号
    if (!/^[a-zA-Z0-9_.-]+$/.test(key)) {
      throw new Error('Invalid template key format');
    }
  }
  
  // 验证渠道类型
  static validateChannel(channel: string): void {
    const validChannels = ['webhook', 'telegram', 'lark', 'slack'];
    if (!validChannels.includes(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }
  }
  
  // 验证 URL
  static validateUrl(url: string): void {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid URL protocol');
      }
    } catch {
      throw new Error('Invalid URL format');
    }
  }
}
```

### 参数清理

```typescript
// src/utils/security.ts
export class SecurityUtils {
  // 清理字符串，防止 XSS
  static sanitizeString(input: string, options?: {
    maxLength?: number;
    trim?: boolean;
    removeControlChars?: boolean;
  }): string {
    const { maxLength = 1000, allowHtml = false } = options || {};
    
    // 限制长度
    let sanitized = input.substring(0, maxLength);
    
    if (!allowHtml) {
      // 转义 HTML 特殊字符
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    
    // 移除控制字符
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    return sanitized;
  }
  
  // 清理模板变量值
  static sanitizeTemplateValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    // 转换为字符串
    let strValue = String(value);

    // 移除控制字符并清理
    strValue = this.sanitizeString(strValue, {
      maxLength: 5000,
      trim: true,
      removeControlChars: true,
    });

    // 转义 HTML 实体防止 XSS
    strValue = this.escapeHtml(strValue);

    return strValue;
  }
}
```

## 加密与数据保护

### 用户配置加密

敏感的用户配置（如 API 密钥、Webhook URL）使用 AES-256-GCM 加密存储。

**加密实现特点**：
- 使用 Web Crypto API
- 12 字节随机 IV
- 密钥填充到 32 字符
- Base64 编码存储

```typescript
// src/utils/crypto.ts
export class CryptoUtils {
  static async encrypt(data: string, key: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // 生成随机 IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // 导入密钥
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    // 加密数据
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encoder.encode(data)
    );
    
    // 组合 IV 和加密数据
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Base64 编码
    return btoa(String.fromCharCode(...combined));
  }
  
  static async decrypt(encryptedData: string, key: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Base64 解码
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // 提取 IV 和加密数据
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // 导入密钥
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    // 解密数据
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    );
    
    return decoder.decode(decrypted);
  }
}
```

### 密钥管理最佳实践

1. **密钥长度要求**
   - API_SECRET_KEY：建议至少 32 字符
   - ENCRYPT_KEY：必须为 32 字符（AES-256 要求）
   
2. **密钥生成**
   ```bash
   # 生成安全的随机密钥
   openssl rand -hex 32
   ```

3. **密钥存储**
   ```bash
   # 使用 Cloudflare secrets
   wrangler secret put API_SECRET_KEY
   wrangler secret put ENCRYPT_KEY
   ```

4. **密钥轮换**
   - 每 90 天轮换一次
   - 保留旧密钥用于解密历史数据
   - 逐步迁移加密数据

## SSRF 防护

⚠️ **实施状态**：SSRF 防护代码已准备但尚未在适配器中实施。

### URL 验证

```typescript
// src/utils/ssrf.ts
export class SSRFProtection {
  // 内部 IP 范围
  private static INTERNAL_IP_RANGES = [
    // IPv4 私有地址
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    
    // IPv6 本地地址
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
  ];
  
  static async isInternalUrl(url: string): Promise<boolean> {
    try {
      const parsed = new URL(url);
      
      // 检查协议
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return true; // 阻止其他协议
      }
      
      // 检查本地主机名
      if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
        return true;
      }
      
      // 解析 IP 地址
      const ip = await this.resolveIp(parsed.hostname);
      
      // 检查内部 IP
      return this.INTERNAL_IP_RANGES.some(range => range.test(ip));
    } catch {
      return true; // 解析失败时拒绝
    }
  }
  
  private static async resolveIp(hostname: string): Promise<string> {
    // 在 Workers 环境中，使用 fetch 的 DNS 解析
    // 实际实现需要外部 DNS 服务
    return hostname;
  }
}
```

### 应用 SSRF 防护

```typescript
// 在 Webhook 适配器中
async send(config: NotificationConfig, content: string): Promise<unknown> {
  // SSRF 检查
  if (await SSRFProtection.isInternalUrl(config.webhook_url)) {
    throw new Error('Invalid webhook URL: Internal URLs are not allowed');
  }
  
  // 添加超时保护
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30秒超时
  
  try {
    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal: controller.signal,
    });
    
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`);
    }
    
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
```

## 安全头部

⚠️ **实施状态**：安全头部尚未在响应中添加。建议实施以下配置：

### 推荐的安全头部

```typescript
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

// 应用安全头部
export function addSecurityHeaders(response: Response): Response {
  const newResponse = new Response(response.body, response);
  
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });
  
  return newResponse;
}
```

### CORS 配置

当前系统使用宽松的 CORS 策略：

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Signature, X-Timestamp',
  'Access-Control-Max-Age': '86400', // 24 hours
};
```

**安全建议**：
1. 生产环境应限制允许的来源
2. 使用环境变量配置允许的域名
3. 对敏感端点实施更严格的 CORS 策略
```

## 审计日志

⚠️ **实施状态**：审计日志系统尚未实施。当前仅有通知日志（notification_logs）。

### 建议的日志记录方案

```typescript
interface SecurityEvent {
  timestamp: string;
  event_type: 'auth_failure' | 'rate_limit' | 'invalid_input' | 'ssrf_blocked' | 'suspicious_activity';
  user_id?: string;
  ip_address: string;
  user_agent?: string;
  url: string;
  method: string;
  details?: Record<string, unknown>;
}

export class SecurityAuditLogger {
  static async log(event: SecurityEvent, env: Env): Promise<void> {
    try {
      await env.DB.prepare(`
        INSERT INTO security_audit_logs 
        (timestamp, event_type, user_id, ip_address, user_agent, url, method, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        event.timestamp,
        event.event_type,
        event.user_id || null,
        event.ip_address,
        event.user_agent || null,
        event.url,
        event.method,
        JSON.stringify(event.details || {})
      ).run();
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}
```

### 需要记录的事件

1. **认证失败**
   - 无效签名
   - 过期时间戳（超过 5 分钟）
   - 缺少认证头（X-Timestamp, X-Signature）

2. **输入验证失败**
   - 无效参数
   - 内容威胁检测（detectThreats）
   - 超长输入
   - 控制字符

3. **SSRF 尝试**（当实施后）
   - 内部网络 URL
   - 本地地址访问
   - 非 HTTP/HTTPS 协议

4. **加密解密失败**
   - 配置解密失败
   - 密钥错误

## 实施步骤

### 1. 检查当前安全状态

```bash
# 检查受保护的端点
# 测试无签名访问
curl -X POST http://localhost:8788/api/send-notification \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test","channels":["webhook"]}'
# 应返回 401 错误

# 检查 CORS 头部
curl -I http://localhost:8788/health
# 查看 Access-Control-Allow-Origin 头部
```

### 2. 创建安全相关的数据库表

```sql
-- 安全审计日志表
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  event_type TEXT NOT NULL,
  user_id TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  url TEXT NOT NULL,
  method TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化查询性能
CREATE INDEX idx_audit_logs_timestamp ON security_audit_logs(timestamp);
CREATE INDEX idx_audit_logs_event_type ON security_audit_logs(event_type);
CREATE INDEX idx_audit_logs_user_id ON security_audit_logs(user_id);
CREATE INDEX idx_audit_logs_ip ON security_audit_logs(ip_address);
```

### 2. 配置环境变量

```toml
# wrangler.toml
[vars]
ENVIRONMENT = "production"
ALLOWED_ORIGINS = "https://app.yourdomain.com"
MAX_REQUEST_SIZE = "1048576"  # 1MB
RATE_LIMIT_WINDOW_MS = "60000"
RATE_LIMIT_MAX_REQUESTS = "100"

# 敏感配置通过 secrets 设置
# wrangler secret put API_SECRET_KEY
# wrangler secret put ENCRYPT_KEY
```

### 3. 更新 GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          environment: production
          secrets: |
            API_SECRET_KEY
            ENCRYPT_KEY
        env:
          API_SECRET_KEY: ${{ secrets.PROD_API_SECRET_KEY }}
          ENCRYPT_KEY: ${{ secrets.PROD_ENCRYPT_KEY }}
```

## 监控与告警

### 关键指标

```typescript
export async function getSecurityMetrics(env: Env): Promise<SecurityMetrics> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // 认证失败次数
  const authFailures = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM security_audit_logs
    WHERE event_type = 'auth_failure'
    AND timestamp > ?
  `).bind(oneDayAgo.toISOString()).first();
  
  // 速率限制触发次数
  const rateLimitHits = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM security_audit_logs
    WHERE event_type = 'rate_limit'
    AND timestamp > ?
  `).bind(oneDayAgo.toISOString()).first();
  
  // 可疑活动
  const suspiciousActivities = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM security_audit_logs
    WHERE event_type IN ('ssrf_blocked', 'suspicious_activity')
    AND timestamp > ?
  `).bind(oneDayAgo.toISOString()).first();
  
  return {
    authFailures: authFailures?.count || 0,
    rateLimitHits: rateLimitHits?.count || 0,
    suspiciousActivities: suspiciousActivities?.count || 0,
    timestamp: now.toISOString(),
  };
}
```

### 告警规则

| 指标 | 阈值 | 动作 |
|------|------|------|
| 认证失败率 | > 10次/分钟 | 发送告警，检查是否被攻击 |
| 速率限制触发 | > 100次/小时 | 检查是否需要调整限制 |
| SSRF 尝试 | > 5次/小时 | 立即调查，可能是攻击 |
| 错误率 | > 5% | 检查系统健康状态 |

### Grafana 集成

```json
{
  "dashboard": {
    "title": "通知系统安全监控",
    "panels": [
      {
        "title": "认证失败趋势",
        "targets": [{
          "expr": "rate(auth_failures_total[5m])"
        }]
      },
      {
        "title": "速率限制触发",
        "targets": [{
          "expr": "rate(rate_limit_hits_total[5m])"
        }]
      },
      {
        "title": "API 响应时间",
        "targets": [{
          "expr": "histogram_quantile(0.95, api_request_duration_seconds)"
        }]
      }
    ]
  }
}
```

## 应急响应

### 安全事件处理流程

1. **检测与识别**
   ```bash
   # 查看最近的安全事件
   wrangler d1 execute notification-system \
     --command="SELECT * FROM security_audit_logs ORDER BY timestamp DESC LIMIT 100"
   ```

2. **隔离与控制**
   ```typescript
   // 临时封禁 IP
   async function blockIP(ip: string, env: Env): Promise<void> {
     await env.CONFIG_CACHE.put(
       `blocked:${ip}`,
       'true',
       { expirationTtl: 3600 } // 1小时
     );
   }
   ```

3. **调查与分析**
   - 分析审计日志
   - 检查异常模式
   - 确定影响范围

4. **恢复与总结**
   - 修复漏洞
   - 更新安全策略
   - 记录事件报告

### 紧急联系方式

- 安全团队: security@yourdomain.com
- 运维值班: +86-xxx-xxxx-xxxx
- Cloudflare 支持: https://support.cloudflare.com

## 安全测试指南

### 1. 测试签名认证

```bash
# 使用测试脚本验证签名功能
npm run test:local

# 手动测试无效签名
curl -X POST http://localhost:8788/api/send-notification \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $(date +%s)000" \
  -H "X-Signature: invalid-signature" \
  -d '{"user_id":"test","channels":["webhook"]}'
# 预期：401 错误

# 测试过期时间戳（使用6分钟前的时间戳）
TIMESTAMP=$(($(date +%s)000 - 360000))
# 需要根据过期时间戳重新计算签名
```

### 2. 测试输入验证和威胁检测

```javascript
// test-security.js
const testPayloads = [
  // XSS 测试
  {
    custom_content: {
      content: "<script>alert('XSS')</script>",
      subject: "<img src=x onerror=alert(1)>"
    }
  },
  // 空字节注入
  {
    custom_content: {
      content: "normal\x00malicious"
    }
  },
  // 过多控制字符
  {
    custom_content: {
      content: "\x01".repeat(100) + "text"
    }
  }
];

// 运行测试并检查响应
testPayloads.forEach(async (payload) => {
  try {
    const response = await sendNotification(payload);
    console.log('响应:', response);
  } catch (error) {
    console.log('正确拒绝威胁:', error.message);
  }
});
```

### 3. 测试加密功能

```bash
# 创建测试用户配置
curl -X POST http://localhost:8788/api/user-configs \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: <timestamp>" \
  -H "X-Signature: <signature>" \
  -d '{
    "user_id": "test-user",
    "channel": "webhook",
    "config": {
      "webhook_url": "https://example.com/webhook",
      "secret_key": "sensitive-data"
    }
  }'

# 验证数据已加密存储
wrangler d1 execute notification-system \
  --command="SELECT config FROM user_configs WHERE user_id='test-user'"
# 应该看到 Base64 编码的加密数据
```

### 4. 安全配置验证脚本

```typescript
// verify-security.ts
import { Env } from './types';

async function verifySecurityConfig(env: Env) {
  const checks = {
    apiKeyLength: env.API_SECRET_KEY?.length >= 32,
    encryptKeyLength: env.ENCRYPT_KEY?.length === 32,
    protectedPaths: [
      '/api/send-notification',
      '/api/user-configs',
      '/api/templates'
    ],
    corsHeaders: true,
    signatureValidation: true
  };
  
  console.log('安全配置检查结果:');
  Object.entries(checks).forEach(([key, value]) => {
    console.log(`${key}: ${value ? '✅' : '❌'}`);
  });
  
  // 测试实际认证
  try {
    const response = await fetch('http://localhost:8788/api/send-notification');
    if (response.status === 401) {
      console.log('认证保护: ✅');
    } else {
      console.log('认证保护: ❌ (应返回 401)');
    }
  } catch (error) {
    console.log('测试失败:', error);
  }
}
```

## 安全检查清单

### 部署前检查

- [ ] API 密钥已设置且足够复杂（至少 32 字符）
- [ ] 加密密钥为 32 字符随机字符串
- [ ] 所有受保护端点的签名验证已启用
- [ ] 输入验证和威胁检测已激活
- [ ] 用户配置加密功能正常工作
- [ ] ~~速率限制已启用~~（待实施）
- [ ] ~~SSRF 防护已实施~~（代码已准备，待集成）
- [ ] ~~安全头部已配置~~（待实施）
- [ ] ~~审计日志表已创建~~（待实施）
- [ ] 监控告警已设置

### 定期检查（每月）

- [ ] ~~审查安全审计日志~~（待审计日志实施后）
- [ ] 更新依赖包
- [ ] 检查异常流量模式（通过 notification_logs）
- [ ] 验证备份恢复流程
- [ ] 更新安全文档
- [ ] 验证签名认证功能
- [ ] 测试加密解密功能
- [ ] 检查受保护端点访问控制

### 年度安全审计

- [ ] 渗透测试
- [ ] 代码安全审查
- [ ] 密钥轮换
- [ ] 安全培训
- [ ] 合规性检查

---

## 安全增强路线图

### 第一阶段：基础安全（已完成）
- ✅ HMAC-SHA256 签名认证（毫秒级时间戳）
- ✅ 输入验证和清理（ValidationUtils）
- ✅ 用户配置加密（AES-256-GCM）
- ✅ 威胁检测（detectThreats）
- ✅ XSS 防护（HTML 实体转义）
- ✅ 内容清理（移除控制字符）
- ✅ 渠道特定内容转义
- ✅ 请求头注入防护

### 第二阶段：增强防护（计划中）
- ⏳ 速率限制实施（基于 IP 和用户）
- ⏳ SSRF 防护集成到适配器
- ⏳ 安全响应头部添加
- ⏳ 审计日志系统
- ⏳ CORS 策略收紧
- ⏳ 请求大小限制
- ⏳ API 密钥轮换机制

### 第三阶段：高级安全（未来）
- ❌ IP 白名单/黑名单
- ❌ 异常行为检测（机器学习）
- ❌ 自动威胁响应（自动封禁）
- ❌ 安全事件实时告警
- ❌ DDoS 防护增强
- ❌ WAF 规则集成
- ❌ 零信任架构

---

## 实施建议

### 立即实施（高优先级）

1. **验证现有安全功能**
   ```bash
   # 运行安全测试脚本
   npm run test:local
   
   # 验证签名功能
   curl -X GET http://localhost:8788/api/send-notification
   # 应返回 401 未授权
   ```

2. **配置强密钥**
   ```bash
   # 生成 API 密钥
   openssl rand -hex 32
   # 输出示例: a1b2c3d4e5f6...（64个字符）
   
   # 设置密钥
   wrangler secret put API_SECRET_KEY --env production
   wrangler secret put ENCRYPT_KEY --env production
   ```

3. **监控安全事件**
   - 定期检查 notification_logs 中的失败记录
   - 监控认证失败的频率
   - 追踪异常的请求模式

### 短期计划（1-2周）

1. **实施速率限制**
   - 使用 KV 存储实现基本速率限制
   - 为不同端点设置不同限制
   - 添加速率限制响应头

2. **加强 CORS 配置**
   ```typescript
   // 替换当前的通配符配置
   const allowedOrigins = env.ALLOWED_ORIGINS?.split(',') || [];
   const origin = request.headers.get('Origin');
   const corsHeaders = {
     'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
     // ... 其他头部
   };
   ```

### 中期计划（1个月）

1. **部署审计日志**
   - 创建 security_audit_logs 表
   - 记录所有安全相关事件
   - 实施日志查询和分析 API

2. **集成 SSRF 防护**
   - 在所有 webhook 适配器中启用
   - 验证目标 URL 的安全性
   - 实施请求超时控制

3. **安全头部实施**
   - 添加所有推荐的安全头部
   - 配置严格的 CSP 策略
   - 启用 HSTS

### 安全运维最佳实践

1. **密钥管理**
   - 使用 Cloudflare Secrets 管理敏感数据
   - 定期轮换密钥（每 90 天）
   - 不要在代码中硬编码任何密钥

2. **监控和告警**
   - 设置认证失败阈值告警
   - 监控异常的 API 使用模式
   - 定期审查访问日志

3. **应急准备**
   - 准备 IP 封禁脚本
   - 建立安全事件响应流程
   - 保持与 Cloudflare 支持的联系

---

**最后更新**: 2025-01-05  
**版本**: 2.0  
**维护者**: 安全团队  

**相关文档**: 
- [API 完整参考](../03-reference/api/complete-api-reference.md)
- [快速开始](../01-getting-started/quickstart.md)
- [架构设计](../03-reference/architecture/)
- [V2 模板系统](../03-reference/architecture/v2-template-system.md)
- [部署指南](../02-guides/deployment/)
- [运维手册](../05-operations/)
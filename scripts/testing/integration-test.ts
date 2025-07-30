/**
 * 线上 API 集成测试脚本
 * 测试所有接口的基本功能
 * 
 * 运行方式:
 * API_SECRET_KEY=your-secret-key npx tsx scripts/integration-test.ts
 */

import * as crypto from 'crypto';

// 配置
const config = {
  baseUrl: process.env.API_BASE_URL || 'https://notification.caas.xyz',
  apiSecret: process.env.API_SECRET_KEY || '',
  testUserId: process.env.TEST_USER_ID || 'integration-test-user',
  larkWebhook: process.env.LARK_WEBHOOK || 'https://open.larksuite.com/open-apis/bot/v2/hook/bdcd6bf2-72cc-4726-9b31-43f02c521144',
  larkSecret: process.env.LARK_SECRET || 'XHBRWk8VLLle4jfCSksF5c',
  grafanaUsername: process.env.GRAFANA_USERNAME || 'grafana',
  grafanaPassword: process.env.GRAFANA_PASSWORD || 'test-password',
};

// 测试结果收集
const testResults: Array<{
  name: string;
  endpoint: string;
  method: string;
  success: boolean;
  error?: string;
  duration: number;
}> = [];

// 生成签名 - 使用 Node.js crypto
function generateSignature(timestamp: string, payload: string, secretKey: string): string {
  return crypto
    .createHmac('sha256', secretKey)
    .update(timestamp + payload)
    .digest('hex');
}

// 发送请求的通用函数
async function sendRequest(
  method: string,
  endpoint: string,
  body?: any,
  skipAuth = false,
  basicAuth?: { username: string; password: string },
  additionalHeaders?: Record<string, string>
): Promise<{ response: Response; data: any }> {
  const url = `${config.baseUrl}${endpoint}`;
  const timestamp = Date.now().toString();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...additionalHeaders, // 合并额外的 headers
  };

  // 添加 Basic Auth（如果提供）
  if (basicAuth) {
    const credentials = Buffer.from(`${basicAuth.username}:${basicAuth.password}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
    // 调试信息
    console.log(`  Basic Auth: username=${basicAuth.username}, password=***`);
  } else if (!skipAuth && config.apiSecret) {
    // 添加签名（除非明确跳过）
    let payload: string;
    if (method === 'GET' || method === 'DELETE') {
      const urlObj = new URL(url);
      payload = urlObj.pathname + urlObj.search;
    } else {
      payload = body ? JSON.stringify(body) : '';
    }
    
    headers['X-Timestamp'] = timestamp;
    headers['X-Signature'] = generateSignature(timestamp, payload, config.apiSecret);
    
    // 调试信息
    console.log(`  签名调试: timestamp=${timestamp}, payload=${payload.substring(0, 50)}...`);
    console.log(`  签名: ${headers['X-Signature']}`);
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  
  return { response, data };
}

// 测试单个接口
async function testEndpoint(
  name: string,
  method: string,
  endpoint: string,
  body?: any,
  skipAuth = false,
  basicAuth?: { username: string; password: string },
  additionalHeaders?: Record<string, string>
): Promise<void> {
  const startTime = Date.now();
  
  try {
    console.log(`\n测试: ${name}`);
    console.log(`${method} ${endpoint}`);
    
    const { response, data } = await sendRequest(method, endpoint, body, skipAuth, basicAuth, additionalHeaders);
    
    const duration = Date.now() - startTime;
    const success = response.ok;
    
    if (success) {
      console.log(`✅ 成功 (${response.status}) - ${duration}ms`);
    } else {
      console.log(`❌ 失败 (${response.status}): ${data.error || 'Unknown error'}`);
    }
    
    testResults.push({
      name,
      endpoint,
      method,
      success,
      error: !success ? data.error : undefined,
      duration,
    });
    
    // 如果有响应数据，打印部分内容
    if (data && Object.keys(data).length > 0) {
      console.log('响应预览:', JSON.stringify(data, null, 2).substring(0, 200) + '...');
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ 请求失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    testResults.push({
      name,
      endpoint,
      method,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
    });
  }
}

// 主测试流程
async function runTests() {
  console.log('🚀 开始线上 API 集成测试');
  console.log(`基础 URL: ${config.baseUrl}`);
  console.log(`测试用户: ${config.testUserId}`);
  console.log(`API 密钥: ${config.apiSecret ? '已设置' : '❌ 未设置'}`);
  console.log(`Lark Webhook: ${config.larkWebhook ? '已配置' : '❌ 未配置'}`);
  console.log(`Grafana 认证: ${config.grafanaUsername}:${config.grafanaPassword ? '***' : '❌ 未设置'}`);
  
  if (!config.apiSecret) {
    console.error('\n❌ 错误: 请设置 API_SECRET_KEY 环境变量');
    console.log('示例: API_SECRET_KEY=your-secret-key npm run integration-test');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));

  // 1. 测试所有 GET 接口
  console.log('\n📋 第一步: 测试所有 GET 接口\n');

  // 公开接口（不需要认证）
  await testEndpoint('健康检查', 'GET', '/health', undefined, true);
  await testEndpoint('定时任务健康检查', 'GET', '/health/scheduled-tasks', undefined, true);
  
  // 需要认证的 GET 接口
  await testEndpoint('获取系统指标', 'GET', '/metrics');
  await testEndpoint('获取用户配置', 'GET', `/api/user-configs?user_id=${config.testUserId}`);
  await testEndpoint('获取所有模板', 'GET', '/api/templates');
  await testEndpoint('获取通知日志', 'GET', `/api/notification-logs?user_id=${config.testUserId}&limit=10`);
  await testEndpoint('检查数据库架构', 'GET', '/api/db/schema');

  // 2. 创建测试用户的 Lark 配置
  console.log('\n📋 第二步: 配置 Lark 用户\n');

  const larkConfig = {
    user_id: config.testUserId,
    channel_type: 'lark',
    config_data: {
      webhook_url: config.larkWebhook,
      secret: config.larkSecret,
      msg_type: 'text', // 使用文本格式
    },
    is_active: true,
  };

  await testEndpoint('创建 Lark 用户配置', 'POST', '/api/user-configs', larkConfig);

  // 3. 创建测试模板
  console.log('\n📋 第三步: 创建测试模板\n');

  // V2 模板 API 格式：先创建模板基本信息
  const testTemplateKey = 'integration_test_template';
  const testTemplateData = {
    name: '集成测试模板',
    description: '用于集成测试的模板',
    variables: ['test_time', 'test_id'],
    contents: {
      lark: {
        content_type: 'text',
        subject_template: '🚀 【模板测试】集成测试通知',
        content_template: '🔥🔥🔥 模板消息测试 🔥🔥🔥\n\n📌 这是通过模板发送的消息\n⏰ 测试时间: {{test_time}}\n🆔 测试ID: {{test_id}}\n🏷️ 模板Key: integration_test_template\n\n✅ 如果您看到这条消息，说明模板功能正常工作！',
      }
    }
  };
  
  // 创建 Grafana 告警模板
  const grafanaTemplateKey = 'grafana-alert-critical';
  const grafanaTemplateData = {
    name: 'Grafana 严重告警模板',
    description: 'Grafana 严重级别告警的通知模板',
    variables: ['alertname', 'severity', 'summary', 'description', 'service', 'instance', 'runbook_url', 'error_rate'],
    contents: {
      lark: {
        content_type: 'text',
        subject_template: '🚨 【Grafana告警】{{alertname}} - {{severity}}',
        content_template: '🚨🚨🚨 Grafana 告警通知 🚨🚨🚨\n\n📌 告警名称: {{alertname}}\n🔴 严重级别: {{severity}}\n🏷️ 服务: {{service}}\n🖥️ 实例: {{instance}}\n\n📊 摘要:\n{{summary}}\n\n📝 详情:\n{{description}}\n\n📈 错误率: {{error_rate}}\n\n📚 Runbook: {{runbook_url}}\n\n⏰ 触发时间: ' + new Date().toLocaleString('zh-CN'),
      },
      webhook: {
        content_type: 'json',
        content_template: '{"alertname":"{{alertname}}","severity":"{{severity}}","summary":"{{summary}}","description":"{{description}}","service":"{{service}}","instance":"{{instance}}","error_rate":"{{error_rate}}","runbook_url":"{{runbook_url}}"}',
      }
    }
  };

  await testEndpoint(
    '创建测试模板', 
    'POST', 
    `/api/templates?key=${testTemplateKey}`, 
    testTemplateData
  );
  
  await testEndpoint(
    '创建 Grafana 告警模板', 
    'POST', 
    `/api/templates?key=${grafanaTemplateKey}`, 
    grafanaTemplateData
  );

  // 4. 发送测试通知
  console.log('\n📋 第四步: 发送测试通知\n');

  // 使用自定义内容发送
  const customNotification = {
    user_id: config.testUserId,
    channels: ['lark'],
    custom_content: {
      subject: '🤖 【自定义消息】GitHub Actions 集成测试',
      content: `🎯🎯🎯 自定义消息测试 🎯🎯🎯\n\n📌 这是通过自定义内容发送的消息\n🌐 环境: ${config.baseUrl}\n⏰ 时间: ${new Date().toLocaleString('zh-CN')}\n👤 用户: ${config.testUserId}\n🏷️ 类型: 自定义内容（非模板）\n\n✅ 如果您看到这条消息，说明自定义内容功能正常工作！`,
    },
    idempotency_key: `test-${Date.now()}`,
  };

  await testEndpoint('发送自定义通知', 'POST', '/api/notifications/send', customNotification);

  // 使用模板发送
  const templateNotification = {
    user_id: config.testUserId,
    channels: ['lark'],
    template_key: testTemplateKey,
    variables: {
      test_time: new Date().toLocaleString('zh-CN'),
      test_id: `TEST-${Date.now()}`,
    },
  };

  await testEndpoint('发送模板通知', 'POST', '/api/notifications/send', templateNotification);

  // 5. 测试 Grafana Webhook
  console.log('\n📋 第五步: 测试 Grafana Webhook 集成\n');
  
  // 检查 Grafana 凭据是否配置
  if (!config.grafanaUsername || !config.grafanaPassword || config.grafanaPassword === 'test-password') {
    console.log('⚠️ 跳过 Grafana 测试 - 未配置生产环境凭据');
  } else {

  // 先为 Grafana 用户配置渠道
  const grafanaUserId = 'grafana-test-user';
  
  // 配置 Webhook 渠道
  const webhookConfig = {
    user_id: grafanaUserId,
    channel_type: 'webhook',
    config_data: {
      webhook_url: 'https://httpbin.org/post', // 使用 httpbin 作为测试端点
    },
    is_active: true,
  };
  await testEndpoint('为 Grafana 用户配置 Webhook', 'POST', '/api/user-configs', webhookConfig);
  
  // 配置 Lark 渠道 - 使用与集成测试相同的 webhook
  const larkConfig = {
    user_id: grafanaUserId,
    channel_type: 'lark',
    config_data: {
      webhook_url: config.larkWebhook,
    },
    is_active: true,
  };
  await testEndpoint('为 Grafana 用户配置 Lark', 'POST', '/api/user-configs', larkConfig);

  // 发送 Grafana 告警（firing 状态）
  const grafanaAlertFiring = {
    receiver: grafanaUserId,
    status: 'firing',
    alerts: [
      {
        status: 'firing',
        labels: {
          alertname: '🚨 【Grafana测试】High CPU Usage',
          severity: 'critical',
          instance: 'server-01',
        },
        annotations: {
          summary: '🔴 集成测试 - CPU usage is above 90%',
          description: '🎯 这是 Grafana Webhook 集成测试告警',
        },
        startsAt: new Date().toISOString(),
        generatorURL: 'http://grafana.example.com/graph/d/uid/dashboard',
      },
      {
        status: 'firing',
        labels: {
          alertname: '⚠️ 【Grafana测试】High Memory Usage',
          severity: 'warning',
          instance: 'server-01',
        },
        annotations: {
          summary: '🟡 集成测试 - Memory usage is above 80%',
          description: '🎯 这是 Grafana Webhook 集成测试告警',
        },
        startsAt: new Date(Date.now() - 180000).toISOString(), // 3分钟前
      },
    ],
    groupLabels: {
      alertname: 'High CPU Usage',
    },
    commonLabels: {
      severity: 'critical',
      team: 'ops',
    },
    commonAnnotations: {
      dashboard: 'http://grafana.example.com/d/uid/dashboard',
    },
    externalURL: 'http://alertmanager.example.com',
  };

  await testEndpoint(
    'Grafana Webhook - 发送 Firing 告警',
    'POST',
    '/api/webhooks/grafana',
    grafanaAlertFiring,
    true, // skipAuth
    { username: config.grafanaUsername, password: config.grafanaPassword },
    { 'X-Notification-Channels': 'webhook,lark' } // 添加通知渠道头
  );

  // 发送 Grafana 告警（resolved 状态）
  const grafanaAlertResolved = {
    receiver: grafanaUserId,
    status: 'resolved',
    alerts: [
      {
        status: 'resolved',
        labels: {
          alertname: 'High CPU Usage',
          severity: 'critical',
          instance: 'server-01',
        },
        annotations: {
          summary: 'CPU usage is back to normal',
          description: 'CPU usage has returned below 90%',
        },
        startsAt: new Date(Date.now() - 600000).toISOString(), // 10分钟前
        endsAt: new Date().toISOString(),
        generatorURL: 'http://grafana.example.com/graph/d/uid/dashboard',
      },
    ],
    groupLabels: {
      alertname: 'High CPU Usage',
    },
    commonLabels: {
      severity: 'critical',
      team: 'ops',
    },
  };

  await testEndpoint(
    'Grafana Webhook - 发送 Resolved 告警',
    'POST',
    '/api/webhooks/grafana',
    grafanaAlertResolved,
    true, // skipAuth
    { username: config.grafanaUsername, password: config.grafanaPassword },
    { 'X-Notification-Channels': 'webhook,lark' } // 添加通知渠道头
  );

  // 测试带模板的 Grafana 告警
  const grafanaAlertWithTemplate = {
    receiver: grafanaUserId,
    status: 'firing',
    alerts: [
      {
        status: 'firing',
        labels: {
          alertname: 'API Error Rate High',
          severity: 'critical',
          notification_template: 'grafana-alert-critical', // 使用特定模板
          service: 'api-gateway',
        },
        annotations: {
          summary: 'API error rate exceeded threshold',
          description: 'Error rate is above 5% for the last 5 minutes',
          runbook_url: 'https://wiki.example.com/runbooks/api-errors',
        },
        startsAt: new Date().toISOString(),
        values: {
          'error_rate': 0.078,
          'request_count': 12543,
        },
      },
    ],
  };

  await testEndpoint(
    'Grafana Webhook - 使用模板发送告警',
    'POST',
    '/api/webhooks/grafana',
    grafanaAlertWithTemplate,
    true, // skipAuth
    { username: config.grafanaUsername, password: config.grafanaPassword }
  );

  // 测试多渠道 Grafana 告警
  await testEndpoint(
    'Grafana Webhook - 多渠道发送',
    'POST',
    '/api/webhooks/grafana',
    {
      ...grafanaAlertFiring,
      receiver: config.testUserId, // 使用有 Lark 配置的用户
    },
    true, // skipAuth
    { username: config.grafanaUsername, password: config.grafanaPassword },
    { 'X-Notification-Channels': 'webhook,lark' } // 通过 headers 参数传递
  );
  
  } // 结束 Grafana 测试条件判断

  // 6. 测试其他功能
  console.log('\n📋 第六步: 测试其他功能\n');

  // 查询刚才发送的通知日志
  await testEndpoint(
    '查询最新通知日志',
    'GET',
    `/api/notification-logs?user_id=${config.testUserId}&limit=5`
  );

  // 查询 Grafana 用户的通知日志 (仅在测试 Grafana 时)
  if (config.grafanaUsername && config.grafanaPassword && config.grafanaPassword !== 'test-password') {
    const grafanaUserId = 'grafana-test-user';
    await testEndpoint(
      '查询 Grafana 用户通知日志',
      'GET',
      `/api/notification-logs?user_id=${grafanaUserId}&limit=5`
    );
  }

  // 测试重试功能（如果有失败的通知）
  await testEndpoint('触发重试', 'POST', '/api/notifications/retry', {});

  // 7. 清理测试数据
  console.log('\n📋 第七步: 清理测试数据\n');

  // 删除测试模板
  await testEndpoint(
    '删除测试模板',
    'DELETE',
    `/api/templates?key=${testTemplateKey}`
  );
  
  await testEndpoint(
    '删除 Grafana 告警模板',
    'DELETE',
    `/api/templates?key=${grafanaTemplateKey}`
  );

  // 删除用户配置
  await testEndpoint(
    '删除 Lark 配置',
    'DELETE',
    `/api/user-configs?user_id=${config.testUserId}&channel_type=lark`
  );

  // 删除 Grafana 测试用户配置 (仅在测试 Grafana 时)
  if (config.grafanaUsername && config.grafanaPassword && config.grafanaPassword !== 'test-password') {
    const grafanaUserId = 'grafana-test-user';
    await testEndpoint(
      '删除 Grafana 用户 Webhook 配置',
      'DELETE',
      `/api/user-configs?user_id=${grafanaUserId}&channel_type=webhook`
    );
  }

  // 清理旧日志（保留最近 30 天）
  await testEndpoint(
    '清理旧日志',
    'DELETE',
    '/api/notification-logs/cleanup',
    { days: 30 }
  );

  // 打印测试报告
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 测试报告\n');

  const successCount = testResults.filter((r) => r.success).length;
  const failureCount = testResults.filter((r) => !r.success).length;
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);

  console.log(`总测试数: ${testResults.length}`);
  console.log(`✅ 成功: ${successCount}`);
  console.log(`❌ 失败: ${failureCount}`);
  console.log(`总耗时: ${totalDuration}ms`);
  console.log(`平均耗时: ${Math.round(totalDuration / testResults.length)}ms`);

  if (failureCount > 0) {
    console.log('\n失败的测试:');
    testResults
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`- ${r.name} (${r.method} ${r.endpoint}): ${r.error}`);
      });
  }

  // 生成详细报告
  const report = {
    timestamp: new Date().toISOString(),
    config: {
      baseUrl: config.baseUrl,
      testUserId: config.testUserId,
    },
    summary: {
      total: testResults.length,
      success: successCount,
      failure: failureCount,
      totalDuration,
      averageDuration: Math.round(totalDuration / testResults.length),
    },
    results: testResults,
  };

  console.log('\n📄 详细测试报告:');
  console.log(JSON.stringify(report, null, 2));

  // 退出码
  process.exit(failureCount > 0 ? 1 : 0);
}

// 运行测试
runTests().catch((error) => {
  console.error('\n❌ 测试过程中发生错误:', error);
  process.exit(1);
});
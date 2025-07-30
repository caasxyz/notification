/**
 * SDK 集成测试脚本 - 使用增强版 SDK
 * 展示新 SDK 的各种使用方式
 * 
 * 运行方式:
 * API_SECRET_KEY=your-secret-key npx tsx scripts/testing/integration-test-sdk-enhanced.ts
 */

import { EnhancedNotificationClient } from '../../sdk/dist/index.js';

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
  description: string;
  success: boolean;
  error?: string;
  duration: number;
}> = [];

// 记录测试结果
function recordTest(name: string, description: string, startTime: number, success: boolean, error?: string) {
  const duration = Date.now() - startTime;
  testResults.push({ name, description, success, error, duration });
  
  if (success) {
    console.log(`✅ ${name} - ${duration}ms`);
  } else {
    console.log(`❌ ${name}: ${error || 'Unknown error'}`);
  }
}

// 主测试流程
async function runTests() {
  console.log('🚀 开始增强版 SDK 集成测试');
  console.log(`基础 URL: ${config.baseUrl}`);
  console.log(`测试用户: ${config.testUserId}`);
  console.log(`API 密钥: ${config.apiSecret ? '已设置' : '❌ 未设置'}`);
  
  if (!config.apiSecret) {
    console.error('\n❌ 错误: 请设置 API_SECRET_KEY 环境变量');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));

  // 初始化增强版客户端
  const client = new EnhancedNotificationClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiSecret,
    timeout: 30000,
  });

  // 1. 基础健康检查
  console.log('\n📋 第一步: 基础健康检查\n');
  
  let startTime = Date.now();
  try {
    const health = await client.health();
    recordTest('健康检查', 'GET /health', startTime, health.success);
  } catch (error) {
    recordTest('健康检查', 'GET /health', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 2. 配置用户渠道
  console.log('\n📋 第二步: 配置用户渠道\n');

  // 配置 Lark
  startTime = Date.now();
  try {
    await client.configs.set(config.testUserId, 'lark', {
      channel_type: 'lark',
      config: {
        webhook_url: config.larkWebhook,
        secret: config.larkSecret,
        msg_type: 'text',
      },
      is_active: true,
    });
    recordTest('配置 Lark 渠道', 'POST /api/user-configs', startTime, true);
  } catch (error) {
    recordTest('配置 Lark 渠道', 'POST /api/user-configs', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 配置 Email（演示多渠道）
  startTime = Date.now();
  try {
    await client.configs.set(config.testUserId, 'email', {
      channel_type: 'email',
      config: {
        email: 'test@example.com',
      },
      is_active: true,
    });
    recordTest('配置 Email 渠道', 'POST /api/user-configs', startTime, true);
  } catch (error) {
    recordTest('配置 Email 渠道', 'POST /api/user-configs', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 3. 创建测试模板
  console.log('\n📋 第三步: 创建测试模板\n');

  const testTemplateKey = 'sdk_enhanced_test';
  startTime = Date.now();
  try {
    await client.templates.create(testTemplateKey, {
      name: '增强版 SDK 测试模板',
      description: '用于测试增强版 SDK 的模板',
      variables: ['user_name', 'action', 'timestamp'],
      contents: {
        lark: {
          content_type: 'text',
          subject_template: '🚀 【SDK测试】{{action}}',
          content_template: '🎯 增强版 SDK 测试通知\n\n👤 用户: {{user_name}}\n🎬 操作: {{action}}\n⏰ 时间: {{timestamp}}\n\n✅ 这是通过增强版 SDK 发送的通知！',
        },
        email: {
          content_type: 'html',
          subject_template: '[SDK Test] {{action}}',
          content_template: '<h2>增强版 SDK 测试通知</h2><p>用户: {{user_name}}<br>操作: {{action}}<br>时间: {{timestamp}}</p>',
        }
      }
    });
    recordTest('创建测试模板', 'POST /api/templates', startTime, true);
  } catch (error) {
    recordTest('创建测试模板', 'POST /api/templates', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 4. 测试各种发送方式
  console.log('\n📋 第四步: 测试各种发送方式\n');

  // 4.1 链式调用发送
  console.log('\n🔗 测试链式调用...');
  startTime = Date.now();
  try {
    await client
      .notify()
      .to(config.testUserId)
      .via('lark')
      .content('这是通过链式调用发送的通知！', '链式调用测试')
      .idempotent(`chain-${Date.now()}`)
      .send();
    recordTest('链式调用发送', '使用 notify().to().via().content().send()', startTime, true);
  } catch (error) {
    recordTest('链式调用发送', '使用 notify().to().via().content().send()', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 4.2 快速发送
  console.log('\n⚡ 测试快速发送...');
  startTime = Date.now();
  try {
    await client.quick.lark(config.testUserId, '🚀 这是通过快速发送接口发送的 Lark 通知！');
    recordTest('快速发送 Lark', '使用 quick.lark()', startTime, true);
  } catch (error) {
    recordTest('快速发送 Lark', '使用 quick.lark()', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 4.3 使用模板发送
  console.log('\n📝 测试模板发送...');
  startTime = Date.now();
  try {
    await client
      .notify()
      .to(config.testUserId)
      .via('lark', 'email')
      .useTemplate(testTemplateKey, {
        user_name: '测试用户',
        action: '模板测试',
        timestamp: new Date().toLocaleString('zh-CN'),
      })
      .send();
    recordTest('模板发送', '使用 useTemplate() 多渠道发送', startTime, true);
  } catch (error) {
    recordTest('模板发送', '使用 useTemplate() 多渠道发送', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 4.4 预设模板
  console.log('\n🎯 测试预设模板...');
  
  // 创建一个 welcome 模板用于测试
  try {
    await client.templates.create('welcome', {
      name: '欢迎模板',
      variables: ['name'],
      contents: {
        lark: {
          content_type: 'text',
          content_template: '🎉 欢迎 {{name}} 加入我们！',
        }
      }
    });
  } catch (error) {
    // 模板可能已存在，忽略错误
  }

  startTime = Date.now();
  try {
    await client.presets.welcome(config.testUserId, 'SDK测试用户', {
      company: 'Notification System',
      trial_days: 30,
    });
    recordTest('预设欢迎通知', '使用 presets.welcome()', startTime, true);
  } catch (error) {
    recordTest('预设欢迎通知', '使用 presets.welcome()', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 4.5 会话模式
  console.log('\n🎭 测试会话模式...');
  const session = client.createSession(config.testUserId, ['lark']);
  
  startTime = Date.now();
  try {
    await session.send('📢 会话开始：这是第一条消息');
    await session.send('📊 处理中：正在执行操作...');
    await session.send('✅ 会话结束：操作完成！', { subject: '操作完成通知' });
    recordTest('会话模式', '连续发送3条消息', startTime, true);
  } catch (error) {
    recordTest('会话模式', '连续发送3条消息', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 4.6 批量发送
  console.log('\n📦 测试批量发送...');
  startTime = Date.now();
  try {
    const notifications = [
      {
        user_id: config.testUserId,
        channels: ['lark'] as any,
        custom_content: {
          content: '批量通知 1：这是第一条批量消息',
        },
      },
      {
        user_id: config.testUserId,
        channels: ['lark'] as any,
        custom_content: {
          content: '批量通知 2：这是第二条批量消息',
        },
      },
      {
        user_id: config.testUserId,
        channels: ['lark'] as any,
        custom_content: {
          content: '批量通知 3：这是第三条批量消息',
        },
      },
    ];

    await client.sendBatchNotifications(notifications, {
      concurrency: 2,
      stopOnError: false,
    });
    recordTest('批量发送', '并发发送3条通知', startTime, true);
  } catch (error) {
    recordTest('批量发送', '并发发送3条通知', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 4.7 智能渠道选择（不指定渠道）
  console.log('\n🧠 测试智能渠道选择...');
  startTime = Date.now();
  try {
    await client
      .notify()
      .to(config.testUserId)
      .content('🤖 这条消息没有指定渠道，SDK 会自动选择！')
      .send();
    recordTest('智能渠道选择', '自动选择用户配置的渠道', startTime, true);
  } catch (error) {
    recordTest('智能渠道选择', '自动选择用户配置的渠道', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 5. 查询和统计
  console.log('\n📋 第五步: 查询和统计\n');

  // 查询通知日志
  startTime = Date.now();
  try {
    const logs = await client.logs.query({
      user_id: config.testUserId,
      limit: 10,
    });
    console.log(`📊 查询到 ${logs.data?.length || 0} 条通知日志`);
    recordTest('查询通知日志', 'GET /api/notification-logs', startTime, logs.success);
  } catch (error) {
    recordTest('查询通知日志', 'GET /api/notification-logs', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 6. 清理测试数据
  console.log('\n📋 第六步: 清理测试数据\n');

  // 删除测试模板
  startTime = Date.now();
  try {
    await client.templates.delete(testTemplateKey);
    recordTest('删除测试模板', 'DELETE /api/templates', startTime, true);
  } catch (error) {
    recordTest('删除测试模板', 'DELETE /api/templates', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 删除 welcome 模板
  try {
    await client.templates.delete('welcome');
  } catch (error) {
    // 忽略错误
  }

  // 删除用户配置
  startTime = Date.now();
  try {
    await client.configs.delete(config.testUserId, 'lark');
    await client.configs.delete(config.testUserId, 'email');
    recordTest('删除用户配置', 'DELETE /api/user-configs', startTime, true);
  } catch (error) {
    recordTest('删除用户配置', 'DELETE /api/user-configs', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 7. 高级功能演示（可选）
  console.log('\n📋 第七步: 高级功能演示\n');

  // 7.1 发送并确认送达（演示概念，实际可能需要等待）
  console.log('🔍 演示发送确认功能...');
  startTime = Date.now();
  try {
    // 先配置渠道
    await client.configs.set(config.testUserId, 'lark', {
      channel_type: 'lark',
      config: {
        webhook_url: config.larkWebhook,
        secret: config.larkSecret,
      },
      is_active: true,
    });

    const { response, confirmed } = await client.sendAndConfirm({
      user_id: config.testUserId,
      channels: ['lark'],
      custom_content: {
        content: '⏳ 这是一条需要确认送达的重要通知！',
      },
    }, {
      timeout: 5000, // 5秒超时
      checkInterval: 1000, // 每秒检查一次
    });
    
    console.log(`   送达确认: ${confirmed ? '✅ 已确认' : '⚠️ 未确认'}`);
    recordTest('发送并确认', '发送通知并等待确认', startTime, true);
  } catch (error) {
    recordTest('发送并确认', '发送通知并等待确认', startTime, false, error instanceof Error ? error.message : 'Unknown error');
  }

  // 打印测试报告
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 增强版 SDK 测试报告\n');

  const successCount = testResults.filter((r) => r.success).length;
  const failureCount = testResults.filter((r) => !r.success).length;
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);

  console.log(`总测试数: ${testResults.length}`);
  console.log(`✅ 成功: ${successCount}`);
  console.log(`❌ 失败: ${failureCount}`);
  console.log(`总耗时: ${totalDuration}ms`);
  console.log(`平均耗时: ${Math.round(totalDuration / testResults.length)}ms`);

  console.log('\n📋 功能覆盖:');
  console.log('✅ 链式调用 API');
  console.log('✅ 快速发送助手');
  console.log('✅ 模板发送');
  console.log('✅ 预设通知模板');
  console.log('✅ 会话模式');
  console.log('✅ 批量发送（并发控制）');
  console.log('✅ 智能渠道选择');
  console.log('✅ 发送确认机制');

  if (failureCount > 0) {
    console.log('\n失败的测试:');
    testResults
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`- ${r.name}: ${r.error}`);
      });
  }

  // 生成详细报告
  const report = {
    timestamp: new Date().toISOString(),
    config: {
      baseUrl: config.baseUrl,
      testUserId: config.testUserId,
      sdkVersion: 'Enhanced',
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

  // 最后清理
  try {
    await client.configs.delete(config.testUserId, 'lark');
  } catch (error) {
    // 忽略错误
  }

  // 退出码
  process.exit(failureCount > 0 ? 1 : 0);
}

// 运行测试
runTests().catch((error) => {
  console.error('\n❌ 测试过程中发生错误:', error);
  process.exit(1);
});
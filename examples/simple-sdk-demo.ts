#!/usr/bin/env node
/**
 * 简单的 SDK 使用示例
 * 展示最基本的通知发送功能
 * 
 * 使用方式:
 * API_SECRET_KEY=your-secret-key npx tsx examples/simple-sdk-demo.ts
 */

import { EnhancedNotificationClient } from '../sdk/dist/index.js';

// 配置
const API_SECRET_KEY = process.env.API_SECRET_KEY;
const API_URL = process.env.API_URL || 'https://notification.caas.xyz';
const USER_ID = process.env.USER_ID || 'demo-user';

if (!API_SECRET_KEY) {
  console.error('❌ 请设置 API_SECRET_KEY 环境变量');
  console.log('示例: API_SECRET_KEY=your-secret-key npx tsx examples/simple-sdk-demo.ts');
  process.exit(1);
}

async function main() {
  // 1. 初始化客户端
  const client = new EnhancedNotificationClient({
    baseUrl: API_URL,
    apiKey: API_SECRET_KEY,
  });

  console.log('🚀 Notification SDK 简单示例\n');

  try {
    // 2. 检查服务状态
    console.log('1️⃣ 检查服务状态...');
    const health = await client.health();
    console.log('✅ 服务状态:', (health as any).status);
    console.log('📊 版本:', (health as any).version);
    console.log('');

    // 3. 配置用户通知渠道（Webhook 示例）
    console.log('2️⃣ 配置用户通知渠道...');
    await client.configs.set(USER_ID, 'webhook', {
      channel_type: 'webhook',
      config: {
        webhook_url: 'https://httpbin.org/post', // 测试 webhook
      },
      is_active: true,
    });
    console.log('✅ Webhook 渠道配置成功');
    console.log('');

    // 4. 发送简单通知 - 使用智能发送
    console.log('3️⃣ 发送简单通知（智能发送）...');
    const result1 = await client.smartSend(
      USER_ID,
      '这是一条测试通知！SDK 会自动选择已配置的渠道。'
    );
    console.log('✅ 通知发送成功');
    console.log('📧 Message ID:', result1.data?.results[0].message_id);
    console.log('');

    // 5. 使用链式 API 发送通知
    console.log('4️⃣ 使用链式 API 发送通知...');
    const result2 = await client
      .notify()
      .to(USER_ID)
      .via('webhook')
      .content('这是通过链式 API 发送的通知！')
      .send();
    console.log('✅ 链式调用成功');
    console.log('📧 Message ID:', result2.data?.results[0].message_id);
    console.log('');

    // 6. 创建并使用模板
    console.log('5️⃣ 创建并使用模板...');
    const templateKey = `demo_template_${Date.now()}`;
    
    // 创建模板
    await client.templates.create(templateKey, {
      name: '演示模板',
      description: '用于演示的通知模板',
      variables: ['user_name', 'action'],
      contents: {
        webhook: {
          content_type: 'json',
          content_template: '{"user":"{{user_name}}","action":"{{action}}","time":"' + new Date().toISOString() + '"}',
        }
      }
    });
    console.log('✅ 模板创建成功');

    // 使用模板发送
    const result3 = await client
      .notify()
      .to(USER_ID)
      .via('webhook')
      .useTemplate(templateKey, {
        user_name: '演示用户',
        action: '完成了一个任务',
      })
      .send();
    console.log('✅ 模板通知发送成功');
    console.log('📧 Message ID:', result3.data?.results[0].message_id);
    console.log('');

    // 7. 查询通知日志
    console.log('6️⃣ 查询最近的通知日志...');
    const logs = await client.logs.query({
      user_id: USER_ID,
      limit: 3,
    });
    
    if (logs.success && logs.data) {
      console.log(`✅ 找到 ${logs.data.length} 条通知记录`);
      logs.data.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.status} - ${log.channel_type} - ${new Date(log.created_at).toLocaleString()}`);
      });
    }
    console.log('');

    // 8. 清理（删除测试数据）
    console.log('7️⃣ 清理测试数据...');
    await client.templates.delete(templateKey);
    await client.configs.delete(USER_ID, 'webhook');
    console.log('✅ 清理完成');

    console.log('\n🎉 示例运行成功！');
    console.log('\n下一步：');
    console.log('1. 配置真实的通知渠道（Lark、Telegram、Slack）');
    console.log('2. 创建更复杂的模板');
    console.log('3. 使用批量发送功能');
    console.log('4. 集成到您的应用程序中');

  } catch (error) {
    console.error('\n❌ 发生错误:', error);
    process.exit(1);
  }
}

// 运行示例
main().catch(console.error);
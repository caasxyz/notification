#!/usr/bin/env node
/**
 * 综合 SDK 功能演示
 * 展示通知系统 SDK 的所有主要功能
 * 
 * 使用方式:
 * API_SECRET_KEY=your-secret-key npx tsx examples/comprehensive-sdk-demo.ts
 */

import { EnhancedNotificationClient } from '../sdk/dist/index.js';
import chalk from 'chalk';

// 配置
const API_SECRET_KEY = process.env.API_SECRET_KEY;
const API_URL = process.env.API_URL || 'https://notification.caas.xyz';
const USER_ID = process.env.USER_ID || 'demo-user';

if (!API_SECRET_KEY) {
  console.error(chalk.red('❌ 请设置 API_SECRET_KEY 环境变量'));
  console.log(chalk.gray('示例: API_SECRET_KEY=your-secret-key npx tsx examples/comprehensive-sdk-demo.ts'));
  process.exit(1);
}

// 辅助函数：打印分隔线
function printSection(title: string) {
  console.log('\n' + chalk.blue('═'.repeat(60)));
  console.log(chalk.blue.bold(`  ${title}`));
  console.log(chalk.blue('═'.repeat(60)) + '\n');
}

// 辅助函数：打印子标题
function printSubSection(title: string) {
  console.log('\n' + chalk.cyan(`▶ ${title}`));
  console.log(chalk.gray('─'.repeat(50)));
}

async function main() {
  // 初始化客户端
  const client = new EnhancedNotificationClient({
    baseUrl: API_URL,
    apiKey: API_SECRET_KEY,
  });

  console.log(chalk.bold.green('\n🚀 Notification SDK 综合功能演示\n'));
  console.log(chalk.gray(`API URL: ${API_URL}`));
  console.log(chalk.gray(`用户 ID: ${USER_ID}\n`));

  try {
    // ==========================================
    // 1. 基础功能
    // ==========================================
    printSection('1. 基础功能');

    // 健康检查
    printSubSection('健康检查');
    const health = await client.health();
    console.log('✅ 服务状态:', chalk.green((health as any).status || 'healthy'));
    console.log('📊 版本:', (health as any).version || 'unknown');

    // ==========================================
    // 2. 用户配置管理
    // ==========================================
    printSection('2. 用户配置管理');

    // 配置 Webhook
    printSubSection('配置 Webhook 渠道');
    await client.configs.set(USER_ID, 'webhook', {
      channel_type: 'webhook',
      config: {
        webhook_url: 'https://httpbin.org/post',
      },
      is_active: true,
    });
    console.log('✅ Webhook 配置成功');

    // 配置 Lark（如果有 webhook）
    if (process.env.LARK_WEBHOOK) {
      printSubSection('配置 Lark 渠道');
      await client.configs.set(USER_ID, 'lark', {
        channel_type: 'lark',
        config: {
          webhook_url: process.env.LARK_WEBHOOK,
          secret: process.env.LARK_SECRET || '',
          msg_type: 'text',
        },
        is_active: true,
      });
      console.log('✅ Lark 配置成功');
    }

    // 查询配置
    printSubSection('查询用户配置');
    const configs = await client.configs.list(USER_ID);
    if (configs.data) {
      console.log(`找到 ${configs.data.length} 个渠道配置:`);
      configs.data.forEach(config => {
        console.log(`  - ${config.channel_type}: ${config.is_active ? '✅ 已启用' : '❌ 已禁用'}`);
      });
    }

    // ==========================================
    // 3. 智能发送功能（推荐）
    // ==========================================
    printSection('3. 智能发送功能（推荐）');

    printSubSection('基础智能发送');
    const smartResult1 = await client.smartSend(
      USER_ID,
      '🎯 智能发送测试！SDK 会自动获取用户配置并选择合适的渠道。'
    );
    console.log('✅ 发送成功');
    console.log('📧 Message ID:', smartResult1.data?.results[0].message_id);

    printSubSection('带主题的智能发送');
    const smartResult2 = await client.smartSend(
      USER_ID,
      '这是一条带主题的智能通知',
      { subject: '重要通知' }
    );
    console.log('✅ 发送成功');
    console.log('📧 Message ID:', smartResult2.data?.results[0].message_id);

    printSubSection('使用模板的智能发送');
    // 先创建一个模板
    const templateKey = `smart_demo_${Date.now()}`;
    await client.templates.create(templateKey, {
      name: '智能发送演示模板',
      description: '用于演示智能发送的模板',
      variables: ['action', 'time'],
      contents: {
        webhook: {
          content_type: 'text',
          content_template: '{{action}} 完成于 {{time}}',
        },
        lark: {
          content_type: 'text',
          content_template: '🎯 {{action}}\n⏰ 时间: {{time}}',
        }
      }
    });

    const smartResult3 = await client.smartSend(
      USER_ID,
      '模板通知', // 当使用模板时，这个内容会被忽略
      {
        template: templateKey,
        variables: {
          action: '智能发送模板测试',
          time: new Date().toLocaleString('zh-CN'),
        }
      }
    );
    console.log('✅ 模板发送成功');
    console.log('📧 Message ID:', smartResult3.data?.results[0].message_id);

    // ==========================================
    // 4. 链式 API（优雅的调用方式）
    // ==========================================
    printSection('4. 链式 API（优雅的调用方式）');

    printSubSection('基础链式调用');
    const chainResult1 = await client
      .notify()
      .to(USER_ID)
      .via('webhook')
      .content('🔗 这是通过链式 API 发送的通知')
      .send();
    console.log('✅ 发送成功');

    printSubSection('多渠道链式调用');
    const chainResult2 = await client
      .notify()
      .to(USER_ID)
      .via('webhook', 'lark')
      .content('📢 多渠道通知测试')
      .subject('多渠道测试')
      .idempotent(`chain-multi-${Date.now()}`)
      .send();
    console.log('✅ 多渠道发送成功');

    printSubSection('链式模板调用');
    const chainResult3 = await client
      .notify()
      .to(USER_ID)
      .via('webhook')
      .useTemplate(templateKey, {
        action: '链式 API 模板调用',
        time: new Date().toLocaleString('zh-CN'),
      })
      .metadata({ source: 'demo', type: 'test' })
      .send();
    console.log('✅ 模板发送成功');

    // ==========================================
    // 5. 快速发送（一行代码）
    // ==========================================
    printSection('5. 快速发送（一行代码）');

    printSubSection('快速 Webhook 发送');
    await client.quick.webhook(USER_ID, '⚡ 快速 Webhook 消息');
    console.log('✅ Webhook 发送成功');

    if (process.env.LARK_WEBHOOK) {
      printSubSection('快速 Lark 发送');
      await client.quick.lark(USER_ID, '⚡ 快速 Lark 消息');
      console.log('✅ Lark 发送成功');
    }

    printSubSection('快速模板发送');
    const quickTemplateResult = await client.quick.fromTemplate(
      USER_ID,
      templateKey,
      {
        action: '快速模板发送',
        time: new Date().toLocaleString('zh-CN'),
      }
    );
    console.log('✅ 模板发送成功，使用了所有配置的渠道');

    // ==========================================
    // 6. 预设场景（常用通知模板）
    // ==========================================
    printSection('6. 预设场景（常用通知模板）');

    // 注意：这些预设需要相应的模板存在于系统中
    printSubSection('预设场景示例');
    console.log('以下是一些预设场景的调用示例：');
    console.log(chalk.gray('// 欢迎通知'));
    console.log(chalk.green("await client.presets.welcome(userId, '张三');"));
    console.log(chalk.gray('// 安全警告'));
    console.log(chalk.green("await client.presets.securityAlert(userId, 'login', { ip: '1.2.3.4', location: '北京' });"));
    console.log(chalk.gray('// 验证码'));
    console.log(chalk.green("await client.presets.verificationCode(userId, '123456', 'login');"));

    // ==========================================
    // 7. 批量发送
    // ==========================================
    printSection('7. 批量发送');

    printSubSection('批量通知');
    const batchNotifications = [
      {
        user_id: USER_ID,
        channels: ['webhook'] as any,
        custom_content: { content: '批量通知 1/3' },
      },
      {
        user_id: USER_ID,
        channels: ['webhook'] as any,
        custom_content: { content: '批量通知 2/3' },
      },
      {
        user_id: USER_ID,
        channels: ['webhook'] as any,
        custom_content: { content: '批量通知 3/3' },
      },
    ];

    const batchResults = await client.sendBatchNotifications(batchNotifications, {
      concurrency: 2,
      stopOnError: false,
    });
    console.log(`✅ 批量发送完成，成功 ${batchResults.filter(r => r.success).length}/${batchResults.length}`);

    // ==========================================
    // 8. 会话模式
    // ==========================================
    printSection('8. 会话模式');

    printSubSection('创建会话');
    const session = client.createSession(USER_ID);
    console.log('会话已创建，发送连续消息...');

    await session.send('👋 会话消息 1: 开始对话');
    await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟延迟
    await session.send('💬 会话消息 2: 继续对话');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await session.send('👋 会话消息 3: 结束对话');
    console.log('✅ 会话消息发送完成');

    // ==========================================
    // 9. 智能渠道选择
    // ==========================================
    printSection('9. 智能渠道选择');

    printSubSection('配置智能选择器');
    const selector = client.createChannelSelector()
      .prefer('lark')           // 优先使用 Lark
      .fallback('webhook')      // 降级到 Webhook
      .exclude('telegram')      // 排除 Telegram
      .requireActive()          // 只使用已激活的渠道
      .maxChannels(2);          // 最多使用 2 个渠道

    const smartChannels = await selector.select(USER_ID);
    console.log('🎯 智能选择的渠道:', smartChannels.join(', '));

    // 使用选择的渠道发送
    const selectorResult = await client
      .notify()
      .to(USER_ID)
      .via(...smartChannels)
      .content('📡 通过智能选择的渠道发送')
      .send();
    console.log('✅ 发送成功');

    // ==========================================
    // 10. 日志查询
    // ==========================================
    printSection('10. 日志查询');

    printSubSection('查询最近的通知日志');
    const logs = await client.logs.query({
      user_id: USER_ID,
      limit: 5,
    });

    if (logs.success && logs.data) {
      console.log(`找到 ${logs.data.length} 条最近的通知记录：`);
      logs.data.forEach((log, index) => {
        const time = new Date(log.created_at).toLocaleString('zh-CN');
        const status = log.status === 'sent' ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${index + 1}. ${status} ${log.channel_type} - ${time}`);
      });
    }

    // ==========================================
    // 11. 错误处理示例
    // ==========================================
    printSection('11. 错误处理示例');

    printSubSection('优雅的错误处理');
    try {
      await client.smartSend('', '测试消息');
    } catch (error) {
      console.log('✅ 正确捕获了错误:', chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    }

    // ==========================================
    // 12. 清理
    // ==========================================
    printSection('12. 清理测试数据');

    printSubSection('删除测试模板');
    await client.templates.delete(templateKey);
    console.log('✅ 模板已删除');

    printSubSection('删除测试配置');
    await client.configs.delete(USER_ID, 'webhook');
    if (process.env.LARK_WEBHOOK) {
      await client.configs.delete(USER_ID, 'lark');
    }
    console.log('✅ 配置已清理');

    // ==========================================
    // 总结
    // ==========================================
    console.log('\n' + chalk.green('═'.repeat(60)));
    console.log(chalk.green.bold('  🎉 演示完成！'));
    console.log(chalk.green('═'.repeat(60)));

    console.log(chalk.bold('\n📚 SDK 功能总结：'));
    console.log('  1. ' + chalk.cyan('smartSend') + ' - 最简单的发送方式，自动处理配置');
    console.log('  2. ' + chalk.cyan('链式 API') + ' - 优雅的调用方式，支持连续操作');
    console.log('  3. ' + chalk.cyan('快速发送') + ' - 一行代码完成发送');
    console.log('  4. ' + chalk.cyan('预设场景') + ' - 常用通知模板，开箱即用');
    console.log('  5. ' + chalk.cyan('批量发送') + ' - 高效处理大量通知');
    console.log('  6. ' + chalk.cyan('会话模式') + ' - 连续对话场景');
    console.log('  7. ' + chalk.cyan('智能选择') + ' - 自动选择最佳渠道');
    console.log('  8. ' + chalk.cyan('模板管理') + ' - 灵活的内容管理');
    console.log('  9. ' + chalk.cyan('日志查询') + ' - 完整的发送记录');
    console.log('  10. ' + chalk.cyan('错误处理') + ' - 优雅的异常处理');

    console.log(chalk.bold('\n💡 推荐使用方式：'));
    console.log('  - 简单场景：使用 ' + chalk.green('smartSend'));
    console.log('  - 复杂场景：使用 ' + chalk.green('链式 API'));
    console.log('  - 批量场景：使用 ' + chalk.green('批量发送'));
    console.log('  - 对话场景：使用 ' + chalk.green('会话模式'));

    console.log(chalk.gray('\n更多信息请查看文档：https://github.com/your-repo/notification-sdk'));

  } catch (error) {
    console.error(chalk.red('\n❌ 发生错误:'), error);
    process.exit(1);
  }
}

// 运行演示
main().catch(console.error);
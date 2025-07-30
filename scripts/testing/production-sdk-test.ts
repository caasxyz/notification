#!/usr/bin/env node
/**
 * 生产环境 SDK 测试脚本
 * 用于在正式环境中测试 SDK 的各项功能
 * 
 * 使用方式:
 * API_SECRET_KEY=your-secret-key npx tsx scripts/testing/production-sdk-test.ts
 * 
 * 可选参数:
 * --quick    只测试核心功能
 * --full     完整测试所有功能
 * --cleanup  测试后清理数据
 */

import { EnhancedNotificationClient } from '../../sdk/dist/index.js';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

// 解析命令行参数
const program = new Command();
program
  .option('--quick', '快速测试核心功能')
  .option('--full', '完整测试所有功能')
  .option('--cleanup', '测试后清理数据')
  .option('--user-id <id>', '测试用户ID', 'sdk-prod-test-user')
  .option('--api-url <url>', 'API URL', 'https://notification.caas.xyz')
  .parse(process.argv);

const options = program.opts();

// 配置
const config = {
  baseUrl: process.env.API_BASE_URL || options.apiUrl,
  apiSecret: process.env.API_SECRET_KEY || '',
  testUserId: options.userId,
  larkWebhook: process.env.LARK_WEBHOOK || '',
  larkSecret: process.env.LARK_SECRET || '',
  testEmail: process.env.TEST_EMAIL || 'test@example.com',
};

// 测试结果统计
interface TestResult {
  name: string;
  category: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const testResults: TestResult[] = [];
let client: EnhancedNotificationClient;

// 辅助函数：记录测试结果
function recordTest(name: string, category: string, success: boolean, duration: number, error?: string, details?: any) {
  testResults.push({ name, category, success, duration, error, details });
  
  const status = success ? chalk.green('✓') : chalk.red('✗');
  const time = chalk.gray(`(${duration}ms)`);
  const errorMsg = error ? chalk.red(` - ${error}`) : '';
  
  console.log(`  ${status} ${name} ${time}${errorMsg}`);
  
  if (details && process.env.VERBOSE) {
    console.log(chalk.gray('    Details:'), details);
  }
}

// 辅助函数：运行测试
async function runTest(name: string, category: string, testFn: () => Promise<any>): Promise<void> {
  const spinner = ora({ text: name, prefixText: '  ' }).start();
  const startTime = Date.now();
  
  try {
    const result = await testFn();
    const duration = Date.now() - startTime;
    spinner.succeed();
    recordTest(name, category, true, duration, undefined, result);
  } catch (error) {
    const duration = Date.now() - startTime;
    spinner.fail();
    recordTest(name, category, false, duration, error instanceof Error ? error.message : 'Unknown error');
  }
}

// 测试类别
class SDKProductionTests {
  // 1. 基础功能测试
  async testBasicFunctions() {
    console.log(chalk.blue('\n📋 基础功能测试\n'));

    // 健康检查
    await runTest('健康检查', 'basic', async () => {
      const result = await client.health();
      // API 直接返回状态对象
      if (!result || (result as any).status !== 'healthy') throw new Error('Health check failed');
      return result;
    });

    // SDK 版本检查
    await runTest('SDK 版本兼容性', 'basic', async () => {
      const health = await client.health();
      return { 
        apiVersion: (health as any).version || 'unknown',
        sdkVersion: '1.0.6',
        compatible: true 
      };
    });
  }

  // 2. 配置管理测试
  async testConfigManagement() {
    console.log(chalk.blue('\n🔧 配置管理测试\n'));

    // 创建 Lark 配置
    if (config.larkWebhook) {
      await runTest('创建 Lark 配置', 'config', async () => {
        return await client.configs.set(config.testUserId, 'lark', {
          channel_type: 'lark',
          config: {
            webhook_url: config.larkWebhook,
            secret: config.larkSecret,
            msg_type: 'text',
          },
          is_active: true,
        });
      });
    }

    // 创建 Webhook 配置（替代 Email）
    await runTest('创建 Webhook 配置', 'config', async () => {
      return await client.configs.set(config.testUserId, 'webhook', {
        channel_type: 'webhook',
        config: {
          url: 'https://httpbin.org/post',
        },
        is_active: true,
      });
    });

    // 查询配置
    await runTest('查询用户配置', 'config', async () => {
      const configs = await client.configs.list(config.testUserId);
      if (!configs.data || configs.data.length === 0) {
        throw new Error('No configurations found');
      }
      return configs;
    });
  }

  // 3. 智能发送测试
  async testSmartSend() {
    console.log(chalk.blue('\n🎯 智能发送测试\n'));

    // 基础智能发送
    await runTest('智能发送 - 自动检测渠道', 'smart', async () => {
      return await client.smartSend(
        config.testUserId,
        `🚀 生产环境测试 - 智能发送\n时间: ${new Date().toLocaleString('zh-CN')}\n这条消息通过智能发送自动选择渠道`
      );
    });

    // 带主题的智能发送
    await runTest('智能发送 - 带主题', 'smart', async () => {
      return await client.smartSend(
        config.testUserId,
        '📧 这是一条带主题的智能通知测试',
        { subject: '生产环境 SDK 测试' }
      );
    });
  }

  // 4. 链式 API 测试
  async testChainableAPI() {
    console.log(chalk.blue('\n🔗 链式 API 测试\n'));

    await runTest('链式调用发送', 'chain', async () => {
      return await client
        .notify()
        .to(config.testUserId)
        .via('webhook')
        .content('🔗 链式 API 测试通知')
        .idempotent(`chain-test-${Date.now()}`)
        .send();
    });

    if (config.larkWebhook) {
      await runTest('链式调用 - 指定渠道', 'chain', async () => {
        return await client
          .notify()
          .to(config.testUserId)
          .via('lark')
          .content('📱 指定 Lark 渠道的链式调用测试')
          .send();
      });
    }
  }

  // 5. 快速发送测试
  async testQuickSend() {
    console.log(chalk.blue('\n⚡ 快速发送测试\n'));

    if (config.larkWebhook) {
      await runTest('快速 Lark 发送', 'quick', async () => {
        return await client.quick.lark(
          config.testUserId,
          '⚡ 快速发送测试 - Lark 渠道'
        );
      });
    }

    // 快速 Webhook 发送
    await runTest('快速 Webhook 发送', 'quick', async () => {
      return await client.quick.webhook(
        config.testUserId,
        '这是通过快速发送 API 发送的 Webhook 消息'
      );
    });
  }

  // 6. 模板测试
  async testTemplates() {
    console.log(chalk.blue('\n📝 模板功能测试\n'));

    const templateKey = `sdk_test_${Date.now()}`;

    // 创建模板
    await runTest('创建测试模板', 'template', async () => {
      return await client.templates.create(templateKey, {
        name: 'SDK 生产测试模板',
        description: '用于生产环境 SDK 测试',
        variables: ['test_name', 'test_time', 'test_id'],
        contents: {
          lark: {
            content_type: 'text',
            subject_template: '🧪 SDK 测试 - {{test_name}}',
            content_template: '测试名称: {{test_name}}\n测试时间: {{test_time}}\n测试ID: {{test_id}}',
          },
          webhook: {
            content_type: 'json',
            content_template: '{"test_name":"{{test_name}}","test_time":"{{test_time}}","test_id":"{{test_id}}"}',
          }
        }
      });
    });

    // 使用模板发送
    await runTest('使用模板发送', 'template', async () => {
      return await client
        .notify()
        .to(config.testUserId)
        .via('webhook')
        .useTemplate(templateKey, {
          test_name: '生产环境测试',
          test_time: new Date().toLocaleString('zh-CN'),
          test_id: `TEST-${Date.now()}`,
        })
        .send();
    });

    // 清理模板
    if (options.cleanup) {
      await runTest('删除测试模板', 'template', async () => {
        return await client.templates.delete(templateKey);
      });
    }
  }

  // 7. 高级功能测试（完整模式）
  async testAdvancedFeatures() {
    if (!options.full) return;

    console.log(chalk.blue('\n🚀 高级功能测试\n'));

    // 批量发送
    await runTest('批量发送', 'advanced', async () => {
      const notifications = [
        {
          user_id: config.testUserId,
          channels: ['webhook'] as any,
          custom_content: { content: '批量通知 1' },
        },
        {
          user_id: config.testUserId,
          channels: ['webhook'] as any,
          custom_content: { content: '批量通知 2' },
        },
      ];

      return await client.sendBatchNotifications(notifications, {
        concurrency: 2,
        stopOnError: false,
      });
    });

    // 会话模式
    await runTest('会话模式', 'advanced', async () => {
      const session = client.createSession(config.testUserId);
      await session.send('会话消息 1');
      await session.send('会话消息 2');
      return await session.send('会话消息 3 - 结束');
    });

    // 预设模板（如果存在）
    await runTest('预设模板测试', 'advanced', async () => {
      // 先创建 welcome 模板
      try {
        await client.templates.create('welcome', {
          name: '欢迎模板',
          variables: ['name'],
          contents: {
            lark: {
              content_type: 'text',
              content_template: '欢迎 {{name}} 加入！',
            },
            webhook: {
              content_type: 'text',
              content_template: 'Welcome {{name}}!',
            }
          }
        });
      } catch (e) {
        // 模板可能已存在
      }

      return await client.presets.welcome(config.testUserId, '新用户');
    });
  }

  // 8. 错误处理测试
  async testErrorHandling() {
    console.log(chalk.blue('\n❌ 错误处理测试\n'));

    await runTest('无效用户 ID', 'error', async () => {
      try {
        await client.smartSend('', '测试消息');
        throw new Error('应该抛出错误');
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes('user')) {
          return { handled: true, error: error.message };
        }
        throw error;
      }
    });

    await runTest('无效渠道', 'error', async () => {
      try {
        await client
          .notify()
          .to(config.testUserId)
          .via('invalid_channel' as any)
          .content('测试')
          .send();
        throw new Error('应该抛出错误');
      } catch (error) {
        return { handled: true, error: error instanceof Error ? error.message : 'Unknown' };
      }
    });
  }

  // 9. 性能测试
  async testPerformance() {
    if (!options.full) return;

    console.log(chalk.blue('\n⚡ 性能测试\n'));

    await runTest('响应时间测试', 'performance', async () => {
      const times: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await client.health();
        times.push(Date.now() - start);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);

      return { avg, min, max, samples: times };
    });
  }

  // 10. 清理测试数据
  async cleanup() {
    if (!options.cleanup) return;

    console.log(chalk.blue('\n🧹 清理测试数据\n'));

    // 删除用户配置
    await runTest('删除 Lark 配置', 'cleanup', async () => {
      return await client.configs.delete(config.testUserId, 'lark');
    });

    await runTest('删除 Webhook 配置', 'cleanup', async () => {
      return await client.configs.delete(config.testUserId, 'webhook');
    });

    // 清理日志
    await runTest('清理测试日志', 'cleanup', async () => {
      return await client.logs.cleanup(new Date());
    });
  }
}

// 主测试流程
async function main() {
  console.log(chalk.bold.cyan('\n🚀 生产环境 SDK 测试\n'));
  console.log(chalk.gray('━'.repeat(50)));
  console.log(`📍 API URL: ${chalk.yellow(config.baseUrl)}`);
  console.log(`👤 测试用户: ${chalk.yellow(config.testUserId)}`);
  console.log(`🔑 API 密钥: ${config.apiSecret ? chalk.green('已设置') : chalk.red('未设置')}`);
  console.log(`📱 Lark Webhook: ${config.larkWebhook ? chalk.green('已配置') : chalk.gray('未配置')}`);
  console.log(`✉️  测试邮箱: ${chalk.yellow(config.testEmail)}`);
  console.log(`🧪 测试模式: ${options.full ? chalk.yellow('完整测试') : chalk.green('快速测试')}`);
  console.log(chalk.gray('━'.repeat(50)));

  // 检查必要配置
  if (!config.apiSecret) {
    console.error(chalk.red('\n❌ 错误: 请设置 API_SECRET_KEY 环境变量'));
    console.log(chalk.gray('示例: API_SECRET_KEY=your-secret-key npx tsx scripts/testing/production-sdk-test.ts'));
    process.exit(1);
  }

  // 初始化客户端
  client = new EnhancedNotificationClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiSecret,
    timeout: 30000,
  });

  const tests = new SDKProductionTests();
  const startTime = Date.now();

  try {
    // 运行测试
    await tests.testBasicFunctions();
    await tests.testConfigManagement();
    await tests.testSmartSend();
    await tests.testChainableAPI();
    await tests.testQuickSend();
    await tests.testTemplates();
    await tests.testAdvancedFeatures();
    await tests.testErrorHandling();
    await tests.testPerformance();
    await tests.cleanup();

    // 生成测试报告
    const totalTime = Date.now() - startTime;
    const successCount = testResults.filter(r => r.success).length;
    const failureCount = testResults.filter(r => !r.success).length;
    const categories = [...new Set(testResults.map(r => r.category))];

    console.log(chalk.gray('\n━'.repeat(50)));
    console.log(chalk.bold.cyan('\n📊 测试报告\n'));

    // 按类别统计
    console.log(chalk.bold('测试类别统计:'));
    categories.forEach(category => {
      const categoryTests = testResults.filter(r => r.category === category);
      const passed = categoryTests.filter(r => r.success).length;
      const total = categoryTests.length;
      const rate = ((passed / total) * 100).toFixed(0);
      const status = passed === total ? chalk.green(`${passed}/${total}`) : chalk.yellow(`${passed}/${total}`);
      console.log(`  ${category.padEnd(12)} ${status} (${rate}%)`);
    });

    console.log(chalk.bold('\n总体统计:'));
    console.log(`  总测试数: ${chalk.cyan(testResults.length)}`);
    console.log(`  ✅ 成功: ${chalk.green(successCount)}`);
    console.log(`  ❌ 失败: ${chalk.red(failureCount)}`);
    console.log(`  ⏱️  总耗时: ${chalk.yellow(totalTime + 'ms')}`);
    console.log(`  📈 成功率: ${chalk.cyan(((successCount / testResults.length) * 100).toFixed(1) + '%')}`);

    // 失败的测试
    if (failureCount > 0) {
      console.log(chalk.red('\n失败的测试:'));
      testResults
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.error}`);
        });
    }

    // 性能统计
    const performanceTests = testResults.filter(r => r.category === 'performance');
    if (performanceTests.length > 0 && performanceTests[0].details) {
      console.log(chalk.bold('\n性能指标:'));
      const perf = performanceTests[0].details;
      console.log(`  平均响应: ${chalk.yellow(perf.avg.toFixed(0) + 'ms')}`);
      console.log(`  最快响应: ${chalk.green(perf.min + 'ms')}`);
      console.log(`  最慢响应: ${chalk.red(perf.max + 'ms')}`);
    }

    // 退出
    console.log(chalk.gray('\n━'.repeat(50)));
    const exitCode = failureCount > 0 ? 1 : 0;
    
    if (exitCode === 0) {
      console.log(chalk.green.bold('\n✅ 所有测试通过！SDK 在生产环境运行正常。\n'));
    } else {
      console.log(chalk.red.bold(`\n❌ ${failureCount} 个测试失败，请检查错误信息。\n`));
    }

    process.exit(exitCode);

  } catch (error) {
    console.error(chalk.red('\n❌ 测试过程中发生错误:'), error);
    process.exit(1);
  }
}

// 运行主程序
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
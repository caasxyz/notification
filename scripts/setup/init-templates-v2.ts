const API_URL = 'http://localhost:8788/api/v1/templates';
const API_SECRET = 'test-secret-key-for-development';

const templates = [
  {
    template_key: 'welcome',
    template_name: '欢迎消息',
    description: '新用户欢迎通知模板',
    variables: ['username'],
    channels: [
      {
        channel_type: 'lark',
        content_type: 'text',
        subject_template: '欢迎加入',
        content_template: '欢迎 {{username}}！\n\n感谢您的加入，我们很高兴您能成为我们的一员。\n\n如有任何问题，请随时联系我们。'
      },
      {
        channel_type: 'webhook',
        content_type: 'json',
        content_template: JSON.stringify({
          type: 'welcome',
          message: '欢迎 {{username}} 加入我们！',
          timestamp: '{{timestamp}}'
        }, null, 2)
      },
      {
        channel_type: 'telegram',
        content_type: 'markdown',
        content_template: '🎉 *欢迎加入*\n\n欢迎 {{username}}！\n\n我们很高兴您能成为我们的一员。'
      },
      {
        channel_type: 'slack',
        content_type: 'markdown',
        content_template: ':wave: *欢迎 {{username}}!*\n\n感谢您的加入，期待与您的合作！'
      }
    ]
  },
  {
    template_key: 'alert',
    template_name: '系统告警',
    description: '系统告警通知模板',
    variables: ['level', 'message', 'time'],
    channels: [
      {
        channel_type: 'lark',
        content_type: 'text',
        subject_template: '⚠️ 系统告警',
        content_template: '告警级别：{{level}}\n告警内容：{{message}}\n发生时间：{{time}}\n\n请及时处理！'
      },
      {
        channel_type: 'webhook',
        content_type: 'json',
        content_template: JSON.stringify({
          type: 'alert',
          level: '{{level}}',
          message: '{{message}}',
          time: '{{time}}',
          urgent: true
        }, null, 2)
      },
      {
        channel_type: 'telegram',
        content_type: 'markdown',
        content_template: '🚨 *系统告警*\n\n*级别:* {{level}}\n*内容:* {{message}}\n*时间:* {{time}}'
      },
      {
        channel_type: 'slack',
        content_type: 'markdown',
        content_template: ':warning: *系统告警*\n\n*级别:* {{level}}\n*内容:* {{message}}\n*时间:* {{time}}'
      }
    ]
  },
  {
    template_key: 'report',
    template_name: '报告通知',
    description: '各类报告通知模板',
    variables: ['report_type', 'date_range', 'summary'],
    channels: [
      {
        channel_type: 'lark',
        content_type: 'text',
        subject_template: '📊 {{report_type}}报告',
        content_template: '报告类型：{{report_type}}\n时间范围：{{date_range}}\n\n主要数据：\n{{summary}}\n\n详细报告请查看附件或系统。'
      },
      {
        channel_type: 'webhook',
        content_type: 'html',
        subject_template: '{{report_type}}报告 - {{date_range}}',
        content_template: '<h2>{{report_type}}报告</h2><p><strong>时间范围：</strong>{{date_range}}</p><div>{{summary}}</div>'
      },
      {
        channel_type: 'slack',
        content_type: 'markdown',
        content_template: '*{{report_type}}报告*\n\n*时间范围：* {{date_range}}\n\n{{summary}}'
      }
    ]
  }
];

async function createTemplate(template: any) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Secret': API_SECRET,
      },
      body: JSON.stringify(template),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ 创建模板成功: ${template.template_key}`);
      console.log(`   支持渠道: ${template.channels.map(c => c.channel_type).join(', ')}`);
    } else {
      console.log(`❌ 创建模板失败: ${template.template_key} - ${result.error}`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ 请求错误: ${template.template_key}`, error);
    return { success: false, error: error.message };
  }
}

async function initTemplatesV2() {
  console.log('🚀 初始化通知模板 V2...\n');
  console.log('新的模板架构特点：');
  console.log('- 一个模板可以支持多个渠道');
  console.log('- 每个渠道可以有不同的内容格式和模板');
  console.log('- 统一的模板管理\n');
  
  console.log(`将创建 ${templates.length} 个模板\n`);
  
  const results = [];
  for (const template of templates) {
    const result = await createTemplate(template);
    results.push(result);
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 统计结果
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log('\n✨ 模板初始化完成！');
  console.log(`成功: ${successCount}, 失败: ${failCount}`);
  
  if (successCount > 0) {
    console.log('\n📋 可用的模板：');
    templates.forEach(t => {
      console.log(`\n- ${t.template_key}: ${t.template_name}`);
      console.log(`  描述: ${t.description}`);
      console.log(`  变量: ${t.variables.join(', ')}`);
      console.log(`  支持渠道: ${t.channels.map(c => c.channel_type).join(', ')}`);
    });
  }
}

initTemplatesV2().catch(console.error);
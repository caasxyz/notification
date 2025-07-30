-- 初始化本地开发数据库 V2

-- 插入测试用户配置
INSERT OR REPLACE INTO user_configs (user_id, channel_type, config_data, is_active) 
VALUES 
  ('test-user', 'webhook', '{"webhook_url":"https://webhook.site/test"}', 1),
  ('test-user', 'telegram', '{"bot_token":"test-bot-token","chat_id":"123456"}', 1),
  ('demo-user', 'slack', '{"webhook_url":"https://hooks.slack.com/services/TEST/DEMO/webhook"}', 1),
  ('demo-user', 'lark', '{"webhook_url":"https://open.feishu.cn/open-apis/bot/v2/hook/test"}', 1),
  ('rei', 'lark', '{"webhook_url":"https://open.larksuite.com/open-apis/bot/v2/hook/bdcd6bf2-72cc-4726-9b31-43f02c521144","secret":"XHBRWk8VLLle4jfCSksF5c"}', 1);

-- 插入测试模板 (V2 架构)
-- 首先插入模板基本信息
INSERT OR REPLACE INTO notification_templates_v2 (
  template_key, 
  template_name, 
  description,
  variables,
  is_active
) VALUES 
  ('welcome', 'Welcome Message', 'Welcome message for new users', '["username"]', 1),
  ('alert', 'System Alert', 'System alert notifications', '["alert_type","message","timestamp"]', 1),
  ('report', 'Daily Report', 'Daily report template', '["date","total_events","success_rate"]', 1),
  ('test', 'Test Template', 'Test template for development', '["name","value"]', 1);

-- 然后插入各渠道的模板内容
-- Welcome templates
INSERT OR REPLACE INTO template_contents (
  template_key,
  channel_type,
  subject_template,
  content_template,
  content_type
) VALUES 
  ('welcome', 'webhook', 'Welcome {{username}}!', 'Hello {{username}}, welcome to our notification service! Your account has been created successfully.', 'text'),
  ('welcome', 'telegram', NULL, 'Welcome {{username}}! 🎉\n\nYour account has been created successfully.', 'text'),
  ('welcome', 'lark', 'Welcome {{username}}!', '{"msg_type":"text","content":{"text":"Welcome {{username}}! 🎉\\n\\nYour account has been created successfully."}}', 'json'),
  ('welcome', 'slack', NULL, ':wave: Welcome {{username}}!\n\nYour account has been created successfully.', 'markdown');

-- Alert templates
INSERT OR REPLACE INTO template_contents (
  template_key,
  channel_type,
  subject_template,
  content_template,
  content_type
) VALUES 
  ('alert', 'webhook', 'Alert: {{alert_type}}', 'System alert detected:\nType: {{alert_type}}\nMessage: {{message}}\nTime: {{timestamp}}', 'text'),
  ('alert', 'telegram', NULL, '⚠️ *System Alert*\n\nType: {{alert_type}}\nMessage: {{message}}\nTime: {{timestamp}}', 'markdown'),
  ('alert', 'lark', 'Alert: {{alert_type}}', '{"msg_type":"text","content":{"text":"⚠️ System Alert\\n\\nType: {{alert_type}}\\nMessage: {{message}}\\nTime: {{timestamp}}"}}', 'json'),
  ('alert', 'slack', NULL, ':warning: *System Alert*\n\n*Type:* {{alert_type}}\n*Message:* {{message}}\n*Time:* {{timestamp}}', 'markdown');

-- Report templates
INSERT OR REPLACE INTO template_contents (
  template_key,
  channel_type,
  subject_template,
  content_template,
  content_type
) VALUES 
  ('report', 'webhook', 'Daily Report - {{date}}', '<h1>Daily Report</h1><p>Date: {{date}}</p><p>Total events: {{total_events}}</p><p>Success rate: {{success_rate}}%</p>', 'html'),
  ('report', 'telegram', NULL, '*Daily Report - {{date}}*\n\nTotal events: {{total_events}}\nSuccess rate: {{success_rate}}%', 'markdown'),
  ('report', 'lark', 'Daily Report - {{date}}', '{"msg_type":"text","content":{"text":"📊 Daily Report - {{date}}\\n\\nTotal events: {{total_events}}\\nSuccess rate: {{success_rate}}%"}}', 'json');

-- Test templates
INSERT OR REPLACE INTO template_contents (
  template_key,
  channel_type,
  subject_template,
  content_template,
  content_type
) VALUES 
  ('test', 'webhook', 'Test Message', 'This is a test message. Name: {{name}}, Value: {{value}}', 'text'),
  ('test', 'telegram', NULL, 'Test message: {{name}} = {{value}}', 'text'),
  ('test', 'lark', 'Test Message', '{"msg_type":"text","content":{"text":"Test message: {{name}} = {{value}}"}}', 'json'),
  ('test', 'slack', NULL, 'Test message: *{{name}}* = `{{value}}`', 'markdown');

-- 插入一些测试日志
INSERT OR REPLACE INTO notification_logs (
  message_id,
  user_id,
  channel_type,
  status,
  template_key,
  subject,
  content,
  retry_count,
  created_at,
  sent_at
) VALUES 
  ('test-msg-v2-001', 'test-user', 'webhook', 'sent', 'welcome', 'Welcome TestUser!', 'Hello TestUser, welcome to our notification service!', 0, datetime('now', '-1 hour'), datetime('now', '-1 hour')),
  ('test-msg-v2-002', 'test-user', 'telegram', 'failed', 'alert', NULL, 'System alert detected: High CPU usage', 1, datetime('now', '-30 minutes'), NULL),
  ('test-msg-v2-003', 'demo-user', 'slack', 'sent', 'report', 'Daily Report - 2024-01-01', 'Total events: 1000, Success rate: 98.5%', 0, datetime('now', '-2 hours'), datetime('now', '-2 hours'));

-- 查看插入的数据
SELECT '=== User Configs ===' as title;
SELECT * FROM user_configs;

SELECT '=== Notification Templates V2 ===' as title;
SELECT template_key, template_name, description, is_active FROM notification_templates_v2;

SELECT '=== Template Contents ===' as title;
SELECT template_key, channel_type, content_type FROM template_contents ORDER BY template_key, channel_type;

SELECT '=== Recent Logs ===' as title;
SELECT message_id, user_id, channel_type, status, created_at FROM notification_logs ORDER BY created_at DESC LIMIT 5;
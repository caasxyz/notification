-- Test data for V2 notification system

-- Insert test user configurations
INSERT OR REPLACE INTO user_configs (user_id, channel_type, config_data, is_active) 
VALUES 
  ('test-user', 'webhook', '{"webhook_url":"https://webhook.site/test"}', 1),
  ('test-user', 'telegram', '{"bot_token":"test-bot-token","chat_id":"123456"}', 1),
  ('test-user', 'lark', '{"webhook_url":"https://open.feishu.cn/open-apis/bot/v2/hook/test","secret":"test-secret"}', 1),
  ('demo-user', 'slack', '{"webhook_url":"https://hooks.slack.com/services/TEST/DEMO/webhook"}', 1),
  ('demo-user', 'email', '{"smtp_host":"smtp.example.com","smtp_port":587,"username":"demo@example.com","password":"demo-password"}', 1);

-- Insert V2 test templates
-- 1. Insert template definitions
INSERT OR REPLACE INTO notification_templates_v2 (template_key, template_name, description, variables, is_active) 
VALUES 
  ('welcome', 'Welcome Message', 'Welcome message for new users', '["username"]', 1),
  ('alert', 'System Alert', 'System alert notifications', '["alert_type","message","timestamp"]', 1),
  ('report', 'Daily Report', 'Daily report template', '["date","total_events","success_rate"]', 1),
  ('test', 'Test Template', 'Test template for development', '["name","value"]', 1);

-- 2. Insert template contents for each channel
-- Welcome templates
INSERT OR REPLACE INTO template_contents (template_key, channel_type, subject_template, content_template, content_type) VALUES
  ('welcome', 'webhook', 'Welcome {{username}}!', 'Hello {{username}}, welcome to our notification service!', 'text'),
  ('welcome', 'telegram', NULL, 'Welcome {{username}}! 🎉\n\nYour account has been created successfully.', 'text'),
  ('welcome', 'lark', 'Welcome!', '**Welcome {{username}}!**\n\nYour account is ready to use.', 'markdown'),
  ('welcome', 'email', 'Welcome to Our Service, {{username}}!', '<h1>Welcome {{username}}!</h1><p>Thank you for joining us.</p>', 'html');

-- Alert templates
INSERT OR REPLACE INTO template_contents (template_key, channel_type, subject_template, content_template, content_type) VALUES
  ('alert', 'webhook', 'Alert: {{alert_type}}', 'Alert Type: {{alert_type}}\nMessage: {{message}}\nTime: {{timestamp}}', 'text'),
  ('alert', 'telegram', NULL, '🚨 *Alert: {{alert_type}}*\n\n{{message}}\n\n_Time: {{timestamp}}_', 'markdown'),
  ('alert', 'lark', 'System Alert', '**Alert Type:** {{alert_type}}\n**Message:** {{message}}\n**Time:** {{timestamp}}', 'markdown'),
  ('alert', 'slack', NULL, ':warning: *System Alert*\n\n*Type:* {{alert_type}}\n*Message:* {{message}}\n*Time:* {{timestamp}}', 'markdown');

-- Report templates  
INSERT OR REPLACE INTO template_contents (template_key, channel_type, subject_template, content_template, content_type) VALUES
  ('report', 'webhook', 'Daily Report - {{date}}', 'Date: {{date}}\nTotal Events: {{total_events}}\nSuccess Rate: {{success_rate}}%', 'text'),
  ('report', 'email', 'Daily Report for {{date}}', '<h2>Daily Report</h2><p>Date: {{date}}</p><p>Total events: {{total_events}}</p><p>Success rate: {{success_rate}}%</p>', 'html');

-- Test template
INSERT OR REPLACE INTO template_contents (template_key, channel_type, content_template, content_type) VALUES
  ('test', 'webhook', 'Test: {{name}} = {{value}}', 'text'),
  ('test', 'lark', '**Test Message**\n{{name}}: {{value}}', 'markdown');
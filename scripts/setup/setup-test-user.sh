#!/bin/bash

# 设置测试用户的配置

echo "📝 Setting up test user configurations..."

# 创建测试用户的 Webhook 配置
echo "Creating webhook config for test-user..."
npx wrangler d1 execute notification-system --local --command "
INSERT OR REPLACE INTO user_configs (user_id, channel_type, config_data, is_active) 
VALUES ('test-user', 'webhook', '{\"webhook_url\":\"https://webhook.site/your-unique-id\"}', 1);
"

# 创建测试用户的 Lark 配置（需要替换为真实的 webhook URL）
echo "Creating lark config for test-user..."
echo "⚠️  请替换下面的 webhook URL 为你的真实 Lark webhook URL"
npx wrangler d1 execute notification-system --local --command "
INSERT OR REPLACE INTO user_configs (user_id, channel_type, config_data, is_active) 
VALUES ('test-user', 'lark', '{\"webhook_url\":\"https://open.feishu.cn/open-apis/bot/v2/hook/YOUR-LARK-WEBHOOK-ID\"}', 1);
"

# 创建测试用户的 Telegram 配置（示例）
echo "Creating telegram config for test-user..."
npx wrangler d1 execute notification-system --local --command "
INSERT OR REPLACE INTO user_configs (user_id, channel_type, config_data, is_active) 
VALUES ('test-user', 'telegram', '{\"bot_token\":\"123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi\",\"chat_id\":\"123456789\"}', 1);
"

# 创建测试用户的 Slack 配置（示例）
echo "Creating slack config for test-user..."
npx wrangler d1 execute notification-system --local --command "
INSERT OR REPLACE INTO user_configs (user_id, channel_type, config_data, is_active) 
VALUES ('test-user', 'slack', '{\"webhook_url\":\"https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX\"}', 1);
"

echo "✅ Test user configurations created!"
echo ""
echo "📌 重要提示："
echo "1. 请通过 http://localhost:8788/test-ui 访问测试界面"
echo "2. 在 '用户配置' 标签页中更新 Lark webhook URL 为你的真实地址"
echo "3. API 密钥已自动填充为: test-secret-key-for-development"
echo ""
echo "🔗 获取 Lark Webhook URL 的方法："
echo "1. 登录飞书开放平台: https://open.feishu.cn"
echo "2. 创建或选择一个应用"
echo "3. 在应用功能中添加机器人"
echo "4. 获取 Webhook 地址"
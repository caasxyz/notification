#!/bin/bash

echo "📊 数据库状态报告"
echo "=================="
echo ""

# 检查表
echo "📋 数据库表："
npx wrangler d1 execute notification-system --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" 2>/dev/null | grep -o '"name": "[^"]*"' | cut -d'"' -f4 | while read table; do
    echo "  ✓ $table"
done

echo ""
echo "📈 数据统计："

# 用户配置数
count=$(npx wrangler d1 execute notification-system --local --command "SELECT COUNT(*) as count FROM user_configs" 2>/dev/null | grep -o '"count": [0-9]*' | cut -d' ' -f2)
echo "  • 用户配置: ${count:-0} 条"

# 通知模板数
count=$(npx wrangler d1 execute notification-system --local --command "SELECT COUNT(*) as count FROM notification_templates" 2>/dev/null | grep -o '"count": [0-9]*' | cut -d' ' -f2)
echo "  • 通知模板: ${count:-0} 条"

# 通知日志数
count=$(npx wrangler d1 execute notification-system --local --command "SELECT COUNT(*) as count FROM notification_logs" 2>/dev/null | grep -o '"count": [0-9]*' | cut -d' ' -f2)
echo "  • 通知日志: ${count:-0} 条"

echo ""
echo "✅ 状态检查完成"
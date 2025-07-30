#!/bin/bash

# 检查数据库是否已初始化
# 通过查询 user_configs 表来判断

# 执行查询，如果表存在且有数据，返回 0，否则返回 1
npx wrangler d1 execute notification-system --local --command "SELECT COUNT(*) as count FROM user_configs" 2>/dev/null | grep -q "count" && echo "initialized" || echo "not_initialized"
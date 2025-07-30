#!/bin/bash

echo "🚀 通知系统本地开发快速启动（简化版）"
echo "================================="

# 检查 Node.js 版本
echo "检查 Node.js 版本..."
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ 需要 Node.js 18 或更高版本"
    exit 1
fi
echo "✅ Node.js 版本符合要求"

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
else
    echo "✅ 依赖已安装"
fi

# 创建环境变量文件
if [ ! -f ".dev.vars" ]; then
    echo "📝 创建本地环境变量文件..."
    cat > .dev.vars << EOF
API_SECRET_KEY=test-secret-key-for-local-dev
ENCRYPT_KEY=test-encryption-key-32-characters
EOF
    echo "✅ 环境变量文件已创建"
else
    echo "✅ 环境变量文件已存在"
fi

# 初始化数据库
echo "🗄️  初始化本地数据库..."
npm run db:setup
if [ $? -ne 0 ]; then
    echo "❌ 数据库初始化失败"
    exit 1
fi
echo "✅ 数据库初始化成功"

# 跳过类型检查，直接启动
echo ""
echo "🎉 准备就绪！正在启动开发服务器..."
echo ""
echo "⚠️  注意：已跳过类型检查，如需运行类型检查请使用: npm run typecheck"
echo ""
echo "📌 可用的命令："
echo "   npm run dev          - 启动开发服务器"
echo "   npm run dev:init-db  - 初始化测试数据"
echo "   npm run test:local   - 运行本地测试脚本"
echo "   npm test            - 运行单元测试"
echo "   npm run test:ui     - 打开测试 UI"
echo ""
echo "📖 查看 docs/local-development.md 了解更多信息"
echo ""
echo "启动开发服务器..."
npm run dev
#!/bin/bash

# 发布 SDK 到 GitHub Packages 的脚本

set -e

echo "=== 发布 SDK 到 GitHub Packages ==="
echo

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "sdk/package.json" ]; then
    echo -e "${RED}错误：请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 检查版本参数
VERSION=$1
if [ -z "$VERSION" ]; then
    echo "用法: $0 <version>"
    echo "示例: $0 1.0.0"
    echo "      $0 1.0.1-beta.1"
    exit 1
fi

# 验证版本格式
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
    echo -e "${RED}错误：版本格式无效。应该类似: 1.0.0 或 1.0.0-beta.1${NC}"
    exit 1
fi

# 检查 GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${YELLOW}警告：未找到 GITHUB_TOKEN 环境变量${NC}"
    echo "您可以通过以下方式设置："
    echo "  export GITHUB_TOKEN=your_github_personal_access_token"
    echo
    echo "或者创建 .npmrc 文件手动配置"
    echo
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

cd sdk

echo "1. 清理构建目录..."
npm run clean

echo
echo "2. 安装依赖..."
npm ci

echo
echo "3. 运行测试..."
npm test

echo
echo "4. 构建 SDK..."
npm run build

echo
echo "5. 配置 GitHub Packages..."

# 备份原始 package.json
cp package.json package.json.bak

# 创建临时的 package.json 用于 GitHub Packages
node -e "
const fs = require('fs');
const pkg = require('./package.json');

// 使用 @caasxyz scope 用于 GitHub Packages
pkg.name = '@caasxyz/notification-sdk';

// 添加 publishConfig
pkg.publishConfig = {
  registry: 'https://npm.pkg.github.com'
};

fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
console.log('✅ 已配置 package.json for GitHub Packages');
"

# 设置版本
echo
echo "6. 设置版本为 $VERSION..."
npm version $VERSION --no-git-tag-version

# 创建 .npmrc 如果需要
if [ ! -z "$GITHUB_TOKEN" ]; then
    echo
    echo "7. 配置认证..."
    echo "@caasxyz:registry=https://npm.pkg.github.com" > .npmrc
    echo "//npm.pkg.github.com/:_authToken=$GITHUB_TOKEN" >> .npmrc
    echo -e "${GREEN}✅ 已配置认证${NC}"
fi

echo
echo "8. 发布到 GitHub Packages..."
echo

# 显示即将发布的信息
echo "即将发布："
echo "  包名: @caasxyz/notification-sdk"
echo "  版本: $VERSION"
echo "  仓库: https://npm.pkg.github.com"
echo

read -p "确认发布？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "取消发布"
    # 恢复原始 package.json
    mv package.json.bak package.json
    rm -f .npmrc
    exit 1
fi

# 发布
if npm publish --registry=https://npm.pkg.github.com; then
    echo
    echo -e "${GREEN}✅ 发布成功！${NC}"
    echo
    echo "包已发布到 GitHub Packages:"
    echo "  https://github.com/caasxyz/notification/packages"
    echo
    echo "安装方法："
    echo "  1. 创建 .npmrc 文件："
    echo "     @caasxyz:registry=https://npm.pkg.github.com"
    echo "     //npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN"
    echo
    echo "  2. 安装包："
    echo "     npm install @caasxyz/notification-sdk@$VERSION"
else
    echo -e "${RED}❌ 发布失败${NC}"
    # 恢复原始 package.json
    mv package.json.bak package.json
    rm -f .npmrc
    exit 1
fi

# 恢复原始 package.json
echo
echo "9. 清理..."
mv package.json.bak package.json
rm -f .npmrc

# 提交版本标签（可选）
echo
read -p "是否创建并推送 Git 标签 sdk-v$VERSION？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd ..
    git tag -a "sdk-v$VERSION" -m "Release SDK v$VERSION to GitHub Packages"
    git push origin "sdk-v$VERSION"
    echo -e "${GREEN}✅ 已创建并推送标签${NC}"
fi

echo
echo "=== 完成！==="
#!/bin/bash

echo "🔒 清理敏感文件..."

# 如果这些文件已经被跟踪，从 git 中移除它们
files_to_remove=(
    "notification.db"
    "wrangler.toml"
    "*.db"
    ".dev.vars"
)

for file in "${files_to_remove[@]}"; do
    if git ls-files --error-unmatch "$file" 2>/dev/null; then
        echo "📌 从 git 中移除: $file"
        git rm --cached "$file"
    fi
done

# 检查是否有需要提交的更改
if [[ -n $(git status --porcelain) ]]; then
    echo "⚠️  发现需要提交的更改"
    echo "请运行以下命令提交更改："
    echo "git commit -m 'chore: remove sensitive files from tracking'"
else
    echo "✅ 没有敏感文件被 git 跟踪"
fi

echo ""
echo "📋 当前 .gitignore 中的数据库相关规则："
grep -A5 "# Database files" .gitignore

echo ""
echo "🔍 检查本地敏感文件："
ls -la *.db 2>/dev/null || echo "没有找到 .db 文件"
ls -la wrangler.toml 2>/dev/null || echo "没有找到 wrangler.toml"
ls -la .dev.vars 2>/dev/null || echo "没有找到 .dev.vars"
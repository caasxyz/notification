#!/bin/bash

# 测试脚本 - 用于本地测试通知系统 API

API_URL="http://localhost:8787"
SECRET_KEY="test-secret-key-for-development"

# 生成签名的函数
generate_signature() {
    local timestamp=$1
    local body=$2
    local payload="${timestamp}${body}"
    
    # 使用 openssl 生成 HMAC-SHA256 签名
    echo -n "$payload" | openssl dgst -sha256 -hmac "$SECRET_KEY" -hex | cut -d' ' -f2
}

# 获取当前时间戳（毫秒）
get_timestamp() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        echo $(($(date +%s) * 1000))
    else
        # Linux
        echo $(($(date +%s%N) / 1000000))
    fi
}

echo "🧪 通知系统本地测试脚本"
echo "======================="
echo ""

# 1. 测试健康检查
echo "1️⃣ 测试健康检查端点..."
curl -s "$API_URL/health" | jq .
echo ""

# 2. 测试指标端点
echo "2️⃣ 测试指标端点..."
curl -s "$API_URL/metrics?days=7" | jq .
echo ""

# 3. 测试发送通知 - 使用模板
echo "3️⃣ 测试发送通知（使用模板）..."
TIMESTAMP=$(get_timestamp)
BODY='{
  "user_id": "test_user_001",
  "channels": ["webhook"],
  "template_key": "welcome_message",
  "variables": {
    "username": "测试用户"
  },
  "idempotency_key": "test-'$TIMESTAMP'"
}'

SIGNATURE=$(generate_signature "$TIMESTAMP" "$BODY")

curl -X POST "$API_URL/api/notifications/send" \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -d "$BODY" | jq .
echo ""

# 4. 测试发送通知 - 自定义内容
echo "4️⃣ 测试发送通知（自定义内容）..."
TIMESTAMP=$(get_timestamp)
BODY='{
  "user_id": "test_user_001",
  "channels": ["webhook", "telegram"],
  "custom_content": {
    "subject": "测试通知",
    "content": "这是一条测试通知消息，时间：'$(date)'"
  }
}'

SIGNATURE=$(generate_signature "$TIMESTAMP" "$BODY")

curl -X POST "$API_URL/api/notifications/send" \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -d "$BODY" | jq .
echo ""

# 5. 测试无效签名
echo "5️⃣ 测试无效签名（应该返回 401）..."
curl -X POST "$API_URL/api/notifications/send" \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: invalid-signature" \
  -d "$BODY" | jq .
echo ""

# 6. 测试过期请求
echo "6️⃣ 测试过期请求（应该返回 401）..."
OLD_TIMESTAMP=$(($(get_timestamp) - 600000))  # 10 分钟前
BODY='{
  "user_id": "test_user_001",
  "channels": ["webhook"],
  "custom_content": {
    "content": "过期的请求"
  }
}'

SIGNATURE=$(generate_signature "$OLD_TIMESTAMP" "$BODY")

curl -X POST "$API_URL/api/notifications/send" \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $OLD_TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -d "$BODY" | jq .
echo ""

echo "✅ 测试完成！"
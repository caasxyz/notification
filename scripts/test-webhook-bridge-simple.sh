#!/bin/bash

# Simple test script for webhook bridge
BASE_URL="${1:-http://localhost:8788}"
USER_ID="${2:-test-user}"
CHANNEL="${3:-webhook}"

echo "Testing webhook bridge..."
echo "URL: $BASE_URL/web_hook/bridge/$USER_ID/$CHANNEL"
echo ""

# Test with simple JSON
echo "Sending test notification..."
curl -X POST "$BASE_URL/web_hook/bridge/$USER_ID/$CHANNEL" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test from webhook bridge",
    "message": "This is a test notification at '"$(date)"'"
  }' \
  -v

echo ""
echo "Done!"
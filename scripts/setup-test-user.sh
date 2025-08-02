#!/bin/bash

# Setup test user configuration
BASE_URL="${1:-http://localhost:8788}"
API_KEY="${2:-test-secret-key-for-development}"

echo "Setting up test user configuration..."

# Create webhook config
TIMESTAMP=$(date +%s)000
BODY='{"user_id":"test-user","channel_type":"webhook","config":{"url":"https://webhook.site/test","headers":{"Content-Type":"application/json"}}}'

# Generate signature
SIGNATURE=$(echo -n "${TIMESTAMP}${BODY}" | openssl dgst -sha256 -hmac "$API_KEY" -binary | base64)

echo "Creating webhook configuration..."
curl -X POST "$BASE_URL/api/user-configs" \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -d "$BODY" \
  -v

echo ""
echo "Done!"
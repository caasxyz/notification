#!/bin/bash

# Setup cron triggers for Cloudflare Workers
# This script uses Cloudflare API to create cron triggers

ACCOUNT_ID=$1
SCRIPT_NAME=$2
API_TOKEN=$3

if [ -z "$ACCOUNT_ID" ] || [ -z "$SCRIPT_NAME" ] || [ -z "$API_TOKEN" ]; then
  echo "Usage: $0 <account_id> <script_name> <api_token>"
  exit 1
fi

# Create cron trigger
echo "Creating cron trigger for $SCRIPT_NAME..."

# Create JSON payload using heredoc
JSON_PAYLOAD=$(cat <<EOF
[
  {
    "cron": "*/5 * * * *"
  }
]
EOF
)

# Make API call and capture response
RESPONSE=$(curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/$SCRIPT_NAME/schedules" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" \
  -s -w "\n%{http_code}" \
  2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "201" ]]; then
  echo -e "\n✅ Cron trigger setup complete"
else
  echo -e "\n❌ Failed to set cron triggers (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
  
  # Try alternative format
  if [[ "$BODY" == *"parse request body"* ]]; then
    echo "Trying alternative JSON format..."
    
    ALT_JSON='{"cron": "*/5 * * * *"}'
    
    ALT_RESPONSE=$(curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/$SCRIPT_NAME/schedules" \
      -H "Authorization: Bearer $API_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$ALT_JSON" \
      -s -w "\n%{http_code}" \
      2>&1)
    
    ALT_HTTP_CODE=$(echo "$ALT_RESPONSE" | tail -n1)
    ALT_BODY=$(echo "$ALT_RESPONSE" | sed '$d')
    
    if [[ "$ALT_HTTP_CODE" == "200" ]] || [[ "$ALT_HTTP_CODE" == "201" ]]; then
      echo "✅ Cron triggers set successfully with alternative format"
    else
      echo "❌ Both formats failed. HTTP $ALT_HTTP_CODE"
      echo "Response: $ALT_BODY"
      exit 1
    fi
  else
    exit 1
  fi
fi
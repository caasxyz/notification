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

curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/$SCRIPT_NAME/schedules" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "schedules": [
      {
        "cron": "*/5 * * * *"
      }
    ]
  }'

echo -e "\n✅ Cron trigger setup complete"
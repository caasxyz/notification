#!/bin/bash

# Cloudflare Resources Initialization Script
# This script creates all necessary Cloudflare resources for the notification system

set -e  # Exit on error

echo "🚀 Cloudflare Notification System - Resource Initialization"
echo "=========================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Error: wrangler CLI is not installed${NC}"
    echo "Please install it with: npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
echo -e "${YELLOW}🔐 Checking Cloudflare authentication...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}Please login to Cloudflare:${NC}"
    wrangler login
fi

echo -e "${GREEN}✅ Authenticated with Cloudflare${NC}"
echo ""

# Store resource IDs
RESOURCE_FILE="cloudflare-resources.txt"
echo "# Cloudflare Resource IDs - $(date)" > $RESOURCE_FILE
echo "# Save these IDs for GitHub Secrets configuration" >> $RESOURCE_FILE
echo "" >> $RESOURCE_FILE

# Function to extract ID from wrangler output
extract_id() {
    echo "$1" | grep -oE '[a-f0-9]{32}' | head -1
}

# Create D1 Databases
echo -e "${YELLOW}📊 Creating D1 Databases...${NC}"

# Production database
echo "Creating production database..."
PROD_DB_OUTPUT=$(wrangler d1 create notification-system 2>&1 || true)
if [[ $PROD_DB_OUTPUT == *"already exists"* ]]; then
    echo -e "${YELLOW}Database 'notification-system' already exists${NC}"
    # Get existing database ID
    PROD_DB_ID=$(wrangler d1 list | grep "notification-system" | grep -v "notification-system-dev" | awk '{print $2}')
else
    PROD_DB_ID=$(extract_id "$PROD_DB_OUTPUT")
    echo -e "${GREEN}✅ Created production database${NC}"
fi
echo "PROD_DB_ID=$PROD_DB_ID" >> $RESOURCE_FILE

# Development database
echo "Creating development database..."
DEV_DB_OUTPUT=$(wrangler d1 create notification-system-dev 2>&1 || true)
if [[ $DEV_DB_OUTPUT == *"already exists"* ]]; then
    echo -e "${YELLOW}Database 'notification-system-dev' already exists${NC}"
    # Get existing database ID
    DEV_DB_ID=$(wrangler d1 list | grep "notification-system-dev" | awk '{print $2}')
else
    DEV_DB_ID=$(extract_id "$DEV_DB_OUTPUT")
    echo -e "${GREEN}✅ Created development database${NC}"
fi
echo "DEV_DB_ID=$DEV_DB_ID" >> $RESOURCE_FILE

echo ""

# Create KV Namespaces
echo -e "${YELLOW}🗄️  Creating KV Namespaces...${NC}"

# Production KV
echo "Creating production KV namespace..."
PROD_KV_OUTPUT=$(wrangler kv:namespace create "CONFIG_CACHE" 2>&1 || true)
if [[ $PROD_KV_OUTPUT == *"already exists"* ]]; then
    echo -e "${YELLOW}KV namespace 'CONFIG_CACHE' already exists${NC}"
    # Get existing KV ID - this is trickier, might need manual input
    echo -e "${YELLOW}Please check existing KV namespace ID manually with: wrangler kv:namespace list${NC}"
    PROD_KV_ID="PLACEHOLDER_PROD_KV_ID"
else
    PROD_KV_ID=$(echo "$PROD_KV_OUTPUT" | grep -oE 'id = "[^"]*"' | cut -d'"' -f2)
    echo -e "${GREEN}✅ Created production KV namespace${NC}"
fi
echo "PROD_KV_ID=$PROD_KV_ID" >> $RESOURCE_FILE

# Development KV
echo "Creating development KV namespace..."
DEV_KV_OUTPUT=$(wrangler kv:namespace create "CONFIG_CACHE" --env development 2>&1 || true)
if [[ $DEV_KV_OUTPUT == *"already exists"* ]]; then
    echo -e "${YELLOW}KV namespace 'CONFIG_CACHE' (dev) already exists${NC}"
    echo -e "${YELLOW}Please check existing KV namespace ID manually with: wrangler kv:namespace list${NC}"
    DEV_KV_ID="PLACEHOLDER_DEV_KV_ID"
else
    DEV_KV_ID=$(echo "$DEV_KV_OUTPUT" | grep -oE 'id = "[^"]*"' | cut -d'"' -f2)
    echo -e "${GREEN}✅ Created development KV namespace${NC}"
fi
echo "DEV_KV_ID=$DEV_KV_ID" >> $RESOURCE_FILE

echo ""

# Create Queues
echo -e "${YELLOW}📬 Creating Queues...${NC}"

# Production queues
echo "Creating production retry queue..."
wrangler queues create retry-queue 2>&1 || echo -e "${YELLOW}Queue 'retry-queue' already exists${NC}"

echo "Creating production failed queue..."
wrangler queues create failed-queue 2>&1 || echo -e "${YELLOW}Queue 'failed-queue' already exists${NC}"

# Development queues
echo "Creating development retry queue..."
wrangler queues create retry-queue-dev 2>&1 || echo -e "${YELLOW}Queue 'retry-queue-dev' already exists${NC}"

echo "Creating development failed queue..."
wrangler queues create failed-queue-dev 2>&1 || echo -e "${YELLOW}Queue 'failed-queue-dev' already exists${NC}"

echo -e "${GREEN}✅ Queues created/verified${NC}"
echo ""

# Initialize database schemas
echo -e "${YELLOW}🔧 Initialize Database Schemas? (First time setup only)${NC}"
read -p "Do you want to initialize database schemas now? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Initializing production database schema...${NC}"
    wrangler d1 execute notification-system --file=./sql/schema.sql
    echo -e "${GREEN}✅ Production schema initialized${NC}"
    
    echo -e "${YELLOW}Initializing development database schema...${NC}"
    wrangler d1 execute notification-system-dev --file=./sql/schema.sql
    echo -e "${GREEN}✅ Development schema initialized${NC}"
    
    # Ask about test data
    read -p "Do you want to add test data to development database? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        wrangler d1 execute notification-system-dev --file=./scripts/init-db-v2.sql
        echo -e "${GREEN}✅ Test data added to development database${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✅ Resource initialization complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Resource IDs saved to: $RESOURCE_FILE${NC}"
echo ""
echo "Next steps:"
echo "1. Copy the IDs from $RESOURCE_FILE"
echo "2. Add them as GitHub Secrets:"
echo "   - PROD_DB_ID"
echo "   - DEV_DB_ID"
echo "   - PROD_KV_ID"
echo "   - DEV_KV_ID"
echo ""
echo "3. Also add these GitHub Secrets:"
echo "   - CLOUDFLARE_API_TOKEN (create at https://dash.cloudflare.com/profile/api-tokens)"
echo "   - CLOUDFLARE_ACCOUNT_ID (from Cloudflare dashboard)"
echo "   - PROD_API_SECRET (run: openssl rand -hex 32)"
echo "   - PROD_ENCRYPT_KEY (run: openssl rand -base64 24 | cut -c1-32)"
echo ""
echo -e "${YELLOW}📄 Resource IDs:${NC}"
cat $RESOURCE_FILE
echo ""
echo -e "${GREEN}🎉 Ready to deploy via GitHub Actions!${NC}"
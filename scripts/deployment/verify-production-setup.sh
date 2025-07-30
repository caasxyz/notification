#!/bin/bash

# Production Setup Verification Script
# This script verifies that the production environment is correctly set up

set -e

echo "🔍 Production Setup Verification"
echo "================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

DB_NAME="notification-system"
ERRORS=0
WARNINGS=0

# Check wrangler
echo -e "${YELLOW}1. Checking wrangler installation...${NC}"
if command -v wrangler &> /dev/null; then
    WRANGLER_VERSION=$(wrangler --version)
    echo -e "${GREEN}✅ Wrangler installed: $WRANGLER_VERSION${NC}"
else
    echo -e "${RED}❌ Wrangler not installed${NC}"
    ((ERRORS++))
fi

# Check authentication
echo ""
echo -e "${YELLOW}2. Checking Cloudflare authentication...${NC}"
if wrangler whoami &> /dev/null; then
    echo -e "${GREEN}✅ Authenticated${NC}"
else
    echo -e "${RED}❌ Not authenticated${NC}"
    ((ERRORS++))
fi

# Check database exists
echo ""
echo -e "${YELLOW}3. Checking production database...${NC}"
if wrangler d1 list | grep -q "notification-system"; then
    echo -e "${GREEN}✅ Database 'notification-system' exists${NC}"
    
    # Get database ID
    DB_ID=$(wrangler d1 list | grep "notification-system" | grep -v "notification-system-dev" | awk '{print $2}')
    echo -e "${BLUE}   Database ID: $DB_ID${NC}"
else
    echo -e "${RED}❌ Database 'notification-system' not found${NC}"
    ((ERRORS++))
fi

# Check KV namespaces
echo ""
echo -e "${YELLOW}4. Checking KV namespaces...${NC}"
KV_LIST=$(wrangler kv:namespace list 2>&1 || echo "ERROR")
if [[ "$KV_LIST" != *"ERROR"* ]]; then
    if [[ "$KV_LIST" == *"CONFIG_CACHE"* ]]; then
        echo -e "${GREEN}✅ KV namespace 'CONFIG_CACHE' found${NC}"
    else
        echo -e "${YELLOW}⚠️  KV namespace 'CONFIG_CACHE' not found${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${RED}❌ Could not list KV namespaces${NC}"
    ((ERRORS++))
fi

# Check queues
echo ""
echo -e "${YELLOW}5. Checking queues...${NC}"
QUEUE_LIST=$(wrangler queues list 2>&1 || echo "ERROR")
if [[ "$QUEUE_LIST" != *"ERROR"* ]]; then
    MISSING_QUEUES=()
    
    if [[ "$QUEUE_LIST" != *"retry-queue"* ]]; then
        MISSING_QUEUES+=("retry-queue")
    fi
    if [[ "$QUEUE_LIST" != *"failed-queue"* ]]; then
        MISSING_QUEUES+=("failed-queue")
    fi
    
    if [ ${#MISSING_QUEUES[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ All production queues found${NC}"
    else
        echo -e "${YELLOW}⚠️  Missing queues: ${MISSING_QUEUES[*]}${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${RED}❌ Could not list queues${NC}"
    ((ERRORS++))
fi

# Check database tables
if [ $ERRORS -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}6. Checking database tables...${NC}"
    TABLES=$(wrangler d1 execute $DB_NAME --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" 2>&1 || echo "ERROR")
    
    if [[ "$TABLES" != *"ERROR"* ]]; then
        REQUIRED_TABLES=("user_configs" "notification_templates_v2" "template_contents" "notification_logs" "system_configs" "idempotency_keys")
        MISSING_TABLES=()
        
        for table in "${REQUIRED_TABLES[@]}"; do
            if [[ "$TABLES" != *"$table"* ]]; then
                MISSING_TABLES+=("$table")
            fi
        done
        
        if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
            echo -e "${GREEN}✅ All required tables present${NC}"
            
            # Check notification_logs structure
            echo -e "${YELLOW}   Checking notification_logs columns...${NC}"
            COLUMNS=$(wrangler d1 execute $DB_NAME --command="PRAGMA table_info(notification_logs)" 2>&1)
            
            REQUIRED_COLUMNS=("request_id" "variables" "retry_count")
            MISSING_COLUMNS=()
            
            for col in "${REQUIRED_COLUMNS[@]}"; do
                if [[ "$COLUMNS" != *"\"$col\""* ]]; then
                    MISSING_COLUMNS+=("$col")
                fi
            done
            
            if [ ${#MISSING_COLUMNS[@]} -eq 0 ]; then
                echo -e "${GREEN}   ✅ All required columns present${NC}"
            else
                echo -e "${RED}   ❌ Missing columns: ${MISSING_COLUMNS[*]}${NC}"
                ((ERRORS++))
            fi
        else
            echo -e "${RED}❌ Missing tables: ${MISSING_TABLES[*]}${NC}"
            echo -e "${YELLOW}Run: ./scripts/init-production-database.sh${NC}"
            ((ERRORS++))
        fi
    else
        echo -e "${RED}❌ Could not check tables${NC}"
        ((ERRORS++))
    fi
fi

# Check system configurations
if [ $ERRORS -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}7. Checking system configurations...${NC}"
    CONFIGS=$(wrangler d1 execute $DB_NAME --command="SELECT config_key, config_value FROM system_configs WHERE config_key='api_secret_key'" 2>&1 || echo "ERROR")
    
    if [[ "$CONFIGS" != *"ERROR"* ]]; then
        if [[ "$CONFIGS" == *"your-secret-key"* ]]; then
            echo -e "${YELLOW}⚠️  API secret key is still using default value!${NC}"
            echo -e "${YELLOW}   Update with: wrangler d1 execute $DB_NAME --command=\"UPDATE system_configs SET config_value='YOUR_ACTUAL_SECRET' WHERE config_key='api_secret_key'\"${NC}"
            ((WARNINGS++))
        else
            echo -e "${GREEN}✅ API secret key configured${NC}"
        fi
    fi
fi

# Summary
echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Summary:${NC}"
echo -e "${BLUE}================================${NC}"

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ All checks passed! Production environment is ready.${NC}"
    else
        echo -e "${YELLOW}⚠️  Production environment has $WARNINGS warnings.${NC}"
        echo "Please review the warnings above."
    fi
    
    echo ""
    echo "GitHub Secrets needed:"
    echo "  CLOUDFLARE_API_TOKEN"
    echo "  CLOUDFLARE_ACCOUNT_ID" 
    echo "  PROD_DB_ID=$DB_ID"
    echo "  PROD_KV_ID=[Get from KV namespace list]"
    echo "  PROD_API_SECRET=[Generate with: openssl rand -hex 32]"
    echo "  PROD_ENCRYPT_KEY=[Generate with: openssl rand -base64 24 | cut -c1-32]"
else
    echo -e "${RED}❌ Found $ERRORS errors. Please fix them before proceeding.${NC}"
    exit 1
fi

echo ""
echo "Next steps:"
echo "1. Add GitHub Secrets listed above"
echo "2. Add production templates: wrangler d1 execute $DB_NAME --file=./scripts/init-production-templates.sql"
echo "3. Configure user settings as needed"
echo "4. Deploy via GitHub Actions"
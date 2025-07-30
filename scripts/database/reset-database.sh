#!/bin/bash

# Database Reset Script
# This script safely resets the database with the correct schema

set -e

echo "🔄 Database Reset Script"
echo "======================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check environment
if [ "$1" == "production" ]; then
    DB_NAME="notification-system"
    ENV="production"
    echo -e "${RED}⚠️  WARNING: You are about to reset the PRODUCTION database!${NC}"
    echo -e "${RED}This will DELETE ALL DATA!${NC}"
    read -p "Are you ABSOLUTELY sure? Type 'yes-delete-production' to confirm: " confirm
    if [ "$confirm" != "yes-delete-production" ]; then
        echo "Cancelled."
        exit 1
    fi
else
    DB_NAME="notification-system-dev"
    ENV="development"
    echo -e "${YELLOW}Resetting development database: $DB_NAME${NC}"
    read -p "This will delete all data. Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 1
    fi
fi

echo ""
echo -e "${YELLOW}Step 1: Dropping all tables...${NC}"

# Drop tables in correct order (respecting foreign keys)
tables=("template_contents" "notification_templates_v2" "notification_logs" "user_configs" "system_configs" "idempotency_keys")

for table in "${tables[@]}"; do
    echo "Dropping $table..."
    wrangler d1 execute $DB_NAME --command="DROP TABLE IF EXISTS $table" || true
done

# Also drop old tables if they exist
echo "Dropping old tables if they exist..."
wrangler d1 execute $DB_NAME --command="DROP TABLE IF EXISTS notification_templates" || true

echo -e "${GREEN}✅ All tables dropped${NC}"

echo ""
echo -e "${YELLOW}Step 2: Creating new schema...${NC}"
wrangler d1 execute $DB_NAME --file=./sql/schema.sql

echo -e "${GREEN}✅ Schema created${NC}"

# Add test data for development
if [ "$ENV" == "development" ]; then
    echo ""
    read -p "Add test data? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Step 3: Adding test data...${NC}"
        wrangler d1 execute $DB_NAME --file=./scripts/init-db-v2.sql
        echo -e "${GREEN}✅ Test data added${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}Verifying database structure...${NC}"
echo "Tables created:"
wrangler d1 execute $DB_NAME --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

echo ""
echo -e "${GREEN}✅ Database reset complete!${NC}"

# Show next steps
echo ""
echo "Next steps:"
if [ "$ENV" == "development" ]; then
    echo "1. Start the development server: npm run dev"
    echo "2. Test the API: http://localhost:8788/api/health"
    echo "3. Use test UI: http://localhost:8788/test-ui"
else
    echo "1. Verify the deployment"
    echo "2. Update any necessary configurations"
    echo "3. Test the production API"
fi
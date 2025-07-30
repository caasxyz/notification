#!/bin/bash

# Production Database Initialization Script (Drizzle-based)
# This script safely initializes the production database using Drizzle migrations

set -e

echo "🚀 Production Database Initialization (Drizzle)"
echo "=============================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Error: wrangler CLI is not installed${NC}"
    echo "Please install it with: npm install -g wrangler"
    exit 1
fi

# Check authentication
echo -e "${YELLOW}Checking Cloudflare authentication...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${RED}❌ Not authenticated. Please run: wrangler login${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Authenticated${NC}"

# Get database name from environment or use default
DB_NAME="${DB_NAME:-notification-system}"

echo ""
echo -e "${YELLOW}Target database: $DB_NAME${NC}"
echo ""

# Check if database exists and has tables
echo -e "${BLUE}Checking existing database state...${NC}"
EXISTING_TABLES=$(wrangler d1 execute "$DB_NAME" --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" --json 2>/dev/null || echo "NO_TABLES")

if [[ "$EXISTING_TABLES" != *"NO_TABLES"* ]] && [[ "$EXISTING_TABLES" != *"[]"* ]]; then
    echo -e "${RED}❌ Database already contains tables!${NC}"
    echo ""
    echo "Existing tables:"
    echo "$EXISTING_TABLES" | jq -r '.[] | .results[] | .name' 2>/dev/null || echo "$EXISTING_TABLES"
    echo ""
    echo -e "${YELLOW}⚠️  This script is for initializing new databases only.${NC}"
    echo "If you need to update the schema, use: npm run db:migrate"
    echo "If you need to reset the database, use: ./scripts/drizzle-reset-database.sh --remote --force"
    exit 1
fi

echo -e "${GREEN}✅ Database is empty or doesn't exist${NC}"

# Check if migration files exist
if [ ! -d "drizzle" ] || [ -z "$(ls -A drizzle/*.sql 2>/dev/null)" ]; then
    echo -e "${RED}❌ No migration files found in drizzle/ directory${NC}"
    echo "Please run 'npm run db:generate' first to generate migrations"
    exit 1
fi

echo ""
echo -e "${RED}⚠️  WARNING: This will initialize the PRODUCTION database!${NC}"
echo -e "${YELLOW}Database: $DB_NAME${NC}"
echo ""
read -p "Are you sure you want to continue? Type 'yes' to confirm: " confirm

if [ "$confirm" != "yes" ]; then
    echo "Initialization cancelled."
    exit 1
fi

# Apply Drizzle migrations
echo ""
echo -e "${BLUE}Applying Drizzle migrations...${NC}"
./scripts/drizzle-migrate-production.sh

# Initialize production templates
echo ""
echo -e "${BLUE}Initializing production templates...${NC}"
if [ -f "./scripts/init-production-templates.sql" ]; then
    wrangler d1 execute "$DB_NAME" --file="./scripts/init-production-templates.sql" --remote
    echo -e "${GREEN}✅ Production templates initialized${NC}"
else
    echo -e "${YELLOW}⚠️  No production templates file found${NC}"
fi

# Verify final state
echo ""
echo -e "${BLUE}Verifying database structure...${NC}"
FINAL_TABLES=$(wrangler d1 execute "$DB_NAME" --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" --json --remote | jq -r '.[] | .results[] | .name' 2>/dev/null || echo "ERROR")

if [[ "$FINAL_TABLES" == "ERROR" ]] || [[ -z "$FINAL_TABLES" ]]; then
    echo -e "${RED}❌ Failed to verify database structure${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database tables created:${NC}"
echo "$FINAL_TABLES" | while read table; do
    echo "   - $table"
done

# Count records in key tables
echo ""
echo -e "${BLUE}Checking initial data...${NC}"
for table in "system_configs" "notification_templates_v2" "template_contents"; do
    COUNT=$(wrangler d1 execute "$DB_NAME" --command="SELECT COUNT(*) as count FROM $table" --json --remote | jq -r '.[] | .results[0].count' 2>/dev/null || echo "0")
    echo "   - $table: $COUNT records"
done

echo ""
echo -e "${GREEN}🎉 Production database initialization complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Update your wrangler.toml with the correct database_id"
echo "2. Deploy your worker: wrangler deploy"
echo "3. Test the API endpoints"
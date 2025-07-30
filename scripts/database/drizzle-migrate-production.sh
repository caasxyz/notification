#!/bin/bash

# Drizzle Migration Script for Production
# This script executes Drizzle migrations on the production database

set -e

echo "🚀 Drizzle Production Database Migration"
echo "======================================="

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

# List migration files
echo -e "${BLUE}Available migrations:${NC}"
ls -la drizzle/*.sql 2>/dev/null || {
    echo -e "${RED}❌ No migration files found in drizzle/ directory${NC}"
    echo "Run 'npm run db:generate' to generate migrations"
    exit 1
}

echo ""
echo -e "${RED}⚠️  WARNING: This will apply migrations to the PRODUCTION database!${NC}"
read -p "Are you sure you want to continue? Type 'yes' to confirm: " confirm

if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled."
    exit 1
fi

# Execute migrations
echo ""
echo -e "${BLUE}Applying migrations...${NC}"

for migration in drizzle/*.sql; do
    if [ -f "$migration" ]; then
        echo -e "${YELLOW}Applying: $(basename $migration)${NC}"
        wrangler d1 execute "$DB_NAME" --file="$migration" --remote
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Applied successfully${NC}"
        else
            echo -e "${RED}❌ Failed to apply migration${NC}"
            exit 1
        fi
    fi
done

echo ""
echo -e "${GREEN}🎉 All migrations applied successfully!${NC}"

# Show table structure
echo ""
echo -e "${BLUE}Verifying database structure...${NC}"
wrangler d1 execute "$DB_NAME" --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" --remote

echo ""
echo -e "${GREEN}✅ Migration complete!${NC}"
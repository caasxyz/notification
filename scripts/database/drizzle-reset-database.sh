#!/bin/bash

# Drizzle-based Database Reset Script
# This script resets the database by dropping all tables and recreating them using Drizzle migrations

set -e

echo "🔄 Database Reset Script (Drizzle)"
echo "=================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running in production
if [[ "$NODE_ENV" == "production" ]]; then
    echo -e "${RED}❌ Error: Cannot reset database in production!${NC}"
    exit 1
fi

# Get database name from environment or use default
DB_NAME="${DB_NAME:-notification-system}"
LOCAL_FLAG="--local"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --remote)
            LOCAL_FLAG=""
            echo -e "${YELLOW}⚠️  WARNING: Running against REMOTE database!${NC}"
            ;;
        --force)
            FORCE=true
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--remote] [--force]"
            exit 1
            ;;
    esac
    shift
done

# Confirmation for remote operations
if [[ -z "$LOCAL_FLAG" && "$FORCE" != "true" ]]; then
    echo -e "${RED}⚠️  This will reset the REMOTE database: $DB_NAME${NC}"
    read -p "Are you ABSOLUTELY sure? Type 'reset-remote' to confirm: " confirm
    if [ "$confirm" != "reset-remote" ]; then
        echo "Reset cancelled."
        exit 1
    fi
fi

echo -e "${YELLOW}📊 Current database state:${NC}"
wrangler d1 execute "$DB_NAME" $LOCAL_FLAG --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

# Drop all tables
echo -e "\n${YELLOW}🗑️  Dropping all tables...${NC}"
TABLES=(
    "task_execution_records"
    "idempotency_keys"
    "template_contents"
    "notification_logs"
    "user_configs"
    "system_configs"
    "notification_templates_v2"
)

for table in "${TABLES[@]}"; do
    echo -n "Dropping $table... "
    if wrangler d1 execute "$DB_NAME" $LOCAL_FLAG --command="DROP TABLE IF EXISTS $table" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠️  (may not exist)${NC}"
    fi
done

# Apply Drizzle migrations
echo -e "\n${YELLOW}🚀 Applying Drizzle migrations...${NC}"

if [[ -z "$LOCAL_FLAG" ]]; then
    # Remote database - use the production migration script
    ./scripts/drizzle-migrate-production.sh
else
    # Local database - apply migrations directly
    for migration in drizzle/*.sql; do
        if [ -f "$migration" ]; then
            echo -e "${YELLOW}Applying: $(basename $migration)${NC}"
            wrangler d1 execute "$DB_NAME" --local --file="$migration"
        fi
    done
fi

# Verify new structure
echo -e "\n${GREEN}✅ Database reset complete!${NC}"
echo -e "\n${YELLOW}📊 New database structure:${NC}"
wrangler d1 execute "$DB_NAME" $LOCAL_FLAG --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

echo -e "\n${GREEN}✨ Database has been reset successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Run 'npm run db:seed' to add test data (if you have a seed script)"
echo "2. Or use the API to create initial data"
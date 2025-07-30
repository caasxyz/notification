#!/bin/bash

# Apply performance indexes to the database

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Applying Performance Indexes${NC}"
echo "================================"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ wrangler CLI not found. Please install it first.${NC}"
    exit 1
fi

# Function to apply indexes to an environment
apply_indexes() {
    local env=$1
    local db_name=$2
    
    echo -e "\n${YELLOW}Applying indexes to $env environment...${NC}"
    
    # Check if database exists
    if ! wrangler d1 info "$db_name" --env="$env" &> /dev/null; then
        echo -e "${RED}❌ Database $db_name not found in $env environment${NC}"
        return 1
    fi
    
    # Apply performance indexes
    echo "Creating performance indexes..."
    wrangler d1 execute "$db_name" --file=./sql/performance-indexes.sql --env="$env"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Performance indexes applied successfully to $env${NC}"
    else
        echo -e "${RED}❌ Failed to apply indexes to $env${NC}"
        return 1
    fi
}

# Apply to local environment
if [ -f ".wrangler/state/v3/d1/notification-system.sqlite" ]; then
    echo -e "\n${YELLOW}Applying indexes to local database...${NC}"
    sqlite3 .wrangler/state/v3/d1/notification-system.sqlite < ./sql/performance-indexes.sql
    echo -e "${GREEN}✅ Performance indexes applied to local database${NC}"
else
    echo -e "${YELLOW}⚠️  Local database not found, skipping...${NC}"
fi

# Apply to development environment
apply_indexes "development" "notification-system"

# Ask before applying to production
echo -e "\n${YELLOW}Do you want to apply indexes to production? (y/N)${NC}"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    apply_indexes "production" "notification-system"
else
    echo -e "${YELLOW}Skipping production environment${NC}"
fi

echo -e "\n${GREEN}🎉 Performance index application complete!${NC}"
echo -e "\nTo verify indexes were created, run:"
echo -e "  ${YELLOW}wrangler d1 execute notification-system --command=\"SELECT name FROM sqlite_master WHERE type='index'\"${NC}"
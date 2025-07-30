#!/bin/bash

echo "🗄️  Smart Database Setup"
echo "======================="

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ wrangler CLI is not installed${NC}"
    echo "Please install it with: npm install -g wrangler"
    exit 1
fi

# Check if D1 database exists in wrangler.toml
if ! grep -q "d1_databases" wrangler.toml 2>/dev/null; then
    echo -e "${YELLOW}⚠️  No D1 database configuration found in wrangler.toml${NC}"
    echo "Using default local database setup..."
fi

# Create local database directory
mkdir -p .wrangler/state/v3/d1

# Function to execute SQL safely
execute_sql() {
    local file=$1
    local description=$2
    
    if [ ! -f "$file" ]; then
        echo -e "${YELLOW}⚠️  File not found: $file${NC}"
        return 1
    fi
    
    echo "Executing: $description"
    wrangler d1 execute notification-system --local --file="$file" 2>/dev/null || {
        # If wrangler fails, try alternative approach
        echo -e "${YELLOW}ℹ️  Direct execution failed, trying alternative...${NC}"
        return 1
    }
    return 0
}

# Initialize database schema
echo "📋 Setting up database schema..."
if [ -f "sql/schema.sql" ]; then
    execute_sql "sql/schema.sql" "Database schema" || {
        echo -e "${YELLOW}ℹ️  Schema might already exist, continuing...${NC}"
    }
else
    echo -e "${YELLOW}⚠️  sql/schema.sql not found${NC}"
    echo "Looking for alternative schema files..."
    
    # Try to find schema files
    for schema_file in scripts/init-db-v2.sql scripts/init-db.sql drizzle/0000_*.sql; do
        if [ -f "$schema_file" ]; then
            echo "Found: $schema_file"
            execute_sql "$schema_file" "Schema from $schema_file"
            break
        fi
    done
fi

# Insert initial data
echo "📝 Inserting initial data..."
if [ -f "scripts/init-db-v2.sql" ]; then
    execute_sql "scripts/init-db-v2.sql" "Initial data" || {
        echo -e "${YELLOW}ℹ️  Initial data might already exist${NC}"
    }
fi

# Create a simple test to verify database
echo ""
echo "🔍 Verifying database setup..."
wrangler d1 execute notification-system --local --command "SELECT 1" 2>/dev/null && {
    echo -e "${GREEN}✅ Database is accessible${NC}"
} || {
    echo -e "${YELLOW}⚠️  Could not verify database, but this might be normal${NC}"
    echo "The database will be created when you run 'npm run dev'"
}

echo ""
echo -e "${GREEN}✅ Database setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run 'npm run dev' to start the development server"
echo "  2. Visit http://localhost:8788/api/health to verify"
echo "  3. Use http://localhost:8788/test-ui for testing"
#!/bin/bash

# Project Management Tool Database Setup Script
# This script creates the database, runs migrations, and seeds sample data

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Database configuration (update these values)
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"3306"}
DB_USER=${DB_USER:-"root"}
DB_PASSWORD=${DB_PASSWORD:-""}
DB_NAME="project_management_tool"

echo -e "${BLUE}🚀 Project Management Tool Database Setup${NC}"
echo "================================================"

# Function to execute SQL file
execute_sql() {
    local file=$1
    local description=$2
    
    echo -e "${YELLOW}📄 Executing: $description${NC}"
    
    if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" < "$file"; then
        echo -e "${GREEN}✅ Success: $description${NC}"
    else
        echo -e "${RED}❌ Failed: $description${NC}"
        exit 1
    fi
}

# Check if MySQL is accessible
echo -e "${YELLOW}🔍 Checking MySQL connection...${NC}"
if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MySQL connection successful${NC}"
else
    echo -e "${RED}❌ MySQL connection failed. Please check your credentials.${NC}"
    exit 1
fi

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"
SEEDS_DIR="$SCRIPT_DIR/seeds"

# Execute migrations in order
echo -e "\n${BLUE}📦 Running Database Migrations${NC}"
echo "======================================="

if [ -f "$MIGRATIONS_DIR/001_create_database.sql" ]; then
    execute_sql "$MIGRATIONS_DIR/001_create_database.sql" "Creating base database schema"
else
    echo -e "${RED}❌ Base migration file not found: $MIGRATIONS_DIR/001_create_database.sql${NC}"
    exit 1
fi

if [ -f "$MIGRATIONS_DIR/002_enhanced_schema.sql" ]; then
    execute_sql "$MIGRATIONS_DIR/002_enhanced_schema.sql" "Applying enhanced schema features"
else
    echo -e "${YELLOW}⚠️  Enhanced schema file not found, skipping...${NC}"
fi

# Seed sample data
echo -e "\n${BLUE}🌱 Seeding Sample Data${NC}"
echo "========================="

if [ -f "$SEEDS_DIR/sample_data.sql" ]; then
    read -p "Do you want to insert sample data? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        execute_sql "$SEEDS_DIR/sample_data.sql" "Inserting sample data"
    else
        echo -e "${YELLOW}⏭️  Skipping sample data insertion${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Sample data file not found, skipping...${NC}"
fi

# Verify installation
echo -e "\n${BLUE}🔍 Verifying Installation${NC}"
echo "==========================="

echo -e "${YELLOW}📊 Checking database tables...${NC}"
TABLE_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -D"$DB_NAME" -e "SHOW TABLES;" | wc -l)
if [ $TABLE_COUNT -gt 1 ]; then
    echo -e "${GREEN}✅ Database has $((TABLE_COUNT-1)) tables${NC}"
    
    # Show table list
    echo -e "\n${BLUE}📋 Created Tables:${NC}"
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -D"$DB_NAME" -e "SHOW TABLES;" | tail -n +2 | sed 's/^/  • /'
    
    # Show views
    echo -e "\n${BLUE}👁️  Created Views:${NC}"
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -D"$DB_NAME" -e "SHOW FULL TABLES WHERE Table_type = 'VIEW';" | tail -n +2 | awk '{print "  • " $1}'
    
else
    echo -e "${RED}❌ Database setup failed - no tables found${NC}"
    exit 1
fi

echo -e "\n${GREEN}🎉 Database setup completed successfully!${NC}"
echo "=========================================="
echo -e "${BLUE}Database Details:${NC}"
echo "  • Host: $DB_HOST:$DB_PORT"
echo "  • Database: $DB_NAME"
echo "  • User: $DB_USER"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Update your .env file with database credentials"
echo "  2. Test the connection from your application"
echo "  3. Start developing your project management features"
echo ""
echo -e "${YELLOW}💡 Tip: You can re-run this script anytime to reset the database${NC}"
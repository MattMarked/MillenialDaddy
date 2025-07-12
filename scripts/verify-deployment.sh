#!/bin/bash

# Deployment Verification Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default URL (can be overridden)
APP_URL=${1:-"http://localhost:3000"}

echo "🔍 Verifying deployment at: $APP_URL"
echo "=================================="

# Function to check endpoint
check_endpoint() {
    local endpoint=$1
    local expected_status=${2:-200}
    local description=$3
    
    echo -n "Testing $description... "
    
    response=$(curl -s -w "%{http_code}" -o /tmp/response.json "$APP_URL$endpoint" || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL (HTTP $response)${NC}"
        if [ -f /tmp/response.json ]; then
            echo "Response body:"
            cat /tmp/response.json
            echo
        fi
        return 1
    fi
}

# Function to check API endpoint with authentication
check_authenticated_endpoint() {
    local endpoint=$1
    local method=${2:-GET}
    local description=$3
    
    echo -n "Testing $description... "
    
    # This would need actual admin credentials in a real test
    # For now, we expect a 401/403 response which indicates the endpoint exists
    response=$(curl -s -w "%{http_code}" -X "$method" -o /tmp/response.json "$APP_URL$endpoint" || echo "000")
    
    if [ "$response" = "401" ] || [ "$response" = "403" ]; then
        echo -e "${GREEN}✅ PASS (Auth required as expected)${NC}"
        return 0
    elif [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL (HTTP $response)${NC}"
        return 1
    fi
}

# Start verification
echo "🏥 Health Check"
check_endpoint "/api/health" 200 "Health endpoint"

echo
echo "🔗 Link Management API"
check_authenticated_endpoint "/api/links" "POST" "Link submission endpoint"

echo
echo "👥 Admin Management API"
check_authenticated_endpoint "/api/admin/list" "GET" "Admin list endpoint"
check_authenticated_endpoint "/api/admin/add" "POST" "Admin add endpoint"

echo
echo "⚙️ Configuration API"
check_authenticated_endpoint "/api/config/publication" "GET" "Publication config endpoint"

echo
echo "📊 Monitoring API"
check_endpoint "/api/monitoring/metrics" 200 "Metrics endpoint"
check_endpoint "/api/monitoring/status" 200 "Status endpoint"

echo
echo "🎯 Publication API"
check_authenticated_endpoint "/api/publication/schedule" "POST" "Schedule endpoint"

echo
echo "🌐 Frontend"
check_endpoint "/" 200 "Main page"

# Summary
echo
echo "=================================="
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Deployment verified successfully.${NC}"
    
    echo
    echo "📋 Next steps:"
    echo "1. Test admin login functionality"
    echo "2. Submit a test link through the UI"
    echo "3. Verify queue processing"
    echo "4. Check scheduled publication"
    echo "5. Monitor logs for any issues"
    
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please review the deployment.${NC}"
    exit 1
fi
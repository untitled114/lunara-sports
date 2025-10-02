#!/bin/bash

# API Endpoint Contract Testing Script
# Tests frontend/backend API alignment to prevent 404 errors

echo "🔍 API Endpoint Contract Testing"
echo "================================"
echo ""

BASE_URL="http://localhost:8000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track test results
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local expect_auth=${4:-false}

    echo -n "Testing $method $endpoint... "

    if [ "$expect_auth" = "true" ]; then
        # Test with missing auth (should return 401)
        response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE_URL$endpoint")
        if [ "$response" = "401" ]; then
            echo -e "${GREEN}✓ PASS${NC} (requires auth as expected)"
            ((PASSED++))
        elif [ "$response" = "404" ]; then
            echo -e "${RED}✗ FAIL${NC} - 404 Not Found! $description"
            ((FAILED++))
        else
            echo -e "${YELLOW}⚠ WARN${NC} - Got $response (expected 401 for auth endpoint)"
            ((PASSED++))
        fi
    else
        # Test without auth
        response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE_URL$endpoint")
        if [ "$response" != "404" ]; then
            echo -e "${GREEN}✓ PASS${NC} ($response)"
            ((PASSED++))
        else
            echo -e "${RED}✗ FAIL${NC} - 404 Not Found! $description"
            ((FAILED++))
        fi
    fi
}

echo "📋 Testing Authentication Endpoints"
echo "-----------------------------------"
test_endpoint "POST" "/api/auth/login/" "Login endpoint"
test_endpoint "POST" "/api/auth/register/" "Registration endpoint (signup)"
test_endpoint "POST" "/api/auth/logout/" "Logout endpoint"
test_endpoint "POST" "/api/auth/refresh/" "Token refresh endpoint"

echo ""
echo "👤 Testing Profile Endpoints"
echo "----------------------------"
test_endpoint "GET" "/api/auth/profile/" "Get user profile" true
test_endpoint "PATCH" "/api/auth/profile/update/" "Update user profile" true
test_endpoint "POST" "/api/auth/profile/avatar/" "Upload avatar" true

echo ""
echo "💰 Testing Payment Endpoints"
echo "----------------------------"
test_endpoint "GET" "/api/payments/transactions/" "Get all transactions" true
test_endpoint "GET" "/api/payments/payment-methods/" "Get payment methods" true
test_endpoint "POST" "/api/payments/1/remind/" "Send payment reminder" true
test_endpoint "GET" "/api/payments/1/receipt/" "Download receipt" true

echo ""
echo "📊 Testing Project Endpoints"
echo "---------------------------"
test_endpoint "GET" "/api/projects/" "Get all projects" true

echo ""
echo "📈 Summary"
echo "=========="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All API endpoints are properly aligned!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some endpoints are missing or misaligned. Fix before deploying!${NC}"
    exit 1
fi

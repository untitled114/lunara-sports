#!/bin/bash

# Lunara - Comprehensive QA Test Script
# This script tests all critical functional flows

set -e

echo "========================================"
echo "LUNARA - COMPREHENSIVE QA TEST SUITE"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"
TEST_EMAIL="qa-test-$(date +%s)@example.com"
TEST_PASSWORD="Test123456"
TEST_NAME="QA Test User"

# Test counter
PASSED=0
FAILED=0

test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    ((FAILED++))
  fi
}

echo "=== 1. SERVER HEALTH CHECK ==="
echo "Testing if dev server is running..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL")
test_result $([ "$response" = "200" ] && echo 0 || echo 1) "Dev server responding on port 3000"

echo ""
echo "=== 2. LANDING PAGE TESTS ==="
echo "Testing landing page loads..."
landing_html=$(curl -s "$BASE_URL")
echo "$landing_html" | grep -q "react-root" && test_result 0 "React root div present" || test_result 1 "React root div present"
echo "$landing_html" | grep -q "Lunara" && test_result 0 "Page title contains Lunara" || test_result 1 "Page title contains Lunara"

echo ""
echo "=== 3. ROUTE ACCESSIBILITY TESTS ==="
echo "Testing all routes return 200..."
for route in "/" "/signin" "/signup"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$route")
  test_result $([ "$status" = "200" ] && echo 0 || echo 1) "Route $route accessible (HTTP $status)"
done

echo ""
echo "=== 4. BUILD VERIFICATION ==="
echo "Testing production build..."
BUILD_OUTPUT=$(npm run build 2>&1)
echo "$BUILD_OUTPUT" | grep -q "✓ built in" && test_result 0 "Production build successful" || test_result 1 "Production build successful"
echo "$BUILD_OUTPUT" | grep -q "error" && test_result 1 "Build has no errors" || test_result 0 "Build has no errors"

echo ""
echo "=== 5. BUNDLE ANALYSIS ==="
echo "Checking build output..."
[ -f "dist/index.html" ] && test_result 0 "dist/index.html exists" || test_result 1 "dist/index.html exists"
[ -f "dist/assets/index-DRmgsDnK.css" ] || [ -f "dist/assets/"*.css ] && test_result 0 "CSS bundle exists" || test_result 1 "CSS bundle exists"
[ -d "dist/js" ] && test_result 0 "JavaScript bundles directory exists" || test_result 1 "JavaScript bundles directory exists"

# Check for Three.js vendor bundle
ls dist/js/three-vendor-*.js >/dev/null 2>&1 && test_result 0 "Three.js vendor bundle exists" || test_result 1 "Three.js vendor bundle exists"

echo ""
echo "=== 6. SOURCE MAP VERIFICATION ==="
echo "Checking source maps..."
ls dist/js/*.js.map >/dev/null 2>&1 && test_result 0 "Source maps generated" || test_result 1 "Source maps generated"

echo ""
echo "=== 7. COMPONENT VERIFICATION ==="
echo "Checking critical components exist..."
for component in "Navigation" "Hero" "Features" "Pricing" "How-it-works" "SignIn" "SignUp" "Particles"; do
  [ -f "src/components/$component.jsx" ] && test_result 0 "Component $component.jsx exists" || test_result 1 "Component $component.jsx exists"
done

echo ""
echo "=== 8. STYLE VERIFICATION ==="
echo "Checking styles..."
[ -f "src/styles.css" ] && test_result 0 "Custom styles.css exists" || test_result 1 "Custom styles.css exists"
[ -f "src/index.css" ] && test_result 0 "Tailwind index.css exists" || test_result 1 "Tailwind index.css exists"

# Check styles contain critical classes
grep -q ".hero" src/styles.css && test_result 0 "Hero styles present in styles.css" || test_result 1 "Hero styles present"
grep -q ".btn-primary" src/styles.css && test_result 0 "Button styles present in styles.css" || test_result 1 "Button styles present"
grep -q ".feature-card" src/styles.css && test_result 0 "Feature card styles present" || test_result 1 "Feature card styles present"

echo ""
echo "=== 9. DEPENDENCY VERIFICATION ==="
echo "Checking critical dependencies..."
grep -q '"three"' package.json && test_result 0 "Three.js dependency installed" || test_result 1 "Three.js dependency installed"
grep -q '"react-router-dom"' package.json && test_result 0 "React Router installed" || test_result 1 "React Router installed"
grep -q '"firebase"' package.json && test_result 0 "Firebase installed" || test_result 1 "Firebase installed"

echo ""
echo "=== 10. CONFIGURATION VERIFICATION ==="
echo "Checking Vite configuration..."
grep -q "optimizeDeps" vite.config.js && test_result 0 "Vite optimizeDeps configured" || test_result 1 "Vite optimizeDeps configured"
grep -q "three" vite.config.js && test_result 0 "Three.js in Vite config" || test_result 1 "Three.js in Vite config"
grep -q "sourcemapIgnoreList" vite.config.js && test_result 0 "Source map ignore list configured" || test_result 1 "Source map ignore list configured"

echo ""
echo "========================================"
echo "TEST SUMMARY"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
TOTAL=$((PASSED + FAILED))
PASS_RATE=$((PASSED * 100 / TOTAL))
echo "Pass Rate: $PASS_RATE%"

if [ $FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✓ ALL TESTS PASSED${NC}"
  exit 0
else
  echo -e "\n${RED}✗ SOME TESTS FAILED${NC}"
  exit 1
fi

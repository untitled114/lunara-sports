#!/bin/bash
# Lunara API Performance Benchmark Script
# Measures response times for critical API endpoints

set -e

API_URL="http://localhost:8000"
OUTPUT_FILE="api_benchmark_results.txt"
ITERATIONS=10

echo "==================================="
echo "Lunara API Performance Benchmark"
echo "==================================="
echo ""
echo "Testing API at: $API_URL"
echo "Iterations per endpoint: $ITERATIONS"
echo "Target: <200ms average response time"
echo ""

# Initialize results file
cat > "$OUTPUT_FILE" <<EOF
Lunara API Performance Benchmark Results
Date: $(date)
Target: <200ms average response time
=========================================

EOF

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to run benchmark on an endpoint
benchmark_endpoint() {
    local endpoint=$1
    local method=${2:-GET}
    local data=${3:-}
    local description=$4

    echo "Testing: $description"
    echo "Endpoint: $method $endpoint"

    local total_time=0
    local min_time=999999
    local max_time=0
    local success_count=0

    # Run multiple iterations
    for i in $(seq 1 $ITERATIONS); do
        if [ -n "$data" ]; then
            result=$(curl -s -w "%{http_code}|%{time_total}" -X "$method" \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$API_URL$endpoint" -o /dev/null)
        else
            result=$(curl -s -w "%{http_code}|%{time_total}" -X "$method" \
                "$API_URL$endpoint" -o /dev/null)
        fi

        http_code=$(echo "$result" | cut -d'|' -f1)
        time_total=$(echo "$result" | cut -d'|' -f2)

        # Convert to milliseconds
        time_ms=$(echo "$time_total * 1000" | bc)

        # Track statistics
        if [ "$http_code" -lt 400 ]; then
            success_count=$((success_count + 1))
        fi

        total_time=$(echo "$total_time + $time_ms" | bc)

        # Update min/max
        if (( $(echo "$time_ms < $min_time" | bc -l) )); then
            min_time=$time_ms
        fi
        if (( $(echo "$time_ms > $max_time" | bc -l) )); then
            max_time=$time_ms
        fi

        # Progress indicator
        echo -n "."
    done

    echo "" # New line after progress dots

    # Calculate average
    avg_time=$(echo "scale=2; $total_time / $ITERATIONS" | bc)
    success_rate=$(echo "scale=2; ($success_count / $ITERATIONS) * 100" | bc)

    # Determine if it meets target
    meets_target=$(echo "$avg_time < 200" | bc)

    # Color-coded output
    if [ "$meets_target" -eq 1 ]; then
        status_color=$GREEN
        status="✅ PASS"
    elif (( $(echo "$avg_time < 500" | bc -l) )); then
        status_color=$YELLOW
        status="⚠️  WARN"
    else
        status_color=$RED
        status="❌ FAIL"
    fi

    # Display results
    echo -e "${status_color}${status}${NC} Avg: ${avg_time}ms | Min: ${min_time}ms | Max: ${max_time}ms | Success: ${success_rate}%"
    echo ""

    # Write to file
    cat >> "$OUTPUT_FILE" <<EOF
$description
Endpoint: $METHOD $endpoint
Average: ${avg_time}ms
Min: ${min_time}ms
Max: ${max_time}ms
Success Rate: ${success_rate}%
Status: $status
---
EOF
}

# Test endpoints
echo "Starting benchmarks..."
echo ""

# 1. Health Check
benchmark_endpoint "/health/" "GET" "" "Health Check Endpoint"

# 2. Auth endpoints (public)
benchmark_endpoint "/api/auth/check-email/" "POST" '{"email":"test@example.com"}' "Email Availability Check"

benchmark_endpoint "/api/auth/check-username/" "POST" '{"username":"testuser"}' "Username Availability Check"

# 3. Registration endpoint (may create users, be careful)
# Commenting out to avoid database pollution
# benchmark_endpoint "/api/auth/register/" "POST" '{"email":"bench'$(date +%s)'@test.com","username":"bench'$(date +%s)'","password":"TestPass123!","first_name":"Test","last_name":"User"}' "User Registration"

# 4. Login attempt (will fail but tests endpoint)
benchmark_endpoint "/api/auth/login/" "POST" '{"email":"test@lunara.com","password":"testpass"}' "Login Endpoint (Invalid Credentials)"

# Note: Protected endpoints require authentication token
# We can add those tests if a test user account is available

echo ""
echo "==================================="
echo "Benchmark Complete!"
echo "==================================="
echo ""
echo "Results saved to: $OUTPUT_FILE"
echo ""

# Calculate overall statistics
echo "Calculating overall statistics..."
cat "$OUTPUT_FILE"

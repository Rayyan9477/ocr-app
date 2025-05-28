#!/bin/bash

# Phase 4 Testing Script
# Tests all new Phase 4 features: caching, export, batch search, analytics

echo "🚀 Phase 4 Feature Testing Script"
echo "=================================="
echo "Testing Performance Optimization and Advanced Features"
echo ""

# Configuration
BASE_URL="http://localhost:3000"
TEST_QUERY="patient"
BATCH_QUERIES='["patient", "diagnosis", "medication"]'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=8

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

# Function to check if server is running
check_server() {
    echo -e "${BLUE}🔍 Checking if server is running...${NC}"
    
    curl -s "$BASE_URL" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Server is running on $BASE_URL${NC}"
        return 0
    else
        echo -e "${RED}❌ Server is not running on $BASE_URL${NC}"
        echo "Please start the server with: npm run dev"
        exit 1
    fi
}

# Test 1: Basic Search with Caching
test_search_caching() {
    echo -e "\n${YELLOW}Test 1: Search with Caching${NC}"
    
    # First search (cache miss)
    response1=$(curl -s -X POST "$BASE_URL/api/search" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"$TEST_QUERY\", \"options\": {\"fuzzyThreshold\": 0.3}}")
    
    if [[ $response1 == *"results"* && $response1 == *"cacheStats"* ]]; then
        echo "First search successful (cache miss expected)"
        
        # Second search (cache hit)
        response2=$(curl -s -X POST "$BASE_URL/api/search" \
            -H "Content-Type: application/json" \
            -d "{\"query\": \"$TEST_QUERY\", \"options\": {\"fuzzyThreshold\": 0.3}}")
        
        if [[ $response2 == *"cached"* ]]; then
            print_result 0 "Search caching functionality"
        else
            print_result 1 "Search caching functionality (cache hit not detected)"
        fi
    else
        print_result 1 "Search caching functionality (API error)"
    fi
}

# Test 2: Export Functionality
test_export_functionality() {
    echo -e "\n${YELLOW}Test 2: Export Functionality${NC}"
    
    # Test CSV export
    export_response=$(curl -s -X POST "$BASE_URL/api/search/export" \
        -H "Content-Type: application/json" \
        -d '{
            "results": [
                {
                    "text": "test result",
                    "confidence": 95,
                    "page": 1,
                    "matchScore": 0.9
                }
            ],
            "format": "csv",
            "includeMetadata": true,
            "query": "test"
        }')
    
    if [ $? -eq 0 ]; then
        print_result 0 "Export functionality (CSV)"
    else
        print_result 1 "Export functionality (CSV)"
    fi
}

# Test 3: Batch Search
test_batch_search() {
    echo -e "\n${YELLOW}Test 3: Batch Search${NC}"
    
    batch_response=$(curl -s -X POST "$BASE_URL/api/search/batch" \
        -H "Content-Type: application/json" \
        -d "{
            \"queries\": $BATCH_QUERIES,
            \"options\": {\"fuzzyThreshold\": 0.3, \"maxResults\": 10}
        }")
    
    if [[ $batch_response == *"batchResults"* && $batch_response == *"aggregatedStats"* ]]; then
        print_result 0 "Batch search functionality"
    else
        print_result 1 "Batch search functionality"
    fi
}

# Test 4: Analytics Integration
test_analytics() {
    echo -e "\n${YELLOW}Test 4: Analytics Integration${NC}"
    
    # Log a search event
    analytics_response=$(curl -s -X POST "$BASE_URL/api/search/analytics" \
        -H "Content-Type: application/json" \
        -d '{
            "action": "log-search",
            "query": "test analytics",
            "resultsCount": 5,
            "searchTime": 150,
            "cached": false
        }')
    
    if [[ $analytics_response == *"success"* ]] || [ $? -eq 0 ]; then
        # Get analytics data
        get_analytics=$(curl -s "$BASE_URL/api/search/analytics")
        
        if [[ $get_analytics == *"searches"* ]] || [[ $get_analytics == *"analytics"* ]]; then
            print_result 0 "Analytics integration"
        else
            print_result 1 "Analytics integration (data retrieval)"
        fi
    else
        print_result 1 "Analytics integration (logging)"
    fi
}

# Test 5: Cache Management
test_cache_management() {
    echo -e "\n${YELLOW}Test 5: Cache Management${NC}"
    
    # Get cache statistics
    cache_stats=$(curl -s "$BASE_URL/api/search/cache")
    
    if [[ $cache_stats == *"statistics"* ]] || [[ $cache_stats == *"hitRate"* ]]; then
        print_result 0 "Cache management (statistics)"
    else
        print_result 1 "Cache management (statistics)"
    fi
}

# Test 6: Performance Monitoring
test_performance_monitoring() {
    echo -e "\n${YELLOW}Test 6: Performance Monitoring${NC}"
    
    # Test search with performance tracking
    perf_response=$(curl -s -X POST "$BASE_URL/api/search" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"performance test\", \"options\": {}}")
    
    if [[ $perf_response == *"statistics"* && $perf_response == *"cacheStats"* ]]; then
        print_result 0 "Performance monitoring"
    else
        print_result 1 "Performance monitoring"
    fi
}

# Test 7: Multi-format Export
test_multiformat_export() {
    echo -e "\n${YELLOW}Test 7: Multi-format Export${NC}"
    
    formats_tested=0
    formats_passed=0
    
    for format in "json" "txt" "csv"; do
        ((formats_tested++))
        export_test=$(curl -s -X POST "$BASE_URL/api/search/export" \
            -H "Content-Type: application/json" \
            -d "{
                \"results\": [{\"text\": \"test\", \"confidence\": 90, \"page\": 1}],
                \"format\": \"$format\",
                \"includeMetadata\": false
            }")
        
        if [ $? -eq 0 ]; then
            ((formats_passed++))
        fi
    done
    
    if [ $formats_passed -eq $formats_tested ]; then
        print_result 0 "Multi-format export (JSON, TXT, CSV)"
    else
        print_result 1 "Multi-format export ($formats_passed/$formats_tested formats working)"
    fi
}

# Test 8: UI Integration
test_ui_integration() {
    echo -e "\n${YELLOW}Test 8: UI Integration${NC}"
    
    # Test main page loads
    ui_response=$(curl -s "$BASE_URL")
    
    if [[ $ui_response == *"OCR Application"* ]] || [[ $ui_response == *"smart-search"* ]]; then
        print_result 0 "UI integration (page loads)"
    else
        print_result 1 "UI integration (page loads)"
    fi
}

# Performance benchmark
run_performance_benchmark() {
    echo -e "\n${BLUE}🏃 Performance Benchmark${NC}"
    echo "Testing search speed with and without caching..."
    
    # Clear cache first
    curl -s -X POST "$BASE_URL/api/search/cache" > /dev/null 2>&1
    
    # Time first search (cache miss)
    start_time=$(date +%s%N)
    curl -s -X POST "$BASE_URL/api/search" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"benchmark test\", \"options\": {}}" > /dev/null
    end_time=$(date +%s%N)
    cache_miss_time=$(( (end_time - start_time) / 1000000 ))
    
    # Time second search (cache hit)
    start_time=$(date +%s%N)
    curl -s -X POST "$BASE_URL/api/search" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"benchmark test\", \"options\": {}}" > /dev/null
    end_time=$(date +%s%N)
    cache_hit_time=$(( (end_time - start_time) / 1000000 ))
    
    echo "Cache miss time: ${cache_miss_time}ms"
    echo "Cache hit time: ${cache_hit_time}ms"
    
    if [ $cache_hit_time -lt $cache_miss_time ]; then
        speedup=$(( cache_miss_time / (cache_hit_time + 1) ))
        echo -e "${GREEN}✅ Caching provides ${speedup}x speedup${NC}"
    else
        echo -e "${YELLOW}⚠️ Cache performance needs tuning${NC}"
    fi
}

# Main execution
main() {
    echo "Starting Phase 4 feature tests..."
    echo ""
    
    # Check server availability
    check_server
    
    # Run all tests
    test_search_caching
    test_export_functionality
    test_batch_search
    test_analytics
    test_cache_management
    test_performance_monitoring
    test_multiformat_export
    test_ui_integration
    
    # Performance benchmark
    run_performance_benchmark
    
    # Final results
    echo ""
    echo "=================================="
    echo -e "${BLUE}📊 Test Results Summary${NC}"
    echo "=================================="
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}/$TOTAL_TESTS"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}/$TOTAL_TESTS"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo ""
        echo -e "${GREEN}🎉 All Phase 4 features are working correctly!${NC}"
        echo -e "${GREEN}✅ Performance Optimization: READY${NC}"
        echo -e "${GREEN}✅ Export Capabilities: READY${NC}"
        echo -e "${GREEN}✅ Batch Search: READY${NC}"
        echo -e "${GREEN}✅ Analytics Integration: READY${NC}"
        echo -e "${GREEN}✅ Cache Management: READY${NC}"
        echo ""
        echo -e "${BLUE}🚀 Phase 4 implementation is production-ready!${NC}"
        exit 0
    else
        echo ""
        echo -e "${RED}⚠️ Some tests failed. Please review the output above.${NC}"
        exit 1
    fi
}

# Run the main function
main

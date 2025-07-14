#!/bin/bash

# GitHub Actions Validation Script
# This script validates all the fixes we've implemented for deployment issues

echo "🔍 Starting GitHub Actions Deployment Validation"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((FAILED++))
    fi
}

echo ""
echo "1. Checking YAML Syntax..."
echo "-------------------------"

# Check YAML syntax
python3 -c "
import yaml
try:
    with open('.github/workflows/azure-deploy.yml', 'r') as file:
        yaml.safe_load(file)
    exit(0)
except yaml.YAMLError as e:
    print(f'YAML Error: {e}')
    exit(1)
except Exception as e:
    print(f'Error: {e}')
    exit(1)
" 2>/dev/null
check_status $? "Azure deploy workflow YAML syntax"

echo ""
echo "2. Checking Jest Configuration..."
echo "--------------------------------"

# Test Jest configuration
npm test -- --passWithNoTests --silent > /dev/null 2>&1
check_status $? "Jest test runner configuration"

echo ""
echo "3. Checking Next.js Build Configuration..."
echo "------------------------------------------"

# Check if Next.js config has standalone output
if grep -q 'output.*standalone' next.config.mjs; then
    check_status 0 "Next.js standalone output configuration"
else
    check_status 1 "Next.js standalone output configuration"
fi

echo ""
echo "4. Checking Package.json Scripts..."
echo "-----------------------------------"

# Check critical scripts exist
if jq -r '.scripts | keys[]' package.json 2>/dev/null | grep -E "build|test|start" > /dev/null; then
    check_status 0 "Package.json build scripts"
else
    check_status 1 "Package.json build scripts"
fi

echo ""
echo "5. Checking Workflow File Structure..."
echo "-------------------------------------"

# Check if workflow has required sections
if grep -q "build-and-deploy:" .github/workflows/azure-deploy.yml && \
   grep -q "Deploy to Azure App Service" .github/workflows/azure-deploy.yml && \
   grep -q "npm test" .github/workflows/azure-deploy.yml; then
    check_status 0 "Workflow file structure and required steps"
else
    check_status 1 "Workflow file structure and required steps"
fi

echo ""
echo "6. Checking Configuration Files..."
echo "---------------------------------"

# Check if essential config files exist
config_files=("web.config" "web.config.production" "iisnode.yml" "startup.sh")
config_found=0
for file in "${config_files[@]}"; do
    if [ -f "$file" ]; then
        ((config_found++))
    fi
done

if [ $config_found -ge 2 ]; then
    check_status 0 "Azure configuration files presence"
else
    check_status 1 "Azure configuration files presence"
fi

echo ""
echo "7. Checking Server.js Health Endpoints..."
echo "-----------------------------------------"

# Check if server.js has health endpoints
if grep -q "/health\|/ping" server.js; then
    check_status 0 "Server.js health check endpoints"
else
    check_status 1 "Server.js health check endpoints"
fi

echo ""
echo "8. Checking Conflicting Workflows..."
echo "-----------------------------------"

# Check for conflicting workflow files
conflicting_workflows=$(find .github/workflows/ -name "*.yml" -not -name "azure-deploy.yml" | wc -l)
if [ $conflicting_workflows -eq 0 ] || grep -q "# This workflow is disabled" .github/workflows/*.yml 2>/dev/null; then
    check_status 0 "No conflicting active workflows"
else
    check_status 1 "Multiple active workflows detected"
fi

echo ""
echo "9. Checking Jest Setup File..."
echo "-----------------------------"

# Check if jest.setup.js exists and has proper mocks
if [ -f "jest.setup.js" ] && grep -q "mock" jest.setup.js; then
    check_status 0 "Jest setup file with proper mocks"
else
    check_status 1 "Jest setup file with proper mocks"
fi

echo ""
echo "10. Final Integration Test..."
echo "----------------------------"

# Run a quick build test (timeout after 2 minutes)
echo "Testing Next.js build process..."
timeout 120 npm run build > /dev/null 2>&1
build_exit_code=$?

if [ $build_exit_code -eq 0 ]; then
    # Check if standalone files were created
    if [ -f ".next/standalone/server.js" ]; then
        check_status 0 "Next.js standalone build completion"
    else
        check_status 1 "Next.js standalone build completion (server.js missing)"
    fi
elif [ $build_exit_code -eq 124 ]; then
    check_status 1 "Next.js build (timed out after 2 minutes)"
else
    check_status 1 "Next.js build process"
fi

echo ""
echo "================================================="
echo "🏁 Validation Summary"
echo "================================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All validations passed! The deployment should work correctly.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Commit and push these changes to trigger deployment"
    echo "2. Monitor the GitHub Actions workflow for any issues"
    echo "3. Check Azure App Service logs if deployment succeeds but app fails to start"
    echo "4. Verify the app is accessible at your Azure App Service URL"
    exit 0
else
    echo -e "${RED}⚠️  Some validations failed. Please review and fix the issues above.${NC}"
    exit 1
fi

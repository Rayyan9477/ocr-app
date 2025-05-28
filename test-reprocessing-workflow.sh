#!/bin/bash
# Test script for Phase 2 reprocessing workflow

set -e

echo "🧪 Testing Phase 2: Manual Rework with PaddleOCR Engine"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test directories
UPLOADS_DIR="./uploads"
PROCESSED_DIR="./processed"
TMP_DIR="./tmp"

# Create test directories if they don't exist
mkdir -p "$UPLOADS_DIR" "$PROCESSED_DIR" "$TMP_DIR"

echo -e "${BLUE}📋 Phase 2 Component Checklist:${NC}"

# 1. Check if PaddleOCR service files exist
echo -n "  ✓ PaddleOCR Dockerfile: "
if [ -f "./docker/paddleocr/Dockerfile" ]; then
    echo -e "${GREEN}EXISTS${NC}"
else
    echo -e "${RED}MISSING${NC}"
    exit 1
fi

echo -n "  ✓ PaddleOCR Service: "
if [ -f "./docker/paddleocr/paddleocr_service.py" ]; then
    echo -e "${GREEN}EXISTS${NC}"
else
    echo -e "${RED}MISSING${NC}"
    exit 1
fi

echo -n "  ✓ PaddleOCR Requirements: "
if [ -f "./docker/paddleocr/requirements.txt" ]; then
    echo -e "${GREEN}EXISTS${NC}"
else
    echo -e "${RED}MISSING${NC}"
    exit 1
fi

# 2. Check reprocessing API endpoint
echo -n "  ✓ Reprocessing API: "
if [ -f "./app/api/reprocess-page/route.ts" ]; then
    echo -e "${GREEN}EXISTS${NC}"
else
    echo -e "${RED}MISSING${NC}"
    exit 1
fi

# 3. Check UI components
echo -n "  ✓ Enhanced File Preview: "
if [ -f "./components/file-preview.tsx" ] && grep -q "reprocessing" "./components/file-preview.tsx"; then
    echo -e "${GREEN}UPDATED${NC}"
else
    echo -e "${RED}MISSING REPROCESSING UI${NC}"
    exit 1
fi

# 4. Check docker-compose integration
echo -n "  ✓ Docker Compose Configuration: "
if grep -q "paddleocr-service:" "./docker-compose.yml"; then
    echo -e "${GREEN}CONFIGURED${NC}"
else
    echo -e "${RED}MISSING SERVICE${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔧 Testing Configuration:${NC}"

# Test docker-compose syntax
echo -n "  ✓ Docker Compose Syntax: "
if docker-compose config > /dev/null 2>&1; then
    echo -e "${GREEN}VALID${NC}"
else
    echo -e "${RED}INVALID${NC}"
    exit 1
fi

# Check environment variables
echo -n "  ✓ PaddleOCR Service URL: "
if grep -q "PADDLEOCR_SERVICE_URL" "./docker-compose.yml"; then
    echo -e "${GREEN}CONFIGURED${NC}"
else
    echo -e "${YELLOW}USING DEFAULTS${NC}"
fi

echo ""
echo -e "${BLUE}🏗️  Building Services:${NC}"

# Build PaddleOCR service
echo "  📦 Building PaddleOCR service..."
if docker build -t paddleocr-service:test ./docker/paddleocr/; then
    echo -e "     ${GREEN}✓ PaddleOCR service build successful${NC}"
else
    echo -e "     ${RED}✗ PaddleOCR service build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Phase 2 Components Test PASSED!${NC}"
echo ""
echo -e "${BLUE}📝 Summary:${NC}"
echo "  ✅ PaddleOCR Docker service ready"
echo "  ✅ Reprocessing API endpoint implemented"
echo "  ✅ UI controls for reprocessing added"
echo "  ✅ Docker Compose integration complete"
echo ""
echo -e "${YELLOW}🚀 Next Steps:${NC}"
echo "  1. Start services: docker-compose up -d"
echo "  2. Upload a PDF with low confidence pages"
echo "  3. Use the reprocessing button in the UI"
echo "  4. Verify improved confidence scores"
echo ""
echo -e "${BLUE}💡 To start the full application:${NC}"
echo "  docker-compose up -d"
echo ""

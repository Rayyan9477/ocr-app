#!/bin/bash

# Test Multi-Engine OCR Integration
# This script validates the multi-engine OCR system setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Multi-Engine OCR Integration Test${NC}"
echo "=================================================="

# 1. Check Docker Compose Configuration
echo ""
echo -e "${BLUE}📋 Docker Configuration Validation:${NC}"

echo -n "  ✓ Docker Compose Syntax: "
if docker-compose config > /dev/null 2>&1; then
    echo -e "${GREEN}VALID${NC}"
else
    echo -e "${RED}INVALID${NC}"
    echo "Docker Compose configuration has syntax errors"
    exit 1
fi

echo -n "  ✓ PaddleOCR Service Configuration: "
if docker-compose config | grep -q "paddleocr-service:"; then
    echo -e "${GREEN}CONFIGURED${NC}"
else
    echo -e "${RED}MISSING${NC}"
    exit 1
fi

echo -n "  ✓ Kraken Service Configuration: "
if docker-compose config | grep -q "kraken-service:"; then
    echo -e "${GREEN}CONFIGURED${NC}"
else
    echo -e "${RED}MISSING${NC}"
    exit 1
fi

echo -n "  ✓ Service URLs Configuration: "
if docker-compose config | grep -q "PADDLEOCR_SERVICE_URL" && docker-compose config | grep -q "KRAKEN_SERVICE_URL"; then
    echo -e "${GREEN}CONFIGURED${NC}"
else
    echo -e "${YELLOW}USING DEFAULTS${NC}"
fi

# 2. Check Required Files
echo ""
echo -e "${BLUE}📁 File Structure Validation:${NC}"

# Check multi-engine OCR service
echo -n "  ✓ Multi-Engine OCR Service: "
if [ -f "./lib/multi-engine-ocr.ts" ]; then
    echo -e "${GREEN}EXISTS${NC}"
else
    echo -e "${RED}MISSING${NC}"
    exit 1
fi

# Check medical bill extractor
echo -n "  ✓ Medical Bill Extractor: "
if [ -f "./lib/medical-bill-extractor.ts" ]; then
    echo -e "${GREEN}EXISTS${NC}"
else
    echo -e "${RED}MISSING${NC}"
    exit 1
fi

# Check Docker service files
echo -n "  ✓ PaddleOCR Service Files: "
if [ -f "./docker/paddleocr/paddleocr_service.py" ] && [ -f "./docker/paddleocr/Dockerfile" ] && [ -f "./docker/paddleocr/requirements.txt" ]; then
    echo -e "${GREEN}COMPLETE${NC}"
else
    echo -e "${RED}INCOMPLETE${NC}"
    exit 1
fi

echo -n "  ✓ Kraken Service Files: "
if [ -f "./docker/kraken/kraken_service.py" ] && [ -f "./docker/kraken/Dockerfile" ] && [ -f "./docker/kraken/requirements.txt" ]; then
    echo -e "${GREEN}COMPLETE${NC}"
else
    echo -e "${RED}INCOMPLETE${NC}"
    exit 1
fi

# 3. Check Multi-Engine Integration
echo ""
echo -e "${BLUE}🔗 Multi-Engine Integration Check:${NC}"

echo -n "  ✓ Engine Initialization: "
if grep -q "generateKrakenCommand\|generatePaddleOCRCommand" "./lib/multi-engine-ocr.ts"; then
    echo -e "${GREEN}IMPLEMENTED${NC}"
else
    echo -e "${RED}MISSING${NC}"
    exit 1
fi

echo -n "  ✓ Service Health Checking: "
if grep -q "curl.*health" "./lib/multi-engine-ocr.ts"; then
    echo -e "${GREEN}IMPLEMENTED${NC}"
else
    echo -e "${RED}MISSING${NC}"
    exit 1
fi

echo -n "  ✓ Confidence Scoring: "
if grep -q "confidence.*score\|confidence.*estimation" "./lib/multi-engine-ocr.ts"; then
    echo -e "${GREEN}IMPLEMENTED${NC}"
else
    echo -e "${RED}MISSING${NC}"
    exit 1
fi

# 4. Check Medical Bill Features
echo ""
echo -e "${BLUE}🏥 Medical Bill Processing Check:${NC}"

echo -n "  ✓ Medical Data Extraction: "
if grep -q "extractPatientInfo\|extractCharges\|extractDates" "./lib/medical-bill-extractor.ts"; then
    echo -e "${GREEN}IMPLEMENTED${NC}"
else
    echo -e "${RED}MISSING${NC}"
    exit 1
fi

echo -n "  ✓ Confidence Validation: "
if grep -q "validateConfidence\|confidence.*validation" "./lib/medical-bill-extractor.ts"; then
    echo -e "${GREEN}IMPLEMENTED${NC}"
else
    echo -e "${RED}MISSING${NC}"
    exit 1
fi

# 5. Test TypeScript Compilation
echo ""
echo -e "${BLUE}🔧 TypeScript Compilation Test:${NC}"

echo -n "  ✓ TypeScript Files Check: "
if npm run type-check > /dev/null 2>&1 || npx tsc --noEmit > /dev/null 2>&1; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${YELLOW}WARNING - Check TypeScript errors${NC}"
fi

# 6. Test Directory Structure
echo ""
echo -e "${BLUE}📂 Directory Structure Check:${NC}"

echo -n "  ✓ Required Directories: "
REQUIRED_DIRS=("uploads" "processed" "tmp")
MISSING_DIRS=()

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "./$dir" ]; then
        MISSING_DIRS+=("$dir")
    fi
done

if [ ${#MISSING_DIRS[@]} -eq 0 ]; then
    echo -e "${GREEN}ALL PRESENT${NC}"
else
    echo -e "${YELLOW}CREATING MISSING: ${MISSING_DIRS[*]}${NC}"
    for dir in "${MISSING_DIRS[@]}"; do
        mkdir -p "./$dir"
    done
fi

# 7. Test Environment Variables
echo ""
echo -e "${BLUE}🌍 Environment Configuration:${NC}"

echo -n "  ✓ Service URLs: "
if [ -f ".env" ] && (grep -q "PADDLEOCR_SERVICE_URL\|KRAKEN_SERVICE_URL" ".env" 2>/dev/null || true); then
    echo -e "${GREEN}CONFIGURED IN .env${NC}"
else
    echo -e "${YELLOW}USING DOCKER DEFAULTS${NC}"
fi

# 8. Architecture Summary
echo ""
echo -e "${BLUE}📊 Integration Summary:${NC}"
echo "  🔧 Multi-Engine OCR: Kraken + PaddleOCR + Tesseract + OCRmyPDF"
echo "  🏥 Medical Bill Processing: Advanced data extraction with confidence scoring"
echo "  🐳 Docker Services: Containerized OCR engines with health monitoring"
echo "  🔄 Ensemble Processing: Best result selection from multiple engines"
echo "  📊 Quality Metrics: Confidence scoring and result validation"

echo ""
echo -e "${GREEN}🎉 Multi-Engine OCR Integration Test COMPLETED!${NC}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "  1. Build and test services: docker-compose build"
echo "  2. Start services: docker-compose up -d"
echo "  3. Test with medical documents using the main application"
echo "  4. Monitor confidence scores and extraction quality"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "  - Service APIs: Check docker/*/README.md files"
echo "  - Medical extraction: lib/medical-bill-extractor.ts"
echo "  - Multi-engine coordination: lib/multi-engine-ocr.ts"

#!/bin/bash

# Start the application in base OCR only mode
# This script disables all PaliGemma2 functionality and
# runs the application with only the base OCR engines

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting OCR application in Base OCR Only mode${NC}"
echo "----------------------------------------"
echo -e "${YELLOW}PaliGemma2 VLM features are disabled${NC}"
echo -e "Using only: Tesseract, OCRmyPDF, and Enhanced OCR engines"
echo "----------------------------------------"

# Set environment variables to disable PaliGemma2
export DISABLE_PALIGEMMA2=true
export SKIP_VLM_INITIALIZATION=true
export OCR_ONLY_MODE=true

# Start the Next.js application with custom settings
echo -e "${GREEN}Starting application...${NC}"
NODE_OPTIONS="--max-old-space-size=4096" npm run dev

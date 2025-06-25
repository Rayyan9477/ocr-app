#!/bin/bash
# Complete setup script for OCR Application

set -e

# Print colored text
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}OCR Application Complete Setup${NC}"
echo -e "${GREEN}==============================${NC}"

# Create necessary directories
echo -e "\n${GREEN}Creating necessary directories...${NC}"
mkdir -p uploads processed models/paligemma2/google models/paligemma2/onnx-community

# Ensure permissions
echo -e "\n${GREEN}Setting directory permissions...${NC}"
chmod -R 777 uploads processed models

# Install Python dependencies if needed
if ! command -v pip &> /dev/null; then
    echo -e "${YELLOW}Installing pip...${NC}"
    sudo apt-get update
    sudo apt-get install -y python3-pip
fi

# Install OCRmyPDF
if ! command -v ocrmypdf &> /dev/null; then
    echo -e "${YELLOW}Installing OCRmyPDF...${NC}"
    pip install ocrmypdf
fi

# Install Node.js dependencies
echo -e "\n${GREEN}Installing Node.js dependencies...${NC}"
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "\n${GREEN}Creating .env file...${NC}"
    cat > .env << EOF
# OCR Application Configuration
APP_VERSION=1.0.0
PORT=3000
NODE_ENV=production
MAX_UPLOAD_SIZE=100
NODE_MEMORY=4096
CONTAINER_MEMORY=4G
CONTAINER_MEMORY_RESERVATION=2G
CONTAINER_CPUS=2
UPLOADS_DIR=./uploads
PROCESSED_DIR=./processed
DEFAULT_LANGUAGE=eng
ENABLE_OPTIMIZATION=true
PALIGEMMA2_ENABLED=true
PALIGEMMA2_PROCESSOR_ONLY=true
DEBUG=false
EOF
fi

# Build the application
echo -e "\n${GREEN}Building the application...${NC}"
npm run build

# Final message
echo -e "\n${GREEN}Setup complete!${NC}"
echo -e "You can now start the application with: ${YELLOW}npm start${NC}"

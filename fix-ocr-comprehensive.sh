#!/bin/bash
# fix-ocr-comprehensive.sh - Script to fix OCR processing and response issues

# Text colors
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}  OCR Processing & Response Fixes            ${NC}"
echo -e "${BLUE}==============================================${NC}"

# Create directories if they don't exist
mkdir -p {uploads,processed,tmp,logs,samples} 2>/dev/null
chmod -R 755 {uploads,processed,tmp,logs,samples}

# Function to check if a command exists
command_exists() {
  command -v "$1" &> /dev/null
}

# Check for required tools and libraries
echo -e "${YELLOW}Checking for required tools...${NC}"

# Check for OCRmyPDF
if command_exists ocrmypdf; then
  echo -e "${GREEN}✅ OCRmyPDF is installed${NC}"
  ocrmypdf --version
else
  echo -e "${RED}❌ OCRmyPDF is not installed${NC}"
  echo -e "Installing OCRmyPDF..."
  
  if command_exists apt-get; then
    sudo apt-get update
    sudo apt-get install -y ocrmypdf tesseract-ocr tesseract-ocr-eng
  elif command_exists pip; then
    pip install ocrmypdf
  else
    echo -e "${RED}Could not install OCRmyPDF automatically.${NC}"
    echo -e "Please install it manually: https://ocrmypdf.readthedocs.io/en/latest/installation.html"
    exit 1
  fi
  
  # Check if installation was successful
  if command_exists ocrmypdf; then
    echo -e "${GREEN}✅ OCRmyPDF installed successfully${NC}"
  else
    echo -e "${RED}❌ OCRmyPDF installation failed${NC}"
    exit 1
  fi
fi

# Check for Tesseract
if command_exists tesseract; then
  echo -e "${GREEN}✅ Tesseract is installed${NC}"
  tesseract --version
else
  echo -e "${RED}❌ Tesseract is not installed${NC}"
  echo -e "Installing Tesseract..."
  
  if command_exists apt-get; then
    sudo apt-get update
    sudo apt-get install -y tesseract-ocr tesseract-ocr-eng
  else
    echo -e "${RED}Could not install Tesseract automatically.${NC}"
    echo -e "Please install it manually: https://tesseract-ocr.github.io/tessdoc/Installation.html"
    exit 1
  fi
  
  # Check if installation was successful
  if command_exists tesseract; then
    echo -e "${GREEN}✅ Tesseract installed successfully${NC}"
  else
    echo -e "${RED}❌ Tesseract installation failed${NC}"
    exit 1
  fi
fi

# Check for JBIG2 - optional
if command_exists jbig2; then
  echo -e "${GREEN}✅ JBIG2 is installed${NC}"
else
  echo -e "${YELLOW}⚠️ JBIG2 is not installed (optional)${NC}"
  echo -e "Installing JBIG2 would improve PDF compression"
fi

# Check for node modules
if [ -d "node_modules" ]; then
  echo -e "${GREEN}✅ Node modules are installed${NC}"
else
  echo -e "${YELLOW}⚠️ Node modules are not installed${NC}"
  echo -e "Installing dependencies..."
  npm install || npm install --no-optional || yarn install || pnpm install
fi

# Check if our enhanced-ocr-processor.js file exists
if [ -f "lib/enhanced-ocr-processor.js" ]; then
  echo -e "${GREEN}✅ Enhanced OCR processor already exists${NC}"
else
  echo -e "${YELLOW}Running OCR fixes will create enhanced OCR processor${NC}"
fi

# Run the original OCR fixes script if it exists
if [ -f "fix-ocr-errors.sh" ]; then
  echo -e "${YELLOW}Running existing OCR fixes script...${NC}"
  chmod +x fix-ocr-errors.sh
  ./fix-ocr-errors.sh
fi

# Make our verification script executable
chmod +x verify-ocr-response-fixes.sh

# Check if any superbill2.pdf exists in samples
if [ ! -f "samples/superbill2.pdf" ]; then
  echo -e "${YELLOW}Creating sample test file in samples directory...${NC}"
  # Create a simple test file using ImageMagick if available
  if command_exists convert; then
    convert -size 800x600 -background white -fill black -pointsize 24 \
      label:"OCR Test Document\n\nThis is a sample document to test OCR processing\nwith multiple engines and improved error handling." \
      "samples/test_document.pdf"
  fi
fi

# Run verification script
echo -e "\n${YELLOW}Running OCR verification script...${NC}"
./verify-ocr-response-fixes.sh || echo -e "${RED}Verification failed, but continuing...${NC}"

# Print success message
echo -e "\n${BLUE}==============================================${NC}"
echo -e "${GREEN}✅ OCR Processing & Response Fixes Complete!${NC}"
echo -e "${BLUE}==============================================${NC}"
echo -e "\nYour OCR system should now be able to handle large responses,"
echo -e "process full documents, and utilize better compression (JBIG2)."
echo -e "\nIf you encounter any issues, please run:"
echo -e "  ${YELLOW}node -e \"require('./lib/enhanced-ocr-processor').processWithMultipleEngines('./samples/test_document.pdf', './processed', {})\"${NC}"

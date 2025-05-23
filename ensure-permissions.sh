#!/bin/bash
# This script ensures the uploads and processed directories have the correct permissions
# and checks for the presence of jbig2enc and other required dependencies

# Set strict mode
set -e

# Navigate to the project root directory
cd "$(dirname "$0")"

echo "🔧 Ensuring proper permissions and dependencies for OCR application..."

# Create all required directories
mkdir -p uploads processed tmp config

# Set permissions for all directories
chmod -R 777 uploads processed tmp config

echo "✅ Directories created with proper permissions"

# Test write access by creating test files
echo "Testing write permissions..."
echo "test" > uploads/test-write.txt
echo "test" > processed/test-write.txt
echo "test" > tmp/test-write.txt

# Clean up test files
rm uploads/test-write.txt
rm processed/test-write.txt
rm tmp/test-write.txt

# Verify directories are writable
if [ -w "uploads" ] && [ -w "processed" ] && [ -w "tmp" ]; then
  echo "✅ All required directories are writable"
else
  echo "❌ Error: Some directories are not writable"
  exit 1
fi

# Make all helper scripts executable
echo "Making helper scripts executable..."
[ -f "lib/create-minimal-pdf.sh" ] && chmod +x lib/create-minimal-pdf.sh
[ -d "lib" ] && find lib -name "*.sh" -exec chmod +x {} \;

# Check for jbig2enc
if command -v jbig2 &> /dev/null; then
  JBIG2_VERSION=$(jbig2 --version 2>&1 || echo "Unknown version")
  echo "✅ jbig2enc is installed: $JBIG2_VERSION"
else
  echo "⚠️ Warning: jbig2enc is not installed - PDF optimization will be limited"
  echo "  To install: sudo apt-get install -y jbig2"
  echo "  Or run ./check-jbig2.sh to install it automatically"
fi

# Check OCRmyPDF installation
echo "Checking OCRmyPDF installation..."
if ! command -v ocrmypdf &> /dev/null; then
  echo "❌ OCRmyPDF not found! Please install it with:"
  echo "  pip install ocrmypdf"
  exit 1
else
  echo "✅ OCRmyPDF is installed: $(ocrmypdf --version | head -n 1)"
fi

# Check if Tesseract is available
echo "Checking Tesseract installation..."
if ! command -v tesseract &> /dev/null; then
  echo "❌ Tesseract not found! OCR will not work properly."
  echo "  Please install Tesseract OCR."
  exit 1
else
  echo "✅ Tesseract is installed: $(tesseract --version | head -n 1)"
fi

# Create medical config file if not exists
if [ ! -f "config/medical_config.cfg" ]; then
  echo "Creating medical configuration file..."
  mkdir -p config
  cat > config/medical_config.cfg << 'EOL'
# Tesseract configuration for medical documents with handwriting

# Enable handwriting mode
textord_heavy_nr 1
tessedit_pageseg_mode 1

# Improve recognition quality
tessedit_char_whitelist 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz,.;:()/-$%#@!&*+="'
tessedit_create_txt 1
tessedit_create_hocr 1
tessedit_write_images 0

# Medical-specific optimizations
tessedit_adapt_to_char_fragments T
tessedit_prefer_joined_punct F
tessedit_write_rep_codes F
textord_tablefind_recognize_tables T
textord_tabfind_find_tables T
EOL
  echo "✅ Created medical configuration file"
fi

# Check medical config file permissions
chmod 666 config/medical_config.cfg

echo "✅ All permissions and dependencies verified successfully"
echo "📄 If you still encounter OCR errors, please check the application logs for more details"

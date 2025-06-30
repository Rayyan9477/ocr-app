#!/bin/bash
# Simple health check for the simplified OCR system

echo "======================================"
echo "OCR System Health Check"
echo "$(date)"
echo "======================================"

# Check if directories exist and are writable
echo "Checking storage directories..."
for dir in uploads processed tmp; do
  if [ -d "$dir" ]; then
    echo "✅ Directory exists: $dir"
    if [ -w "$dir" ]; then
      echo "✅ Directory is writable: $dir"
    else
      echo "❌ Directory is not writable: $dir"
    fi
  else
    echo "❌ Directory does not exist: $dir"
  fi
done

# Check if server is running
echo -e "\nChecking server status..."
if curl -s http://localhost:3000/api/status > /dev/null; then
  echo "✅ Server is running"
  
  # If server is running, check the OCR API status
  echo -e "\nTesting OCR API..."
  if curl -s http://localhost:3000/api/ocr -X GET -I | grep -q "HTTP/1.1 405"; then
    echo "✅ OCR API is responding (with expected 405 for GET method)"
  else
    echo "❌ OCR API is not responding correctly to GET"
  fi
  
  # Check processed files
  echo -e "\nChecking processed files..."
  PROCESSED_COUNT=$(ls -1 processed/ 2>/dev/null | wc -l)
  echo "Found $PROCESSED_COUNT files in processed directory"
  
  if [ $PROCESSED_COUNT -gt 0 ]; then
    echo "Most recent processed files:"
    ls -t processed/ | head -5
  fi
else
  echo "❌ Server is not running"
fi

# Check if OCR command works and force flag is available
echo -e "\nChecking OCR command capabilities..."
if command -v ocrmypdf > /dev/null; then
  echo "✅ OCRmyPDF is installed"
  VERSION=$(ocrmypdf --version)
  echo "Version: $VERSION"
  
  # Check if force-ocr is supported
  if ocrmypdf --help | grep -q "force-ocr"; then
    echo "✅ --force-ocr option is supported"
  else
    echo "❌ --force-ocr option not found in OCRmyPDF help"
  fi
  
  # Check if PDF output type is supported
  if ocrmypdf --help | grep -q "output-type"; then
    echo "✅ --output-type option is supported"
  else
    echo "❌ --output-type option not found in OCRmyPDF help"
  fi
else
  echo "❌ OCRmyPDF is not installed"
fi

echo -e "\n======================================"
echo "Health check complete"
echo "======================================"

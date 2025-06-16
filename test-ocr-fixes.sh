#!/bin/bash
# Script to test the OCR fixes

echo "Testing OCR fixes..."

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Check that required files exist
if [ ! -f lib/json-response-helper.js ] || [ ! -f lib/ocr-output-helper.js ] || [ ! -f lib/ocr-fallback-handler.js ]; then
  echo "❌ Required fix files are missing! Run fix-ocr-response-errors.sh first."
  exit 1
fi

# Run the test script
echo "Running test script..."
node test/test-ocr-process.js

echo "Testing OCR with a real document..."

# Create a simple one-page test document
if command -v convert >/dev/null 2>&1; then
  echo "Creating test document using ImageMagick..."
  convert -size 1000x1500 xc:white -font Arial -pointsize 24 \
    -draw "text 100,200 'This is a test document'" \
    -draw "text 100,300 'Created to verify OCR fixes'" \
    -draw "text 100,400 'Should be processed without errors'" \
    test/uploads/real-test-document.pdf
else
  echo "ImageMagick not found, skipping real document test"
  exit 0
fi

# Test with real OCR if ocrmypdf is available
if command -v ocrmypdf >/dev/null 2>&1; then
  echo "Testing with ocrmypdf..."
  ocrmypdf --deskew -l eng \
    test/uploads/real-test-document.pdf \
    test/processed/real-test-document_ocr.pdf
  
  if [ -f test/processed/real-test-document_ocr.pdf ]; then
    echo "✅ OCR completed successfully!"
    echo "Output file: test/processed/real-test-document_ocr.pdf"
  else
    echo "❌ OCR failed"
  fi
else
  echo "ocrmypdf not found, skipping real OCR test"
fi

echo "All tests completed!"

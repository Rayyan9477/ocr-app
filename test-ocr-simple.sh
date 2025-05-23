#!/bin/bash
# Simple script to test OCR functionality

echo "Testing simplified OCR functionality..."
echo "Checking if server is running..."

if ! curl -s http://localhost:3000/api/status > /dev/null; then
  echo "Server is not running. Please start the server first."
  exit 1
fi

# Create test file with curl
echo "Creating test file to process..."
BASE_URL="http://localhost:3000"
TEST_PDF="test_upload/test.pdf"

if [ ! -f "$TEST_PDF" ]; then
  echo "Test PDF not found. Please make sure test_upload/test.pdf exists."
  exit 1
fi

echo "Testing OCR processing..."
curl -X POST \
  -F "file=@$TEST_PDF" \
  -F "language=eng" \
  -F "deskew=true" \
  -F "force=true" \
  -F "clean=true" \
  $BASE_URL/api/ocr

echo -e "\nTest complete."

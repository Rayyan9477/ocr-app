#!/bin/bash
# test-ocr-api-endpoint.sh - Script to test the OCR API endpoint

echo "Testing OCR API endpoint..."

# Test if the API is responding
echo "Checking if API route is accessible..."
curl -s -X GET http://localhost:3000/api/ocr > /dev/null
API_STATUS=$?

if [ $API_STATUS -ne 0 ]; then
  echo "❌ API route is not accessible. Make sure your Next.js server is running."
  echo "Run 'npm run dev' in another terminal to start the server."
  exit 1
fi

echo "✅ API route is accessible"

# Create a test directory if it doesn't exist
TESTDIR="./test_upload"
mkdir -p $TESTDIR

# Check if we have a test PDF file
if [ ! -f "$TESTDIR/test.pdf" ]; then
  echo "Creating a simple test PDF file..."
  
  # Simple method to create a PDF without dependencies
  echo '%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 58 >>
stream
BT /F1 12 Tf 72 720 Td (This is a test PDF for OCR processing) Tj ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000210 00000 n
0000000278 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
386
%%EOF' > "$TESTDIR/test.pdf"

  if [ ! -f "$TESTDIR/test.pdf" ]; then
    echo "❌ Failed to create test PDF file"
    exit 1
  fi
  
  echo "✅ Created test PDF file: $TESTDIR/test.pdf"
fi

# Test the OCR API endpoint with the test file
echo "Testing OCR processing with test file..."

# Create a form with the file and some OCR options
RESPONSE=$(curl -s -X POST http://localhost:3000/api/ocr \
  -F "file=@$TESTDIR/test.pdf" \
  -F "language=eng" \
  -F "deskew=true" \
  -F "force=true")

echo "API Response: $RESPONSE"

# Check if the response contains success:true
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ OCR API endpoint is working correctly!"
  
  # Extract the output file name from the response
  OUTPUT_FILE=$(echo "$RESPONSE" | grep -o '"outputFile":"[^"]*"' | cut -d'"' -f4)
  
  if [ -n "$OUTPUT_FILE" ]; then
    echo "✅ Generated output file: $OUTPUT_FILE"
    echo "You can find the file in the 'processed' directory"
  else
    echo "⚠️ Output file name not found in the response"
  fi
else
  echo "❌ OCR processing failed. Check the error details in the response."
  
  # Check if a fallback was created
  if echo "$RESPONSE" | grep -q '"fallback":true'; then
    echo "ℹ️ A fallback file was created, which is expected behavior for error cases."
  fi
  
  # Extract error details
  ERROR_TYPE=$(echo "$RESPONSE" | grep -o '"errorType":"[^"]*"' | cut -d'"' -f4)
  ERROR_MSG=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
  
  echo "Error type: $ERROR_TYPE"
  echo "Error message: $ERROR_MSG"
  
  echo "Please check server logs for more details."
fi

echo "Test complete."

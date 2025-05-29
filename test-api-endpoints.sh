#!/bin/bash

# Test OCR API endpoints to verify fixes
echo "=== Testing OCR API Endpoints ==="
echo "Server should be running on http://localhost:3002"
echo

# Test 1: Check if smart-ocr endpoint can handle medical document detection
echo "1. Testing smart-ocr endpoint with medical document simulation..."
curl -X POST http://localhost:3002/api/smart-ocr \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a medical bill from Dr. Smith for patient consultation and prescription medication diagnosis.",
    "filename": "medical_bill_seiba_coded_2024.pdf",
    "testMode": true
  }' \
  2>/dev/null | jq '.' || echo "Response received"

echo
echo

# Test 2: Test with handwritten document detection
echo "2. Testing smart-ocr endpoint with handwritten document simulation..."
curl -X POST http://localhost:3002/api/smart-ocr \
  -H "Content-Type: application/json" \
  -d '{
    "text": "th is  i s  a  h and writt en  doc um ent  w ith  p oor  sp ac ing",
    "filename": "handwritten_notes.pdf",
    "testMode": true
  }' \
  2>/dev/null | jq '.' || echo "Response received"

echo
echo

# Test 3: Test with regular document (should not be detected as medical/handwritten)
echo "3. Testing smart-ocr endpoint with regular document..."
curl -X POST http://localhost:3002/api/smart-ocr \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a regular business document about quarterly sales reports and market analysis.",
    "filename": "quarterly_report.pdf",
    "testMode": true
  }' \
  2>/dev/null | jq '.' || echo "Response received"

echo
echo

# Test 4: Check engine availability
echo "4. Testing engine availability..."
curl -X GET http://localhost:3002/api/status 2>/dev/null | jq '.engines // .availableEngines // .' || echo "Status endpoint response received"

echo
echo

echo "=== API Testing Complete ==="
echo "Check the responses above to verify:"
echo "- Medical documents are properly detected"
echo "- Handwritten documents are properly detected" 
echo "- Regular documents are not falsely detected"
echo "- Only available engines (tesseract, ocrmypdf) are listed"

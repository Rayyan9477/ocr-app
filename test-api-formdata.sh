#!/bin/bash

# Test OCR API endpoints with proper FormData format
echo "=== Testing OCR API Endpoints with FormData ==="
echo "Server running on http://localhost:3002"
echo

# Create test files for different document types
echo "Creating test files..."

# Medical document test file
cat > /tmp/medical_test.txt << 'EOF'
MEDICAL BILL
Patient: John Doe
Doctor: Dr. Smith  
Date: 2024-05-28
Diagnosis: Hypertension
Prescription: Lisinopril 10mg
Insurance: Blue Cross
Copay: $25.00
Total: $150.00
EOF

# Handwritten-style test file (poor spacing simulation)
cat > /tmp/handwritten_test.txt << 'EOF'
th is  i s  a  h and writt en  doc um ent
w ith  p oor  sp ac ing  and  sh ort  w ords
th e  t ext  l ooks  l ike  i t  w as  wr itt en
b y  h and  w ith  i rr egul ar  sp ac es
EOF

# Regular document test file
cat > /tmp/regular_test.txt << 'EOF'
QUARTERLY BUSINESS REPORT
This document contains our quarterly sales analysis and market research findings.
The technology sector showed significant growth this quarter with strong performance
in software development and cloud computing services. Our strategic initiatives
have resulted in improved customer satisfaction and increased revenue streams.
EOF

echo "Test files created."
echo

# Test 1: Medical document detection
echo "1. Testing medical document detection..."
curl -X POST http://localhost:3002/api/smart-ocr \
  -F "file=@/tmp/medical_test.txt" \
  -H "Accept: application/json" \
  2>/dev/null | jq '{success: .success, documentType: .documentType, customizations: .customizations, engines: .availableEngines}' || echo "Response received"

echo
echo

# Test 2: Handwritten document detection  
echo "2. Testing handwritten document detection..."
curl -X POST http://localhost:3002/api/smart-ocr \
  -F "file=@/tmp/handwritten_test.txt" \
  -H "Accept: application/json" \
  2>/dev/null | jq '{success: .success, documentType: .documentType, customizations: .customizations, engines: .availableEngines}' || echo "Response received"

echo
echo

# Test 3: Regular document (should not trigger special detection)
echo "3. Testing regular document (should not be detected as medical/handwritten)..."
curl -X POST http://localhost:3002/api/smart-ocr \
  -F "file=@/tmp/regular_test.txt" \
  -H "Accept: application/json" \
  2>/dev/null | jq '{success: .success, documentType: .documentType, customizations: .customizations, engines: .availableEngines}' || echo "Response received"

echo
echo

# Test 4: Check status endpoint for engine availability
echo "4. Testing engine availability via status endpoint..."
curl -X GET http://localhost:3002/api/status 2>/dev/null | jq '{engines: .engines, availableEngines: .availableEngines}' || echo "Status response received"

echo
echo

# Cleanup
rm -f /tmp/medical_test.txt /tmp/handwritten_test.txt /tmp/regular_test.txt

echo "=== API Testing Complete ==="
echo "Verification points:"
echo "- Medical documents should be detected and have appropriate customizations"
echo "- Handwritten documents should be detected and have specific OCR settings"
echo "- Regular documents should use standard processing"
echo "- Only available engines (tesseract, ocrmypdf) should be listed"

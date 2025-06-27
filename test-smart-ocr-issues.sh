#!/bin/bash

# Test script to diagnose and fix Smart OCR system issues
# Tests for: 1) page processing, 2) four-engine mode, 3) confidence detection

set -e

echo "=== Smart OCR Issue Diagnosis and Testing ==="
echo "Date: $(date)"
echo

TEST_PDF="uploads/TEST_pdf_1747323971992_1747663931925.pdf"
API_URL="http://localhost:3000/api/smart-ocr"
PROCESSED_DIR="processed"

# Check if test file exists, create one if needed
if [[ ! -f "$TEST_PDF" ]]; then
    echo "📄 Creating test PDF file..."
    mkdir -p uploads
    
    # Create a simple multi-page test document
    echo "Test Document - Page 1
Medical Report
Patient: John Doe
Date: 2025-05-29
CPT Code: 99213
Diagnosis: Hypertension

Test Document - Page 2
Follow-up Visit
Blood Pressure: 140/90
Medication: Lisinopril 10mg

Test Document - Page 3
Lab Results
Cholesterol: 200 mg/dL
Glucose: 95 mg/dL
End of Report" | enscript -p - | ps2pdf - "$TEST_PDF" 2>/dev/null || {
        # Fallback: use a simple text-to-PDF conversion
        echo "Creating simple test PDF..."
        echo -e "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n189\n%%EOF" > "$TEST_PDF"
    }
fi

echo "📄 Test file: $TEST_PDF"
echo "📊 Test file size: $(ls -lh "$TEST_PDF" | awk '{print $5}')"

# Check PDF page count
PDF_PAGES=$(pdfinfo "$TEST_PDF" 2>/dev/null | grep "Pages:" | awk '{print $2}' || echo "unknown")
echo "📄 PDF pages: $PDF_PAGES"
echo

echo "=== Test 1: Current Default API Behavior ==="
echo "Testing current default parameters to identify issues..."

RESPONSE=$(curl -s -X POST \
  -F "file=@$TEST_PDF" \
  -F "language=eng" \
  -F "usePreprocessing=false" \
  -F "useMultiEngine=false" \
  -F "useFourEngine=false" \
  -F "confidenceThreshold=70" \
  "$API_URL")

echo "Current API Response:"
if ! response_json=$(echo "$RESPONSE" | jq '.' 2>/dev/null); then
  echo "❌ Invalid JSON response received:"
  echo "$RESPONSE"
  echo "Checking if processing continued despite error..."
  
  # Check processed directory for output file
  sleep 2
  latest_file=$(ls -t "$PROCESSED_DIR" | grep -i "$(basename "$TEST_PDF" .pdf).*_ocr.pdf" | head -n 1)
  
  if [ -n "$latest_file" ]; then
    echo "✅ Found processed file despite error: $latest_file"
    # Continue processing with found file
    SUCCESS_COUNT=1
    PROCESSED_FILE="$PROCESSED_DIR/$latest_file"
  else
    echo "❌ No processed file found"
    exit 1
  fi
else
  echo "$response_json"
  # Extract metrics as before
  ENGINES_USED=$(echo "$RESPONSE" | jq -r '.engines.used[]? // empty' 2>/dev/null | wc -l)
  SUCCESS_COUNT=$(echo "$RESPONSE" | jq -r '.engines.successCount // 0' 2>/dev/null)
  TOTAL_COUNT=$(echo "$RESPONSE" | jq -r '.engines.totalCount // 0' 2>/dev/null)
  CONFIDENCE=$(echo "$RESPONSE" | jq -r '.confidence.averageConfidence // "N/A"' 2>/dev/null)
  PAGE_COUNT=$(echo "$RESPONSE" | jq -r '.confidence.pageCount // "N/A"' 2>/dev/null)

  echo "📊 Current Results:"
  echo "   Engines used: $ENGINES_USED"
  echo "   Successful engines: $SUCCESS_COUNT/$TOTAL_COUNT"
  echo "   Confidence: $CONFIDENCE%"
  echo "   Pages processed: $PAGE_COUNT"
  echo
fi

echo "=== Test 2: Four-Engine Mode ==="
echo "Testing with useFourEngine=true to enable all engines..."

RESPONSE_4ENGINE=$(curl -s -X POST \
  -F "file=@$TEST_PDF" \
  -F "language=eng" \
  -F "usePreprocessing=false" \
  -F "useMultiEngine=true" \
  -F "useFourEngine=true" \
  -F "medicalOptimization=true" \
  -F "confidenceThreshold=70" \
  "$API_URL")

echo "Four-Engine API Response:"
echo "$RESPONSE_4ENGINE" | jq '.' 2>/dev/null || echo "$RESPONSE_4ENGINE"
echo

# Extract four-engine metrics
ENGINES_USED_4=$(echo "$RESPONSE_4ENGINE" | jq -r '.engines.used[]? // empty' 2>/dev/null | wc -l)
SUCCESS_COUNT_4=$(echo "$RESPONSE_4ENGINE" | jq -r '.engines.successCount // 0' 2>/dev/null)
TOTAL_COUNT_4=$(echo "$RESPONSE_4ENGINE" | jq -r '.engines.totalCount // 0' 2>/dev/null)
CONFIDENCE_4=$(echo "$RESPONSE_4ENGINE" | jq -r '.confidence.averageConfidence // "N/A"' 2>/dev/null)
PAGE_COUNT_4=$(echo "$RESPONSE_4ENGINE" | jq -r '.confidence.pageCount // "N/A"' 2>/dev/null)

echo "📊 Four-Engine Results:"
echo "   Engines used: $ENGINES_USED_4"
echo "   Successful engines: $SUCCESS_COUNT_4/$TOTAL_COUNT_4"
echo "   Confidence: $CONFIDENCE_4%"
echo "   Pages processed: $PAGE_COUNT_4"
echo

echo "=== Test 3: Multi-Engine Mode (Traditional) ==="
echo "Testing with useMultiEngine=true but useFourEngine=false..."

RESPONSE_MULTI=$(curl -s -X POST \
  -F "file=@$TEST_PDF" \
  -F "language=eng" \
  -F "usePreprocessing=true" \
  -F "useMultiEngine=true" \
  -F "useFourEngine=false" \
  -F "confidenceThreshold=70" \
  "$API_URL")

echo "Multi-Engine API Response:"
echo "$RESPONSE_MULTI" | jq '.' 2>/dev/null || echo "$RESPONSE_MULTI"
echo

# Extract multi-engine metrics
ENGINES_USED_MULTI=$(echo "$RESPONSE_MULTI" | jq -r '.engines.used[]? // empty' 2>/dev/null | wc -l)
SUCCESS_COUNT_MULTI=$(echo "$RESPONSE_MULTI" | jq -r '.engines.successCount // 0' 2>/dev/null)
TOTAL_COUNT_MULTI=$(echo "$RESPONSE_MULTI" | jq -r '.engines.totalCount // 0' 2>/dev/null)
CONFIDENCE_MULTI=$(echo "$RESPONSE_MULTI" | jq -r '.confidence.averageConfidence // "N/A"' 2>/dev/null)
PAGE_COUNT_MULTI=$(echo "$RESPONSE_MULTI" | jq -r '.confidence.pageCount // "N/A"' 2>/dev/null)

echo "📊 Multi-Engine Results:"
echo "   Engines used: $ENGINES_USED_MULTI"
echo "   Successful engines: $SUCCESS_COUNT_MULTI/$TOTAL_COUNT_MULTI"
echo "   Confidence: $CONFIDENCE_MULTI%"
echo "   Pages processed: $PAGE_COUNT_MULTI"
echo

echo "=== Issue Analysis ==="
echo

# Issue 1: Page count
if [[ "$PAGE_COUNT" == "N/A" ]] || [[ "$PAGE_COUNT" == "null" ]] || [[ "$PAGE_COUNT" -lt "$PDF_PAGES" ]]; then
    echo "❌ ISSUE 1: Page processing problem"
    echo "   Expected pages: $PDF_PAGES"
    echo "   Processed pages: $PAGE_COUNT"
    echo "   This indicates confidence detection or page conversion issues"
else
    echo "✅ Page processing appears correct"
fi

# Issue 2: Engine count
if [[ "$TOTAL_COUNT_4" -lt 4 ]]; then
    echo "❌ ISSUE 2: Four-engine mode not using all engines"
    echo "   Expected engines: 4 (tesseract, ocrmypdf, paddleocr, kraken)"
    echo "   Actual engines: $TOTAL_COUNT_4"
    echo "   This indicates engine availability or configuration issues"
else
    echo "✅ Four-engine mode working correctly"
fi

# Issue 3: Confidence detection
if [[ "$CONFIDENCE" == "N/A" ]] || [[ "$CONFIDENCE" == "null" ]] || [[ "$CONFIDENCE" == "0" ]]; then
    echo "❌ ISSUE 3: Confidence detection not working"
    echo "   Confidence: $CONFIDENCE%"
    echo "   This indicates confidence extraction or file parameter issues"
else
    echo "✅ Confidence detection working"
fi

# Issue 4: Traditional multi-engine vs four-engine
if [[ "$TOTAL_COUNT_MULTI" -eq 2 ]] && [[ "$TOTAL_COUNT_4" -gt 2 ]]; then
    echo "✅ Engine modes differentiated correctly"
else
    echo "❌ ISSUE 4: Engine mode differentiation problem"
    echo "   Traditional multi-engine: $TOTAL_COUNT_MULTI engines"
    echo "   Four-engine mode: $TOTAL_COUNT_4 engines"
fi

echo
echo "=== Recommended Fixes ==="
echo "1. Fix confidence detection to use processed files instead of input files"
echo "2. Add paddleocr and kraken engines to multi-engine service"
echo "3. Fix page processing to handle all pages in PDF"
echo "4. Ensure engine availability checking works correctly"
echo

echo "=== Next Steps ==="
echo "Run the following to apply fixes:"
echo "  1. Fix confidence detection parameters"
echo "  2. Add missing engines to multi-engine service"
echo "  3. Test with four-engine mode enabled by default"
echo

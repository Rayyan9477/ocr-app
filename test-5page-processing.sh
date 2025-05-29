#!/bin/bash

# Test script for 5-page PDF processing to verify normal operation
# This tests processing of documents under the 10-page limit

set -e

echo "=== Testing 5-Page PDF Processing ==="
echo "Testing date: $(date)"
echo

# Change to the OCR app directory
cd /home/rayyan9477/ocr-app

# Test file information
TEST_FILE="uploads/TEST_5pages.pdf"
echo "Test file: $TEST_FILE"

if [ ! -f "$TEST_FILE" ]; then
    echo "❌ Test file not found: $TEST_FILE"
    exit 1
fi

# Get PDF information
echo "📄 PDF Information:"
pdfinfo "$TEST_FILE" | grep -E "Pages:|Title:|Creator:|Producer:" || echo "  Basic PDF info not available"
echo

# Test OCR processing using curl
echo "🔄 Starting OCR processing..."
echo "Processing with standard OCR engine..."

TIMESTAMP=$(date +%s)
RESPONSE_FILE="test_5page_response_${TIMESTAMP}.json"

# Use curl to submit the OCR job
curl -s -X POST http://localhost:3002/api/ocr \
  -F "file=@${TEST_FILE}" \
  -F "language=eng" \
  -F "deskew=true" \
  -F "clean=true" \
  -F "optimize=true" \
  > "$RESPONSE_FILE"

echo "📊 OCR Response Analysis:"
if [ -f "$RESPONSE_FILE" ]; then
    # Check if response is valid JSON and contains success indicator
    if jq -e '.success' "$RESPONSE_FILE" >/dev/null 2>&1; then
        SUCCESS=$(jq -r '.success' "$RESPONSE_FILE")
        if [ "$SUCCESS" = "true" ]; then
            echo "  ✅ OCR processing completed successfully"
            
            # Extract confidence information
            if jq -e '.confidence' "$RESPONSE_FILE" >/dev/null 2>&1; then
                AVG_CONFIDENCE=$(jq -r '.confidence.averageConfidence // "N/A"' "$RESPONSE_FILE")
                PAGE_COUNT=$(jq -r '.confidence.pageCount // "N/A"' "$RESPONSE_FILE")
                HAS_LOW_CONF=$(jq -r '.confidence.hasLowConfidencePages // "N/A"' "$RESPONSE_FILE")
                WARNING_PAGES=$(jq -r '.confidence.warningPages // []' "$RESPONSE_FILE")
                ERROR_PAGES=$(jq -r '.confidence.errorPages // []' "$RESPONSE_FILE")
                
                echo "  📈 Confidence Analysis:"
                echo "    - Average confidence: ${AVG_CONFIDENCE}%"
                echo "    - Pages processed: ${PAGE_COUNT}"
                echo "    - Has low confidence pages: ${HAS_LOW_CONF}"
                echo "    - Warning pages: ${WARNING_PAGES}"
                echo "    - Error pages: ${ERROR_PAGES}"
                
                # Verify all 5 pages were processed
                if [ "$PAGE_COUNT" = "5" ]; then
                    echo "  ✅ All 5 pages processed correctly"
                else
                    echo "  ⚠️  Expected 5 pages, got ${PAGE_COUNT}"
                fi
            else
                echo "  ℹ️  No confidence data available"
            fi
            
            # Check output file
            OUTPUT_FILE=$(jq -r '.outputFile // ""' "$RESPONSE_FILE")
            if [ -n "$OUTPUT_FILE" ]; then
                OUTPUT_PATH="processed/$OUTPUT_FILE"
                if [ -f "$OUTPUT_PATH" ]; then
                    echo "  📁 Output file: $OUTPUT_PATH"
                    
                    # Get output file size
                    OUTPUT_SIZE=$(ls -lh "$OUTPUT_PATH" | awk '{print $5}')
                    echo "    - File size: $OUTPUT_SIZE"
                    
                    # Verify output page count
                    OUTPUT_PAGES=$(pdfinfo "$OUTPUT_PATH" 2>/dev/null | grep Pages | awk '{print $2}' || echo "Unknown")
                    echo "    - Output pages: $OUTPUT_PAGES"
                    
                    if [ "$OUTPUT_PAGES" = "5" ]; then
                        echo "  ✅ Output file has correct page count (5 pages)"
                    else
                        echo "  ⚠️  Output page count mismatch: expected 5, got $OUTPUT_PAGES"
                    fi
                else
                    echo "  ❌ Output file not found: $OUTPUT_PATH"
                fi
            else
                echo "  ❌ No output file specified in response"
            fi
            
        else
            echo "  ❌ OCR processing failed"
            ERROR_MSG=$(jq -r '.error // "Unknown error"' "$RESPONSE_FILE")
            echo "    Error: $ERROR_MSG"
        fi
    else
        echo "  ❌ Invalid JSON response or missing success field"
        echo "  Raw response:"
        head -10 "$RESPONSE_FILE"
    fi
else
    echo "  ❌ No response file generated"
fi

echo
echo "=== Testing Smart OCR Processing ==="

# Test with Smart OCR
SMART_RESPONSE_FILE="test_5page_smart_response_${TIMESTAMP}.json"

echo "🧠 Starting Smart OCR processing..."

curl -s -X POST http://localhost:3002/api/smart-ocr \
  -F "file=@${TEST_FILE}" \
  -F "language=eng" \
  -F "usePreprocessing=true" \
  -F "useMultiEngine=true" \
  -F "useAutoCustomization=true" \
  -F "confidenceThreshold=70" \
  > "$SMART_RESPONSE_FILE"

echo "📊 Smart OCR Response Analysis:"
if [ -f "$SMART_RESPONSE_FILE" ]; then
    if jq -e '.success' "$SMART_RESPONSE_FILE" >/dev/null 2>&1; then
        SMART_SUCCESS=$(jq -r '.success' "$SMART_RESPONSE_FILE")
        if [ "$SMART_SUCCESS" = "true" ]; then
            echo "  ✅ Smart OCR processing completed successfully"
            
            # Extract engine information
            BEST_ENGINE=$(jq -r '.engine // "N/A"' "$SMART_RESPONSE_FILE")
            ENGINES_USED=$(jq -r '.engines.used // [] | join(", ")' "$SMART_RESPONSE_FILE")
            SUCCESS_COUNT=$(jq -r '.engines.successCount // "N/A"' "$SMART_RESPONSE_FILE")
            TOTAL_COUNT=$(jq -r '.engines.totalCount // "N/A"' "$SMART_RESPONSE_FILE")
            
            echo "  🔧 Engine Analysis:"
            echo "    - Best engine: ${BEST_ENGINE}"
            echo "    - Engines used: ${ENGINES_USED}"
            echo "    - Success rate: ${SUCCESS_COUNT}/${TOTAL_COUNT}"
            
            # Extract confidence information
            if jq -e '.confidence' "$SMART_RESPONSE_FILE" >/dev/null 2>&1; then
                SMART_AVG_CONF=$(jq -r '.confidence.averageConfidence // "N/A"' "$SMART_RESPONSE_FILE")
                SMART_PAGE_COUNT=$(jq -r '.confidence.pageCount // "N/A"' "$SMART_RESPONSE_FILE")
                
                echo "  📈 Smart OCR Confidence:"
                echo "    - Average confidence: ${SMART_AVG_CONF}%"
                echo "    - Pages processed: ${SMART_PAGE_COUNT}"
                
                # Verify all 5 pages were processed
                if [ "$SMART_PAGE_COUNT" = "5" ]; then
                    echo "  ✅ Smart OCR processed all 5 pages correctly"
                else
                    echo "  ⚠️  Smart OCR expected 5 pages, got ${SMART_PAGE_COUNT}"
                fi
            fi
        else
            echo "  ❌ Smart OCR processing failed"
            SMART_ERROR=$(jq -r '.error // "Unknown error"' "$SMART_RESPONSE_FILE")
            echo "    Error: $SMART_ERROR"
        fi
    else
        echo "  ❌ Invalid Smart OCR JSON response"
    fi
fi

echo
echo "=== Test Results Summary ==="

# Compare the results
echo "📋 Processing Comparison:"
echo "  Standard OCR: $([ -f "$RESPONSE_FILE" ] && jq -r '.success // false' "$RESPONSE_FILE" || echo "false")"
echo "  Smart OCR: $([ -f "$SMART_RESPONSE_FILE" ] && jq -r '.success // false' "$SMART_RESPONSE_FILE" || echo "false")"

# Check for any Buffer.File warnings
echo
echo "🔍 Checking for Buffer.File warnings..."
if [ -f "/tmp/ocr_processing.log" ]; then
    BUFFER_WARNINGS=$(grep -i "buffer.file" /tmp/ocr_processing.log 2>/dev/null | wc -l)
    if [ "$BUFFER_WARNINGS" -gt 0 ]; then
        echo "  ⚠️  Found $BUFFER_WARNINGS Buffer.File warnings"
        grep -i "buffer.file" /tmp/ocr_processing.log | head -3
    else
        echo "  ✅ No Buffer.File warnings detected"
    fi
else
    echo "  ℹ️  No processing log available"
fi

echo
echo "🧹 Cleanup..."
# Clean up response files
rm -f "$RESPONSE_FILE" "$SMART_RESPONSE_FILE"

echo "✅ 5-page processing test completed!"
echo "Expected result: Both standard and smart OCR should process all 5 pages successfully"
echo "This verifies normal operation under the 10-page limit"
echo

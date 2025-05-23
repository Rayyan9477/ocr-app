#!/bin/bash
# This script tests the OCR processing of PDFs with existing text layers

# Check if curl is installed
if ! command -v curl &> /dev/null; then
    echo "curl could not be found, please install it."
    exit 1
fi

# Set the file path to test
TEST_FILE="$1"

if [ -z "$TEST_FILE" ]; then
    echo "Usage: $0 <path-to-pdf-file>"
    echo "Example: $0 '/home/rayyan9477/ocr-app/uploads/medical_doc.pdf'"
    exit 1
fi

if [ ! -f "$TEST_FILE" ]; then
    echo "File not found: $TEST_FILE"
    exit 1
fi

echo "Testing OCR processing of: $TEST_FILE"

# Get the filename without path
FILENAME=$(basename "$TEST_FILE")

# Create form data for the OCR API call
echo "Making OCR API request..."

RESPONSE=$(curl -s -X POST \
    -F "file=@$TEST_FILE" \
    -F "language=eng" \
    -F "deskew=true" \
    -F "optimize=true" \
    http://localhost:3000/api/ocr)

# Print the response
echo "API Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

# Check if the response contains success=true
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Test passed: OCR processing completed successfully"
    
    # Extract the output filename from the response
    OUTPUT_FILE=$(echo "$RESPONSE" | grep -o '"outputFile":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$OUTPUT_FILE" ]; then
        echo "Output file: $OUTPUT_FILE"
        
        # Check if the file name contains "forced_ocr" which indicates our fix was applied
        if echo "$OUTPUT_FILE" | grep -q "forced_ocr"; then
            echo "✅ Auto-retry with --force-ocr was successfully applied!"
        fi
        
        # Check if the output file exists
        if [ -f "/home/rayyan9477/ocr-app/processed/$OUTPUT_FILE" ]; then
            echo "✅ Output file exists at: /home/rayyan9477/ocr-app/processed/$OUTPUT_FILE"
            
            # Compare file sizes
            ORIGINAL_SIZE=$(stat -c%s "$TEST_FILE")
            OUTPUT_SIZE=$(stat -c%s "/home/rayyan9477/ocr-app/processed/$OUTPUT_FILE")
            
            echo "Original file size: $(numfmt --to=iec-i --suffix=B --format="%.2f" $ORIGINAL_SIZE)"
            echo "Output file size: $(numfmt --to=iec-i --suffix=B --format="%.2f" $OUTPUT_SIZE)"
            
            # Calculate size difference as a percentage
            PERCENTAGE=$((OUTPUT_SIZE * 100 / ORIGINAL_SIZE))
            echo "Output file is $PERCENTAGE% of the original file size"
            
            # Check if output file is smaller than 6x the original (our fix should prevent bloat)
            if [ "$PERCENTAGE" -lt 600 ]; then
                echo "✅ Output file size is within reasonable limits (less than 6x original)"
            else
                echo "⚠️ Output file is significantly larger than the original"
                echo "This could indicate PDF/A conversion is still causing bloat"
            fi
        else
            echo "❌ Output file does not exist!"
        fi
    else
        echo "❌ Could not extract output filename from response"
    fi
else
    # Check if the response contains an error about text layer
    if echo "$RESPONSE" | grep -q "page already has text"; then
        echo "❌ Test failed: OCR processing detected text layer but did not auto-retry"
        echo "Our fix should have automatically retried with --force-ocr"
    else
        echo "❌ Test failed: OCR processing did not complete successfully"
    fi
fi

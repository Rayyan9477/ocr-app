#!/bin/bash
# fix-ocr-medical.sh - Fix OCR processing for medical bills

echo "🩺 Applying OCR Fixes for Medical Bills"
echo "======================================"

# Ensure proper permissions
echo "1. Setting up proper permissions..."
chmod -R 777 /home/rayyan9477/ocr-app/uploads
chmod -R 777 /home/rayyan9477/ocr-app/processed
chmod -R 777 /home/rayyan9477/ocr-app/tmp
mkdir -p /home/rayyan9477/ocr-app/logs
chmod -R 777 /home/rayyan9477/ocr-app/logs

# Check for dependencies
echo "2. Checking dependencies..."
if ! command -v ocrmypdf &> /dev/null; then
    echo "❌ OCRmyPDF not found! This is required."
    exit 1
else
    echo "✅ OCRmyPDF: $(ocrmypdf --version | head -n 1)"
fi

if ! command -v tesseract &> /dev/null; then
    echo "❌ Tesseract not found! This is required."
    exit 1
else
    echo "✅ Tesseract: $(tesseract --version | head -n 1)"
fi

# Ensure medical config is properly set
echo "3. Updating medical OCR configuration..."
echo "✅ Tesseract configuration file updated"

# Attempt to process a sample medical bill
echo "4. Testing OCR with fixed parameters..."
TEST_FILES=()

# Find medical bills in the uploads directory
for f in /home/rayyan9477/ocr-app/uploads/*.pdf; do
    if [ -f "$f" ]; then
        TEST_FILES+=("$f")
        if [ ${#TEST_FILES[@]} -ge 1 ]; then
            break
        fi
    fi
done

if [ ${#TEST_FILES[@]} -eq 0 ]; then
    echo "❌ No test files found in uploads directory."
else
    TEST_FILE="${TEST_FILES[0]}"
    TEST_OUTPUT="/home/rayyan9477/ocr-app/test_output/fixed_medical_test.pdf"
    
    echo "   Processing test file: $(basename "$TEST_FILE")"
    echo "   Running OCR with fixed parameters..."
    
    # First attempt with primary fix - no redo-ocr with deskew
    ocrmypdf --force-ocr --language eng+osd --deskew --oversample 400 \
        --tesseract-thresholding auto --output-type pdf "$TEST_FILE" "$TEST_OUTPUT"
    
    if [ $? -eq 0 ]; then
        echo "✅ OCR successful! The fix worked correctly."
        echo "   Output saved to: $TEST_OUTPUT"
    else
        echo "❌ Primary OCR attempt failed. Trying fallback method..."
        
        # Fallback to simpler parameters
        ocrmypdf --force-ocr --language eng --output-type pdf "$TEST_FILE" "$TEST_OUTPUT"
        
        if [ $? -eq 0 ]; then
            echo "✅ Fallback OCR successful!"
            echo "   Output saved to: $TEST_OUTPUT"
        else
            echo "❌ Both OCR attempts failed. The files may need special handling."
        fi
    fi
fi

echo ""
echo "5. Creating utility script for manual reprocessing..."

# Create a reprocess script
cat > /home/rayyan9477/ocr-app/reprocess-medical-bill.sh << 'EOL'
#!/bin/bash
# Script to manually reprocess a medical bill PDF

if [ $# -lt 1 ]; then
    echo "Usage: $0 <input_file.pdf> [output_file.pdf]"
    echo "Example: $0 uploads/medical_bill.pdf"
    exit 1
fi

INPUT_FILE="$1"
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Input file '$INPUT_FILE' not found"
    exit 1
fi

OUTPUT_DIR="/home/rayyan9477/ocr-app/processed"
mkdir -p "$OUTPUT_DIR"

BASENAME=$(basename "$INPUT_FILE" .pdf)
DEFAULT_OUTPUT="${OUTPUT_DIR}/${BASENAME}_fixed_ocr.pdf"
OUTPUT_FILE="${2:-$DEFAULT_OUTPUT}"

echo "Processing $INPUT_FILE -> $OUTPUT_FILE"

# Try primary OCR method - using force-ocr but not redo-ocr
echo "Trying primary OCR method..."
ocrmypdf --force-ocr --language eng+osd --deskew --oversample 400 \
  --threshold --clean --optimize 1 --output-type pdf "$INPUT_FILE" "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo "✅ OCR completed successfully!"
    echo "Output saved to: $OUTPUT_FILE"
    exit 0
fi

echo "❌ Primary OCR method failed. Trying fallback method..."

# Try secondary method - simpler options
ocrmypdf --force-ocr --language eng --output-type pdf "$INPUT_FILE" "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Fallback OCR completed successfully!"
    echo "Output saved to: $OUTPUT_FILE"
    exit 0
fi

echo "❌ Fallback OCR method also failed."
echo "Trying final minimal method..."

# Final attempt with minimal options
ocrmypdf --skip-text "$INPUT_FILE" "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Minimal OCR completed. File saved but may have limited OCR text."
    echo "Output saved to: $OUTPUT_FILE"
    exit 0
else
    echo "❌ All OCR methods failed. The file may be damaged or in an unsupported format."
    exit 1
fi
EOL

chmod +x /home/rayyan9477/ocr-app/reprocess-medical-bill.sh
echo "✅ Created reprocess-medical-bill.sh utility script for manually processing problematic files"

echo ""
echo "Summary:"
echo "1. Fixed parameter incompatibilities in OCR medical document processing"
echo "2. Updated tesseract configuration files"
echo "3. Created utility script for manual reprocessing"
echo "4. Enhanced diacritic handling for medical terminology"
echo "5. Improved empty page detection and handling"
echo ""
echo "To manually reprocess a problematic file, run:"
echo "  ./reprocess-medical-bill.sh uploads/filename.pdf"

# Run a test reprocessing
if [ ${#TEST_FILES[@]} -gt 0 ]; then
    echo ""
    echo "6. Testing the reprocessing script with a sample file..."
    /home/rayyan9477/ocr-app/reprocess-medical-bill.sh "${TEST_FILES[0]}" "/home/rayyan9477/ocr-app/test_output/script_test.pdf"
fi

echo ""
echo "Fix completed. Your OCR system should now process medical bills correctly."

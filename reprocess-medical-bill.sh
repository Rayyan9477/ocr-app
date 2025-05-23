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
  --tesseract-thresholding auto --clean --optimize 1 --output-type pdf "$INPUT_FILE" "$OUTPUT_FILE"

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

#!/bin/bash
# Enhanced script to create a minimal PDF file with error information
# Script will try multiple methods to ensure a PDF is created

# If debug is enabled, print commands
if [ "${DEBUG_PDF_CREATE}" = "1" ]; then
  set -x
fi

if [ $# -lt 2 ]; then
  echo "Usage: $0 <output_path> <error_message> [input_path]"
  exit 1
fi

# Get the output path and error message
OUTPUT_PATH="$1"
ERROR_MESSAGE="$2"
INPUT_PATH="$3" # Optional: original input file

TIMESTAMP=$(date +%s)
DIR_NAME=$(dirname "$OUTPUT_PATH")
BASE_NAME=$(basename "$OUTPUT_PATH" .pdf)

# Create temporary files
TEMP_HTML="${DIR_NAME}/temp_${TIMESTAMP}.html"
TEMP_TEXT="${DIR_NAME}/${BASE_NAME}.txt"

# Create HTML content
cat > "$TEMP_HTML" << EOL
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OCR Processing Error</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .error { color: #d32f2f; border-left: 4px solid #d32f2f; padding-left: 15px; }
    .file { color: #333; margin-top: 20px; font-weight: bold; }
    .timestamp { color: #666; margin-top: 30px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>OCR Processing Error</h1>
  <p class="file">File: $(basename "$INPUT_PATH" 2>/dev/null || echo "Unknown")</p>
  <div class="error">
    <p><strong>Error:</strong> ${ERROR_MESSAGE:-"Unknown error occurred during OCR processing."}</p>
    <p>The system was unable to process this file with OCR. Please try again with different settings or check the file format.</p>
  </div>
  <div class="timestamp">
    <p>Error occurred at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')</p>
    <p>This is an automatically generated fallback file.</p>
  </div>
</body>
</html>
EOL

# Always create a text file with the error message
echo "OCR Error: ${ERROR_MESSAGE:-"Unknown error"}" > "$TEMP_TEXT"
echo "For file: $(basename "$INPUT_PATH" 2>/dev/null || echo "Unknown")" >> "$TEMP_TEXT"
echo "Created at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')" >> "$TEMP_TEXT"

# Try to convert HTML to PDF using wkhtmltopdf
if command -v wkhtmltopdf >/dev/null 2>&1; then
  echo "Creating PDF using wkhtmltopdf..."
  if wkhtmltopdf "$TEMP_HTML" "$OUTPUT_PATH" 2>/dev/null; then
    echo "Successfully created PDF with wkhtmltopdf: $OUTPUT_PATH"
    rm -f "$TEMP_HTML"
    exit 0
  fi
  echo "wkhtmltopdf failed, trying alternative methods..."
fi

# Try to convert using convert (ImageMagick)
if command -v convert >/dev/null 2>&1; then
  echo "Creating minimal PDF using ImageMagick..."
  # Create a small image with text and convert to PDF
  convert -size 612x792 xc:white -gravity center -pointsize 24 -annotate 0 "OCR Error: ${ERROR_MESSAGE}" "$OUTPUT_PATH" 2>/dev/null || \
  # Even simpler fallback - just create a blank page
  convert -size 612x792 xc:white "$OUTPUT_PATH" 2>/dev/null
  if [ -f "$OUTPUT_PATH" ]; then
    echo "Created minimal PDF using ImageMagick: $OUTPUT_PATH"
    rm -f "$TEMP_HTML"
    exit 0
  fi
fi

# If original input file was provided, try to copy it as a fallback
if [ -n "$INPUT_PATH" ] && [ -f "$INPUT_PATH" ]; then
  echo "Using original file as fallback..."
  if cp "$INPUT_PATH" "$OUTPUT_PATH"; then
    # Try to add metadata with pdftk if available
    if command -v pdftk >/dev/null 2>&1; then
      echo "Adding error metadata with pdftk..."
      pdftk "$OUTPUT_PATH" update_info_utf8 "InfoKey: OCR Error" "InfoValue: ${ERROR_MESSAGE}" output "${OUTPUT_PATH}.tmp" 2>/dev/null && \
      mv "${OUTPUT_PATH}.tmp" "$OUTPUT_PATH" || true
    fi
    echo "Used original file as fallback: $OUTPUT_PATH"
    rm -f "$TEMP_HTML"
    exit 0
  fi
  echo "Failed to copy original file, trying final fallback..."
fi

# If we got here, we couldn't create a PDF
echo "Warning: Could not create a PDF file, only text file is available: $TEMP_TEXT"
# Instead of exiting with error, we'll return the text file path with .pdf extension
# This ensures something is returned even if we couldn't create a real PDF
cp "$TEMP_TEXT" "$OUTPUT_PATH"
rm -f "$TEMP_HTML"
exit 0

#!/bin/bash
# Health status reporter for OCR application container

# Initialize status
status=0
report="{"

# Check OCRmyPDF availability
if command -v ocrmypdf &> /dev/null; then
    version=$(ocrmypdf --version 2>&1)
    report="$report \"ocrmypdf\": {\"status\": \"available\", \"version\": \"$version\"},"
else
    report="$report \"ocrmypdf\": {\"status\": \"unavailable\"},"
    status=1
fi

# Check Tesseract availability
if command -v tesseract &> /dev/null; then
    version=$(tesseract --version 2>&1 | head -n 1)
    report="$report \"tesseract\": {\"status\": \"available\", \"version\": \"$version\"},"
else
    report="$report \"tesseract\": {\"status\": \"unavailable\"},"
    status=1
fi

# Check jbig2 availability (Optional)
if command -v jbig2 &> /dev/null; then
    report="$report \"jbig2\": {\"status\": \"available\"}"
else
    report="$report \"jbig2\": {\"status\": \"unavailable\"}"
fi

# Close JSON
report="$report }"

# Output status report
echo "$report"

# Exit with status
exit $status

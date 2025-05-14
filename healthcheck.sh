#!/bin/bash
# Health check script for OCR application container

set -e

# Test if OCRmyPDF is available
if ! command -v ocrmypdf &> /dev/null; then
    echo "ERROR: OCRmyPDF not found"
    exit 1
fi

# Test if Tesseract is available
if ! command -v tesseract &> /dev/null; then
    echo "ERROR: Tesseract not found"
    exit 1
fi

# Test jbig2 availability (Optional, not critical for operation)
if command -v jbig2 &> /dev/null; then
    echo "INFO: jbig2 is available"
else
    echo "WARNING: jbig2 not found, PDF optimization will be limited"
fi

# Check if the Node.js server is running
PORT=${PORT:-3000}
if curl -s --head --fail http://localhost:${PORT}/api/status > /dev/null; then
    echo "SUCCESS: Next.js application is running correctly"
else
    echo "ERROR: Next.js application is not responding"
    exit 1
fi

# Check if upload and processed directories exist and are writable
UPLOADS_DIR=${UPLOADS_DIR:-/app/uploads}
PROCESSED_DIR=${PROCESSED_DIR:-/app/processed}

if [ ! -d "$UPLOADS_DIR" ]; then
    echo "ERROR: Upload directory does not exist: $UPLOADS_DIR"
    exit 1
fi

if [ ! -w "$UPLOADS_DIR" ]; then
    echo "ERROR: Upload directory is not writable: $UPLOADS_DIR"
    exit 1
fi

if [ ! -d "$PROCESSED_DIR" ]; then
    echo "ERROR: Processed directory does not exist: $PROCESSED_DIR"
    exit 1
fi

if [ ! -w "$PROCESSED_DIR" ]; then
    echo "ERROR: Processed directory is not writable: $PROCESSED_DIR"
    exit 1
fi

echo "All health checks passed!"
exit 0

#!/bin/bash

# Check if Paligemma2 model exists
MODEL_DIR="models/paligemma2"
if [ ! -d "$MODEL_DIR" ]; then
  echo "Paligemma2 model not found. Running setup..."
  npm run setup-vlm
fi

# Validate environment
echo "Validating OCR environment..."

# Check Tesseract installation
if ! command -v tesseract &> /dev/null; then
  echo "Error: Tesseract OCR not found. Please install tesseract-ocr package."
  exit 1
fi

# Verify Paligemma2 model files
if [ ! -d "$MODEL_DIR" ]; then
  echo "Error: Paligemma2 model directory not found after setup."
  exit 1
fi

# Check Python environment
if ! command -v python3 &> /dev/null; then
  echo "Error: Python 3 not found. Please install Python 3."
  exit 1
fi

echo "Environment validation successful!"
exit 0

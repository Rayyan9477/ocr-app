#!/bin/bash

# Script to restart the OCR app with PaliGemma2-only mode

echo "=========================================================="
echo "RESTARTING OCR APP WITH PALIGEMMA2-ONLY MODE"
echo "=========================================================="

# Check permissions on vlm-model-manager.js
echo "Ensuring executable permissions on key files..."
chmod +x ./lib/vlm-model-manager.js

# Create backup of current state if needed
if [ ! -f "./lib/vlm-model-manager.js.backup-$(date +%Y%m%d)" ]; then
  echo "Creating backup of VLM Model Manager..."
  cp ./lib/vlm-model-manager.js "./lib/vlm-model-manager.js.backup-$(date +%Y%m%d)" 2>/dev/null || true
fi

# Build the app
echo "Building the app..."
npm run build

# Start the server with no warnings
echo "Starting the server..."
npm run start:no-warnings

echo "=========================================================="
echo "OCR app restarted with PaliGemma2-only mode"
echo "=========================================================="

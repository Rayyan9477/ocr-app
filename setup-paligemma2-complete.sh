#!/bin/bash

# PaliGemma2 Complete Setup Script
# This script makes all PaliGemma2 scripts executable and runs them in sequence

set -e  # Exit on errors

echo "🚀 PaliGemma2 Complete Setup"
echo "==========================="
echo "This script will download and configure all PaliGemma2 model files"
echo

# Make all scripts executable
echo "Making scripts executable..."
chmod +x download-paligemma2*.sh
chmod +x configure-paligemma2.sh

# Create required directories
echo "Creating model directories..."
mkdir -p ./models/paligemma2/combined
mkdir -p ./models/paligemma2/onnx
mkdir -p ./models/paligemma2/google

# First, try downloading from the ONNX Community repository (most reliable)
echo
echo "Step 1: Downloading PaliGemma2 model files from ONNX Community"
echo "-----------------------------------------------------------"
./download-paligemma2-onnx-community.sh

# Then, try downloading from additional sources to fill any gaps
echo
echo "Step 2: Downloading additional PaliGemma2 files from other sources"
echo "---------------------------------------------------------------"
./download-paligemma2-full.sh

# Finally, configure the application to use the downloaded model files
echo
echo "Step 3: Configuring the application to use the downloaded model files"
echo "------------------------------------------------------------------"
./configure-paligemma2.sh

echo
echo "✅ PaliGemma2 setup completed"
echo "==========================="
echo "All PaliGemma2 model files have been downloaded and configured."
echo
echo "To apply these changes to the application, restart the server:"
echo "npm run start:no-warnings"
echo "or"
echo "./start-no-warnings.sh"

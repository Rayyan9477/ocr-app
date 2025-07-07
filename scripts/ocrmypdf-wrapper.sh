#!/bin/bash

# Script to ensure proper environment variables are set for OCRmyPDF
# Created on July 7, 2025

# Make sure TESSDATA_PREFIX is set and exported
export TESSDATA_PREFIX=/usr/local/share/tessdata

# Echo environment for debugging
echo "Running OCRmyPDF with TESSDATA_PREFIX=$TESSDATA_PREFIX"

# Pass all arguments to OCRmyPDF
ocrmypdf "$@"

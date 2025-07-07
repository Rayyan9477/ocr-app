#!/bin/bash

# Diagnostic script to verify Tesseract and OCRmyPDF configuration
echo "Tesseract OCR Configuration Check"
echo "=================================="
echo

# Check Tesseract version
echo "Tesseract version:"
tesseract --version
echo

# Check TESSDATA_PREFIX environment variable
echo "TESSDATA_PREFIX environment variable:"
echo "$TESSDATA_PREFIX"
echo

# Check for tessdata directory
echo "Checking tessdata directories:"
for dir in /usr/share/tesseract-ocr/*/tessdata /usr/share/tessdata /usr/local/share/tessdata
do
  if [ -d "$dir" ]; then
    echo "✓ $dir exists"
    
    # Check for osd.traineddata
    if [ -f "$dir/osd.traineddata" ]; then
      echo "  ✓ $dir/osd.traineddata exists"
      ls -la "$dir/osd.traineddata"
    else
      echo "  ✗ $dir/osd.traineddata NOT found"
    fi
    
    # Check for eng.traineddata
    if [ -f "$dir/eng.traineddata" ]; then
      echo "  ✓ $dir/eng.traineddata exists"
      ls -la "$dir/eng.traineddata"
    else
      echo "  ✗ $dir/eng.traineddata NOT found"
    fi
    
    echo
  else
    echo "✗ $dir does NOT exist"
  fi
done

# Check OCRmyPDF version
echo "OCRmyPDF version:"
ocrmypdf --version
echo

# Check which OCRmyPDF is being used
echo "OCRmyPDF path:"
which ocrmypdf
echo

echo "Tesseract languages available:"
tesseract --list-langs
echo

echo "Configuration check complete."

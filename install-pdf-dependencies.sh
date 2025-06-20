#!/bin/bash

# Install dependencies for the extractable PDF functionality

echo "Installing dependencies for extractable PDF processing..."

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root or with sudo"
  exit 1
fi

# Install system dependencies
echo "Installing system dependencies..."
apt-get update
apt-get install -y \
  imagemagick \
  pdftk \
  tesseract-ocr \
  poppler-utils \
  ghostscript \
  enscript

# Configure ImageMagick to allow PDF processing
echo "Configuring ImageMagick to allow PDF processing..."
if [ -f /etc/ImageMagick-6/policy.xml ]; then
  sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-6/policy.xml
  echo "ImageMagick configured successfully"
else
  echo "Warning: ImageMagick policy file not found at the expected location"
fi

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

echo "Dependencies installation complete!"
echo "You can now run the extractable PDF functionality with:"
echo "  npm run make-extractable <input.pdf> [output.pdf]"
echo "Or test the functionality with:"
echo "  ./test-extractable-pdf.sh"

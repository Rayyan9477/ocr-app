#!/bin/bash
# Azure App Service startup script

# Set environment variables
export NODE_ENV=production
export PORT=${PORT:-8080}
export WEBSITES_PORT=${PORT:-8080}

# Install system dependencies for Azure App Service
echo "Installing system dependencies..."
apt-get update && apt-get install -y \
  imagemagick \
  pdftk \
  poppler-utils \
  tesseract-ocr \
  libtesseract-dev \
  ghostscript \
  || echo "Warning: Some system packages may not be available"

# Configure ImageMagick policy for PDF processing
if [ -f /etc/ImageMagick-6/policy.xml ]; then
  sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-6/policy.xml
fi

# Create required directories
mkdir -p uploads processed output tmp logs audit_logs secure_storage

# Set permissions
chmod -R 755 uploads processed output tmp logs audit_logs secure_storage

# Install any missing npm dependencies
npm install --production

# Start the application
echo "Starting Node.js application..."
node server.js

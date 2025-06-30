#!/bin/bash

# Initialize required directories with proper permissions
echo "Setting up OCR directories..."

# Create directories
mkdir -p uploads processed output tmp/{preprocessing,enhanced-tesseract,tfvlm}

# Set permissions (adjust user/group as needed)
chmod -R 755 uploads processed output tmp
chmod -R +w uploads processed output tmp

echo "Directory setup complete. Current structure:"
ls -la uploads processed output tmp/

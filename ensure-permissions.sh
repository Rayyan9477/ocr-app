#!/bin/bash
# This script ensures the uploads and processed directories have the correct permissions
# and checks for the presence of jbig2enc

# Navigate to the project root directory
cd "$(dirname "$0")"

# Create directories if they don't exist
mkdir -p uploads processed

# Set permissions for uploads and processed directories
chmod -R 777 uploads processed

echo "✅ Upload and processed directories created with proper permissions"

# Check if the directories are writable
if [ -w "uploads" ] && [ -w "processed" ]; then
  echo "✅ Directories are writable"
else
  echo "❌ Error: Directories are not writable"
  exit 1
fi

# Check for jbig2enc
if command -v jbig2 &> /dev/null; then
  JBIG2_VERSION=$(jbig2 --version 2>&1 || echo "Unknown version")
  echo "✅ jbig2enc is installed: $JBIG2_VERSION"
else
  echo "⚠️ Warning: jbig2enc is not installed - PDF optimization will be limited"
  echo "  To install: sudo apt-get install -y jbig2"
  echo "  Or run ./check-jbig2.sh to install it automatically"
fi

echo "Directory permissions successfully set"

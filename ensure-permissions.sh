#!/bin/bash
# This script ensures the uploads and processed directories have the correct permissions

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

echo "Directory permissions successfully set"

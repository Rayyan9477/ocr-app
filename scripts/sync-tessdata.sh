#!/bin/bash

# Script to ensure osd.traineddata and eng.traineddata exist in all possible tessdata locations
echo "Copying language data files to all tessdata locations..."

# Source files
SOURCE_OSD="/usr/local/share/tessdata/osd.traineddata"
SOURCE_ENG="/usr/local/share/tessdata/eng.traineddata"

# Make sure source files exist
if [ ! -f "$SOURCE_OSD" ]; then
  echo "Error: Source file $SOURCE_OSD does not exist"
  exit 1
fi

if [ ! -f "$SOURCE_ENG" ]; then
  echo "Error: Source file $SOURCE_ENG does not exist"
  exit 1
fi

# Target directories
TESSDATA_DIRS=(
  "/usr/share/tesseract-ocr/4.00/tessdata"
  "/usr/share/tessdata"
  "/usr/local/share/tessdata"
)

# Copy to each directory if it exists
for dir in "${TESSDATA_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "Copying to $dir..."
    
    # Copy osd.traineddata if not exists or is different
    if [ ! -f "$dir/osd.traineddata" ] || ! cmp -s "$SOURCE_OSD" "$dir/osd.traineddata"; then
      cp "$SOURCE_OSD" "$dir/osd.traineddata"
      echo "  ✓ Copied osd.traineddata"
    else
      echo "  ✓ osd.traineddata already exists and is identical"
    fi
    
    # Copy eng.traineddata if not exists or is different
    if [ ! -f "$dir/eng.traineddata" ] || ! cmp -s "$SOURCE_ENG" "$dir/eng.traineddata"; then
      cp "$SOURCE_ENG" "$dir/eng.traineddata"
      echo "  ✓ Copied eng.traineddata"
    else
      echo "  ✓ eng.traineddata already exists and is identical"
    fi
  else
    echo "Creating directory $dir..."
    mkdir -p "$dir"
    cp "$SOURCE_OSD" "$dir/osd.traineddata"
    cp "$SOURCE_ENG" "$dir/eng.traineddata"
    echo "  ✓ Created directory and copied language files"
  fi
done

# Make sure TESSDATA_PREFIX is set in key locations
if ! grep -q "TESSDATA_PREFIX" /etc/environment; then
  echo "Adding TESSDATA_PREFIX to /etc/environment..."
  echo "TESSDATA_PREFIX=/usr/local/share/tessdata" | sudo tee -a /etc/environment
  echo "  ✓ Added to /etc/environment"
fi

if [ ! -f "/etc/profile.d/tesseract.sh" ]; then
  echo "Creating /etc/profile.d/tesseract.sh..."
  echo "export TESSDATA_PREFIX=/usr/local/share/tessdata" | sudo tee /etc/profile.d/tesseract.sh
  sudo chmod +x /etc/profile.d/tesseract.sh
  echo "  ✓ Created /etc/profile.d/tesseract.sh"
fi

echo "Setting permissions on language files..."
for dir in "${TESSDATA_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    sudo chmod 644 "$dir/osd.traineddata" "$dir/eng.traineddata"
    echo "  ✓ Set permissions for $dir"
  fi
done

echo "Language data file synchronization complete."
echo "TESSDATA_PREFIX is set to: /usr/local/share/tessdata"

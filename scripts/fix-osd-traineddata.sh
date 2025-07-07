#!/bin/bash

# Direct fix for osd.traineddata issue
# This script will ensure the osd.traineddata file is available in all possible locations
# and has correct permissions

# Set source file locations
SOURCE_OSD="/usr/local/share/tessdata/osd.traineddata"

# If source file doesn't exist, download it
if [ ! -f "$SOURCE_OSD" ]; then
  echo "Source file $SOURCE_OSD not found, downloading it..."
  curl -o "$SOURCE_OSD" https://github.com/tesseract-ocr/tessdata/raw/main/osd.traineddata
  chmod 644 "$SOURCE_OSD"
fi

# Copy to all possible tessdata locations
for dir in /usr/share/tesseract-ocr/*/tessdata /usr/share/tessdata /usr/local/share/tessdata; do
  if [ -d "$dir" ] || mkdir -p "$dir"; then
    echo "Copying osd.traineddata to $dir..."
    cp -f "$SOURCE_OSD" "$dir/"
    chmod 644 "$dir/osd.traineddata"
  fi
done

# Ensure TESSDATA_PREFIX is set in relevant config files
if ! grep -q "TESSDATA_PREFIX" /etc/environment; then
  echo "Adding TESSDATA_PREFIX to /etc/environment..."
  echo "TESSDATA_PREFIX=/usr/local/share/tessdata" | sudo tee -a /etc/environment
fi

if [ ! -f "/etc/profile.d/tesseract.sh" ]; then
  echo "Creating /etc/profile.d/tesseract.sh..."
  echo "export TESSDATA_PREFIX=/usr/local/share/tessdata" | sudo tee /etc/profile.d/tesseract.sh
  chmod +x /etc/profile.d/tesseract.sh
fi

# Export for current session
export TESSDATA_PREFIX=/usr/local/share/tessdata

# Create a wrapper for OCRmyPDF that ensures TESSDATA_PREFIX is set
cat > /usr/local/bin/ocrmypdf-fix <<'EOF'
#!/bin/bash
export TESSDATA_PREFIX=/usr/local/share/tessdata
/home/rayyan9477/.local/bin/ocrmypdf "$@"
EOF

chmod +x /usr/local/bin/ocrmypdf-fix

# Update config.ts file
sed -i 's|/usr/share/tesseract-ocr/4.00/tessdata|/usr/local/share/tessdata|g' /home/rayyan9477/ocr-app/lib/config.ts

echo "Fix applied successfully. TESSDATA_PREFIX is set to /usr/local/share/tessdata"
echo "Use /usr/local/bin/ocrmypdf-fix instead of ocrmypdf to ensure correct environment"

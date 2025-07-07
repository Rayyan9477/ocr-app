#!/bin/bash

# Create a symlink in /usr/local/bin to override the system OCRmyPDF
# This ensures all calls to OCRmyPDF will use our environment-setting wrapper

# First, create the wrapper script in /usr/local/bin
cat > /usr/local/bin/ocrmypdf-wrapper <<'EOF'
#!/bin/bash

# Export the correct TESSDATA_PREFIX
export TESSDATA_PREFIX=/usr/local/share/tessdata

# Call the original ocrmypdf
$(which -a ocrmypdf | grep -v '/usr/local/bin/ocrmypdf$' | head -1) "$@"
EOF

# Make it executable
chmod +x /usr/local/bin/ocrmypdf-wrapper

# Create a backup of the original OCRmyPDF if needed
if [ -e /usr/local/bin/ocrmypdf ]; then
  if [ ! -L /usr/local/bin/ocrmypdf ]; then
    mv /usr/local/bin/ocrmypdf /usr/local/bin/ocrmypdf.orig
  else
    rm /usr/local/bin/ocrmypdf
  fi
fi

# Create a symlink to our wrapper
ln -sf /usr/local/bin/ocrmypdf-wrapper /usr/local/bin/ocrmypdf

echo "OCRmyPDF wrapper installed successfully"

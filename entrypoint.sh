#!/bin/bash
# This script is the entrypoint for the OCR application container
# It ensures proper permissions for uploads and processed directories

set -e

# Directories that need proper permissions
UPLOADS_DIR=${UPLOADS_DIR:-/app/uploads}
PROCESSED_DIR=${PROCESSED_DIR:-/app/processed}

echo "==> Setting up OCR application"

# Create directories if they don't exist
echo "==> Ensuring directories exist"
mkdir -p "$UPLOADS_DIR" "$PROCESSED_DIR"

# Check jbig2 availability
echo "==> Checking jbig2 availability"
if [ -f "/app/check-jbig2.sh" ]; then
  /app/check-jbig2.sh
else
  echo "  Warning: check-jbig2.sh not found, skipping jbig2 validation"
fi

# Set permissions (retry with sudo if normal permission setting fails)
echo "==> Setting directory permissions"
chmod_dirs() {
  echo "  Trying to set permissions for $UPLOADS_DIR and $PROCESSED_DIR"
  if ! chmod -R 777 "$UPLOADS_DIR" "$PROCESSED_DIR" 2>/dev/null; then
    echo "  Permission denied, trying with sudo..."
    if command -v sudo >/dev/null 2>&1; then
      sudo chmod -R 777 "$UPLOADS_DIR" "$PROCESSED_DIR" || echo "  Warning: Could not set permissions even with sudo"
    else
      echo "  Warning: sudo not available and permissions could not be set"
    fi
  fi
}

# Try to set permissions
chmod_dirs

# Verify permissions by writing test files
echo "==> Verifying directory permissions"
verify_permissions() {
  local dir=$1
  local test_file="$dir/.permission_test"
  
  echo "  Testing write permissions for $dir"
  if touch "$test_file" 2>/dev/null; then
    echo "  ✅ $dir is writable"
    rm -f "$test_file"
    return 0
  else
    echo "  ❌ $dir is NOT writable"
    return 1
  fi
}

uploads_writable=true
processed_writable=true

verify_permissions "$UPLOADS_DIR" || uploads_writable=false
verify_permissions "$PROCESSED_DIR" || processed_writable=false

# Show permissions for debugging
echo "==> Current permissions:"
ls -la "$UPLOADS_DIR"
ls -la "$PROCESSED_DIR"

if [[ "$uploads_writable" == false || "$processed_writable" == false ]]; then
  echo "⚠️  Warning: One or more directories are not writable. This may cause issues with OCR processing."
  echo "    You may need to fix permissions manually or restart container with appropriate user/volume settings."
  echo "    Alternatively, run 'chmod -R 777 uploads processed' in your host system for development environments."
else
  echo "✅ All directories have correct permissions"
fi

# Execute the provided command or default to Node.js application
echo "==> Starting application"
if [[ $# -gt 0 ]]; then
  exec "$@"
else
  cd /app
  exec node server.js
fi

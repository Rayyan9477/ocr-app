#!/bin/bash

# Optimized Azure Deployment Package Creation Script
# This script creates the deployment package efficiently without large temp folders

echo "Creating optimized deployment package for Azure App Service..."

# Remove any existing deployment artifacts
rm -rf deployment deployment.zip

# Create deployment zip directly without intermediate folder
echo "Creating deployment.zip directly..."

# Use zip to create archive directly from source files
zip -r deployment.zip \
  .next/standalone/* \
  -x "*.git*" "node_modules/.cache/*" "*.log" "*.tmp" \
  > /dev/null 2>&1

# Add static files
if [ -d ".next/static" ]; then
  cd .next && zip -r ../deployment.zip static/ > /dev/null 2>&1 && cd ..
  echo "✅ Added static files to zip"
fi

# Add public files
if [ -d "public" ]; then
  zip -r deployment.zip public/ > /dev/null 2>&1
  echo "✅ Added public files to zip"
fi

# Add configuration files
if [ -f "web.config.production" ]; then
  zip -j deployment.zip web.config.production > /dev/null 2>&1
  # Rename within zip
  python3 -c "
import zipfile
with zipfile.ZipFile('deployment.zip', 'a') as zf:
    with zf.open('web.config.production') as src, zf.open('web.config', 'w') as dst:
        dst.write(src.read())
zf.remove('web.config.production')
" 2>/dev/null || echo "Using web.config.production as-is"
  echo "✅ Added production web.config"
elif [ -f "web.config" ]; then
  zip -j deployment.zip web.config > /dev/null 2>&1
  echo "✅ Added web.config"
fi

# Add other config files
[ -f "iisnode.yml" ] && zip -j deployment.zip iisnode.yml > /dev/null 2>&1 && echo "✅ Added iisnode.yml"
[ -f "startup.sh" ] && zip -j deployment.zip startup.sh > /dev/null 2>&1 && echo "✅ Added startup.sh"
[ -f ".env.production" ] && zip -j deployment.zip .env.production > /dev/null 2>&1 && echo "✅ Added production environment"

# Create empty directories in zip (required for Azure)
zip -r deployment.zip . -i "uploads/.gitkeep" "processed/.gitkeep" "output/.gitkeep" "tmp/.gitkeep" "logs/.gitkeep" "audit_logs/.gitkeep" "secure_storage/.gitkeep" > /dev/null 2>&1

# Verify zip file
if [ -f "deployment.zip" ]; then
  ZIP_SIZE=$(du -h deployment.zip | cut -f1)
  echo "✅ deployment.zip created successfully (${ZIP_SIZE})"
  
  # Show zip contents summary
  echo "=== Deployment Package Contents ==="
  unzip -l deployment.zip | head -20
  echo "..."
  FILE_COUNT=$(unzip -l deployment.zip | tail -1 | awk '{print $2}')
  echo "Total files in package: ${FILE_COUNT}"
  
  # Verify critical files exist in zip
  echo "=== Critical Files Verification ==="
  unzip -l deployment.zip | grep -q "server.js" && echo "✅ server.js exists" || echo "❌ server.js missing"
  unzip -l deployment.zip | grep -q "package.json" && echo "✅ package.json exists" || echo "❌ package.json missing"
  unzip -l deployment.zip | grep -q "web.config" && echo "✅ web.config exists" || echo "❌ web.config missing"
  
else
  echo "❌ deployment.zip creation failed"
  exit 1
fi

echo "✅ Optimized deployment package ready - no temp folders created!"

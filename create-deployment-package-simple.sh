#!/bin/bash

# Simple Azure Deployment Package Creator
# Creates deployment package without large temporary folders

echo "Creating efficient deployment package for Azure App Service..."

# Clean up any existing deployment artifacts
rm -rf deployment.zip

# Ensure we have a successful build first
if [ ! -d ".next/standalone" ]; then
  echo "❌ No standalone build found. Running npm run build..."
  npm run build
fi

# Create deployment zip directly from necessary files
echo "Creating deployment.zip efficiently..."

# Start with the standalone server files
if [ -d ".next/standalone" ]; then
  cd .next/standalone
  zip -r ../../deployment.zip . > /dev/null 2>&1
  cd ../..
  echo "✅ Added standalone server files"
else
  echo "❌ No standalone build found"
  exit 1
fi

# Add static files
if [ -d ".next/static" ]; then
  cd .next && zip -r ../deployment.zip static/ > /dev/null 2>&1 && cd ..
  echo "✅ Added static files"
fi

# Add public files (only essential ones)
if [ -d "public" ]; then
  zip -r deployment.zip public/ \
    -x "public/test-uploads/*" "public/results/*" "public/output/*" \
    > /dev/null 2>&1
  echo "✅ Added public files"
fi

# Add configuration files
[ -f "web.config.production" ] && zip -j deployment.zip web.config.production > /dev/null 2>&1 && echo "✅ Added web.config"
[ -f "iisnode.yml" ] && zip -j deployment.zip iisnode.yml > /dev/null 2>&1 && echo "✅ Added iisnode.yml"
[ -f "startup.sh" ] && zip -j deployment.zip startup.sh > /dev/null 2>&1 && echo "✅ Added startup.sh"
[ -f ".env.production" ] && zip -j deployment.zip .env.production > /dev/null 2>&1 && echo "✅ Added environment"

# Create necessary empty directories
mkdir -p temp_dirs/{uploads,processed,output,tmp,logs,audit_logs,secure_storage}
echo "" > temp_dirs/uploads/.gitkeep
echo "" > temp_dirs/processed/.gitkeep
echo "" > temp_dirs/output/.gitkeep
echo "" > temp_dirs/tmp/.gitkeep
echo "" > temp_dirs/logs/.gitkeep
echo "" > temp_dirs/audit_logs/.gitkeep
echo "" > temp_dirs/secure_storage/.gitkeep

zip -r deployment.zip temp_dirs/ > /dev/null 2>&1
rm -rf temp_dirs

# Verify deployment package
if [ -f "deployment.zip" ]; then
  ZIP_SIZE=$(du -h deployment.zip | cut -f1)
  echo "✅ Deployment package created: ${ZIP_SIZE}"
  
  # Quick verification
  echo "=== Package Verification ==="
  unzip -l deployment.zip | grep -q "server.js" && echo "✅ server.js included" || echo "❌ server.js missing"
  unzip -l deployment.zip | grep -q "package.json" && echo "✅ package.json included" || echo "❌ package.json missing"
  unzip -l deployment.zip | grep -q "node_modules" && echo "✅ node_modules included" || echo "❌ node_modules missing"
  
  echo "✅ Deployment package ready for Azure!"
else
  echo "❌ Failed to create deployment package"
  exit 1
fi

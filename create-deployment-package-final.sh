#!/bin/bash

# Simple and Reliable Azure Deployment Package Creator
echo "Creating deployment package for Azure App Service..."

# Clean up any existing deployment artifacts
rm -rf deployment.zip

# Verify we have a build
if [ ! -d ".next/standalone" ]; then
  echo "❌ No standalone build found. Please run 'npm run build' first."
  exit 1
fi

# Create deployment zip from standalone build
echo "Packaging standalone build..."
cd .next/standalone
zip -r ../../deployment.zip . -x "*.log" "*.tmp" > /dev/null 2>&1
cd ../..

if [ $? -eq 0 ]; then
  echo "✅ Added standalone server files"
else
  echo "❌ Failed to add standalone files"
  exit 1
fi

# Add static files
if [ -d ".next/static" ]; then
  cd .next
  zip -r ../deployment.zip static/ > /dev/null 2>&1
  cd ..
  echo "✅ Added static files"
fi

# Add public files (excluding large test files)
if [ -d "public" ]; then
  zip -r deployment.zip public/ -x "public/test-uploads/*" > /dev/null 2>&1
  echo "✅ Added public files"
fi

# Add configuration files
if [ -f "web.config.production" ]; then
  zip -j deployment.zip web.config.production > /dev/null 2>&1
  echo "✅ Added web.config.production"
elif [ -f "web.config" ]; then
  zip -j deployment.zip web.config > /dev/null 2>&1
  echo "✅ Added web.config"
fi

[ -f "iisnode.yml" ] && zip -j deployment.zip iisnode.yml > /dev/null 2>&1 && echo "✅ Added iisnode.yml"
[ -f "startup.sh" ] && zip -j deployment.zip startup.sh > /dev/null 2>&1 && echo "✅ Added startup.sh"
[ -f ".env.production" ] && zip -j deployment.zip .env.production > /dev/null 2>&1 && echo "✅ Added environment config"

# Verify deployment package
if [ -f "deployment.zip" ]; then
  ZIP_SIZE=$(du -h deployment.zip | cut -f1)
  echo "✅ Deployment package created successfully (${ZIP_SIZE})"
  
  # Verify essential files
  echo "=== Essential Files Check ==="
  unzip -l deployment.zip | grep -q "server.js" && echo "✅ server.js included" || echo "❌ server.js missing"
  unzip -l deployment.zip | grep -q "package.json" && echo "✅ package.json included" || echo "❌ package.json missing"
  unzip -l deployment.zip | grep -q "node_modules" && echo "✅ node_modules included" || echo "❌ node_modules missing"
  
  echo "✅ Deployment package ready for Azure App Service!"
else
  echo "❌ Failed to create deployment package"
  exit 1
fi

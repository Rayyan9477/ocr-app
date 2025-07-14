#!/bin/bash

# Script to copy essential files to standalone deployment
echo "📋 Copying essential files to standalone deployment..."

STANDALONE_DIR=".next/standalone"

if [ ! -d "$STANDALONE_DIR" ]; then
    echo "❌ Error: Standalone directory not found. Run 'npm run build' first."
    exit 1
fi

# Copy essential configuration files
echo "📄 Copying web.config..."
if [ -f "web.config" ]; then
    cp web.config "$STANDALONE_DIR/"
elif [ -f "web.config.production" ]; then
    cp web.config.production "$STANDALONE_DIR/web.config"
else
    echo "⚠️  Warning: No web.config found"
fi

echo "📄 Copying iisnode.yml..."
if [ -f "iisnode.yml" ]; then
    cp iisnode.yml "$STANDALONE_DIR/"
else
    echo "⚠️  Warning: No iisnode.yml found"
fi

echo "📄 Copying startup.sh..."
if [ -f "startup.sh" ]; then
    cp startup.sh "$STANDALONE_DIR/"
    chmod +x "$STANDALONE_DIR/startup.sh"
else
    echo "⚠️  Warning: No startup.sh found"
fi

# Create essential directories if they don't exist
echo "📁 Creating essential directories..."
mkdir -p "$STANDALONE_DIR/logs"
mkdir -p "$STANDALONE_DIR/tmp"
mkdir -p "$STANDALONE_DIR/audit_logs"
mkdir -p "$STANDALONE_DIR/secure_storage"
mkdir -p "$STANDALONE_DIR/output"

# Copy public directory
echo "📁 Copying public directory..."
if [ -d "public" ]; then
    cp -r public "$STANDALONE_DIR/"
else
    echo "⚠️  Warning: No public directory found"
fi

echo "✅ Essential files copied to standalone deployment"

# Validate the package
echo ""
echo "🔍 Validating deployment package..."
node scripts/validate-deployment-package.js "$STANDALONE_DIR"

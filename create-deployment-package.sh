#!/bin/bash

# Azure Deployment Package Creation Script
# This script creates the deployment package for Azure App Service

echo "Creating deployment package for Azure App Service..."

# Create deployment directory
mkdir -p deployment

# Copy standalone build
cp -r .next/standalone/* deployment/

# Copy static files
if [ -d ".next/static" ]; then
  mkdir -p deployment/.next/static
  cp -r .next/static/* deployment/.next/static/
  echo "✅ Copied static files"
fi

# Copy public files
if [ -d "public" ]; then
  mkdir -p deployment/public
  cp -r public/* deployment/public/
  echo "✅ Copied public files"
fi

# Copy configuration files
if [ -f "web.config.production" ]; then
  cp web.config.production deployment/web.config
  echo "✅ Used production web.config"
elif [ -f "web.config" ]; then
  cp web.config deployment/
  echo "✅ Copied web.config"
else
  # Create basic web.config if missing
  cat > deployment/web.config << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <webSocket enabled="false" />
    <handlers>
      <add name="iisnode" path="server.js" verb="*" modules="iisnode" />
    </handlers>
    <rewrite>
      <rules>
        <rule name="DynamicContent">
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True" />
          </conditions>
          <action type="Rewrite" url="server.js" />
        </rule>
      </rules>
    </rewrite>
    <security>
      <requestFiltering>
        <requestLimits maxAllowedContentLength="104857600" />
      </requestFiltering>
    </security>
    <httpErrors existingResponse="PassThrough" />
    <iisnode 
      nodeProcessCommandLine="node.exe"
      watchedFiles="web.config;*.js"
      loggingEnabled="true"
      logDirectory="logs"
      enableXFF="true"
      node_env="production"
    />
  </system.webServer>
</configuration>
EOF
  echo "✅ Created default web.config"
fi

# Copy other config files
[ -f "iisnode.yml" ] && cp iisnode.yml deployment/ && echo "✅ Copied iisnode.yml"
[ -f "startup.sh" ] && cp startup.sh deployment/ && chmod +x deployment/startup.sh && echo "✅ Copied startup.sh"
[ -f ".env.production" ] && cp .env.production deployment/ && echo "✅ Copied production environment"

# Create required directories
mkdir -p deployment/uploads deployment/processed deployment/output deployment/tmp deployment/logs deployment/audit_logs deployment/secure_storage
echo "✅ Created required directories"

# Verify deployment structure
echo "=== Deployment Structure Verification ==="
ls -la deployment/

# Check critical files
[ -f "deployment/server.js" ] && echo "✅ server.js exists" || echo "❌ server.js missing"
[ -f "deployment/package.json" ] && echo "✅ package.json exists" || echo "❌ package.json missing"
[ -f "deployment/web.config" ] && echo "✅ web.config exists" || echo "❌ web.config missing"

# Show package size
echo "=== Package Size ==="
du -sh deployment/

# Create zip file for deployment
echo "Creating deployment.zip..."
cd deployment && zip -r ../deployment.zip . && cd ..
echo "✅ Deployment zip created"

# Verify zip file
if [ -f "deployment.zip" ]; then
  echo "✅ deployment.zip exists ($(du -h deployment.zip | cut -f1))"
else
  echo "❌ deployment.zip creation failed"
  exit 1
fi

echo "✅ Deployment package ready"

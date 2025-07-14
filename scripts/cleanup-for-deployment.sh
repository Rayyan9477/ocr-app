#!/bin/bash
# cleanup-for-deployment.sh
# Script to clean up unnecessary files before deployment

set -e

# Check if a directory was provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <deployment-directory>"
    exit 1
fi

DEPLOY_DIR="$1"

# Ensure the deployment directory exists
if [ ! -d "$DEPLOY_DIR" ]; then
    echo "❌ Error: Deployment directory $DEPLOY_DIR does not exist"
    exit 1
fi

echo "🧹 Starting cleanup of $DEPLOY_DIR..."

# Remove version control files and directories
echo "Removing version control files..."
rm -rf "$DEPLOY_DIR/.git" 2>/dev/null || echo "⚠️ No .git directory to remove"
rm -rf "$DEPLOY_DIR/.github" 2>/dev/null || echo "⚠️ No .github directory to remove"
rm -rf "$DEPLOY_DIR/.gitignore" 2>/dev/null || echo "⚠️ No .gitignore to remove"
rm -rf "$DEPLOY_DIR/.gitattributes" 2>/dev/null || echo "⚠️ No .gitattributes to remove"

# Remove editor configuration files
echo "Removing editor configuration files..."
rm -rf "$DEPLOY_DIR/.vscode" 2>/dev/null || echo "⚠️ No .vscode directory to remove"
rm -rf "$DEPLOY_DIR/.idea" 2>/dev/null || echo "⚠️ No .idea directory to remove"
rm -rf "$DEPLOY_DIR/.editorconfig" 2>/dev/null || echo "⚠️ No .editorconfig to remove"

# Remove documentation files
echo "Removing documentation files..."
rm -rf "$DEPLOY_DIR/docs" 2>/dev/null || echo "⚠️ No docs directory to remove"
find "$DEPLOY_DIR" -name "*.md" -not -name "README.md" -not -name "AZURE_DEPLOYMENT.md" -type f -delete 2>/dev/null || echo "⚠️ No markdown files to remove"
rm -rf "$DEPLOY_DIR/LICENSE" 2>/dev/null || echo "⚠️ No LICENSE file to remove"

# Remove development and testing files
echo "Removing development and testing files..."
rm -rf "$DEPLOY_DIR/__tests__" 2>/dev/null || echo "⚠️ No __tests__ directory to remove"
rm -rf "$DEPLOY_DIR/test" 2>/dev/null || echo "⚠️ No test directory to remove"
rm -rf "$DEPLOY_DIR/tests" 2>/dev/null || echo "⚠️ No tests directory to remove"
rm -rf "$DEPLOY_DIR/cypress" 2>/dev/null || echo "⚠️ No cypress directory to remove"
rm -rf "$DEPLOY_DIR/jest.config.js" 2>/dev/null || echo "⚠️ No jest.config.js to remove"
rm -rf "$DEPLOY_DIR/jest.setup.js" 2>/dev/null || echo "⚠️ No jest.setup.js to remove"
rm -rf "$DEPLOY_DIR/cypress.json" 2>/dev/null || echo "⚠️ No cypress.json to remove"
find "$DEPLOY_DIR" -name "*.test.*" -type f -delete 2>/dev/null || echo "⚠️ No test files to remove"
find "$DEPLOY_DIR" -name "*.spec.*" -type f -delete 2>/dev/null || echo "⚠️ No spec files to remove"
find "$DEPLOY_DIR" -name "test-*.sh" -type f -delete 2>/dev/null || echo "⚠️ No test shell scripts to remove"
find "$DEPLOY_DIR" -name "test-*.py" -type f -delete 2>/dev/null || echo "⚠️ No test Python scripts to remove"
rm -rf "$DEPLOY_DIR/validate-deployment.js" 2>/dev/null || echo "⚠️ No validate-deployment.js to remove"

# Remove Docker-related files
echo "Removing Docker-related files..."
rm -rf "$DEPLOY_DIR/Dockerfile" 2>/dev/null || echo "⚠️ No Dockerfile to remove"
rm -rf "$DEPLOY_DIR/Dockerfile.production" 2>/dev/null || echo "⚠️ No Dockerfile.production to remove"
rm -rf "$DEPLOY_DIR/docker-compose.yml" 2>/dev/null || echo "⚠️ No docker-compose.yml to remove"
rm -rf "$DEPLOY_DIR/docker-compose.hipaa.yml" 2>/dev/null || echo "⚠️ No docker-compose.hipaa.yml to remove"
rm -rf "$DEPLOY_DIR/.dockerignore" 2>/dev/null || echo "⚠️ No .dockerignore to remove"
rm -rf "$DEPLOY_DIR/get-docker.sh" 2>/dev/null || echo "⚠️ No get-docker.sh to remove"

# Remove build configuration files (except Next.js config)
echo "Removing build configuration files..."
rm -rf "$DEPLOY_DIR/tsconfig.json" 2>/dev/null || echo "⚠️ No tsconfig.json to remove"
rm -rf "$DEPLOY_DIR/tsconfig.tsbuildinfo" 2>/dev/null || echo "⚠️ No tsconfig.tsbuildinfo to remove"
rm -rf "$DEPLOY_DIR/postcss.config.mjs" 2>/dev/null || echo "⚠️ No postcss.config.mjs to remove"
rm -rf "$DEPLOY_DIR/tailwind.config.ts" 2>/dev/null || echo "⚠️ No tailwind.config.ts to remove"
rm -rf "$DEPLOY_DIR/.eslintrc.js" 2>/dev/null || echo "⚠️ No .eslintrc.js to remove"
rm -rf "$DEPLOY_DIR/.eslintrc.json" 2>/dev/null || echo "⚠️ No .eslintrc.json to remove"
rm -rf "$DEPLOY_DIR/.prettierrc" 2>/dev/null || echo "⚠️ No .prettierrc to remove"
rm -rf "$DEPLOY_DIR/.babelrc" 2>/dev/null || echo "⚠️ No .babelrc to remove"

# Remove project-specific unnecessary files
echo "Removing project-specific unnecessary files..."
rm -rf "$DEPLOY_DIR/jbig2enc" 2>/dev/null || echo "⚠️ No jbig2enc directory to remove"
rm -rf "$DEPLOY_DIR/check-jbig2.sh" 2>/dev/null || echo "⚠️ No check-jbig2.sh to remove"
rm -rf "$DEPLOY_DIR/demo-hipaa-app.sh" 2>/dev/null || echo "⚠️ No demo-hipaa-app.sh to remove"
rm -rf "$DEPLOY_DIR/cookies.txt" 2>/dev/null || echo "⚠️ No cookies.txt to remove"
rm -rf "$DEPLOY_DIR/components.json" 2>/dev/null || echo "⚠️ No components.json to remove"

# Optimize node_modules if it exists
if [ -d "$DEPLOY_DIR/node_modules" ]; then
  echo "Optimizing node_modules..."
  # Remove development files from node_modules
  find "$DEPLOY_DIR/node_modules" -name "*.ts" -not -name "*.d.ts" -type f -delete 2>/dev/null
  find "$DEPLOY_DIR/node_modules" -name "*.map" -type f -delete 2>/dev/null
  find "$DEPLOY_DIR/node_modules" -name "LICENSE*" -type f -delete 2>/dev/null
  find "$DEPLOY_DIR/node_modules" -name "README*" -type f -delete 2>/dev/null
  find "$DEPLOY_DIR/node_modules" -name "CHANGELOG*" -type f -delete 2>/dev/null
  find "$DEPLOY_DIR/node_modules" -path "*/test/*" -delete 2>/dev/null
  find "$DEPLOY_DIR/node_modules" -path "*/tests/*" -delete 2>/dev/null
  find "$DEPLOY_DIR/node_modules" -path "*/.github/*" -delete 2>/dev/null
  find "$DEPLOY_DIR/node_modules" -path "*/docs/*" -delete 2>/dev/null
  
  # Remove dev dependencies if they somehow made it in
  rm -rf "$DEPLOY_DIR/node_modules/@types" 2>/dev/null
  rm -rf "$DEPLOY_DIR/node_modules/typescript" 2>/dev/null
  rm -rf "$DEPLOY_DIR/node_modules/eslint*" 2>/dev/null
  rm -rf "$DEPLOY_DIR/node_modules/jest*" 2>/dev/null
  rm -rf "$DEPLOY_DIR/node_modules/@testing-library" 2>/dev/null
  
  # Remove node_modules/.bin directory
  rm -rf "$DEPLOY_DIR/node_modules/.bin" 2>/dev/null
fi

# Optimize .next directory if it exists
if [ -d "$DEPLOY_DIR/.next" ]; then
  echo "Optimizing .next directory..."
  # Remove unnecessary build artifacts
  rm -rf "$DEPLOY_DIR/.next/cache/images" 2>/dev/null || echo "⚠️ No image cache to remove"
  rm -rf "$DEPLOY_DIR/.next/cache/webpack" 2>/dev/null || echo "⚠️ No webpack cache to remove"
  rm -rf "$DEPLOY_DIR/.next/trace" 2>/dev/null || echo "⚠️ No trace files to remove"
  
  # Keep only minified assets and remove large source maps
  find "$DEPLOY_DIR/.next" -name "*.js" -not -name "*.min.js" -size +1M -delete 2>/dev/null
  find "$DEPLOY_DIR/.next" -name "*.map" -size +1M -delete 2>/dev/null
fi

# Ensure Next.js static files are properly set up
if [ -d "$DEPLOY_DIR/.next/static" ]; then
  echo "Setting up Next.js static files..."
  
  # Create public/_next/static directory structure if it doesn't exist
  mkdir -p "$DEPLOY_DIR/public/_next"
  
  # Copy static files to public/_next/static
  if [ ! -d "$DEPLOY_DIR/public/_next/static" ]; then
    cp -r "$DEPLOY_DIR/.next/static" "$DEPLOY_DIR/public/_next/"
    echo "✅ Copied .next/static to public/_next/static"
  fi
fi

# Create required directories if they don't exist
echo "Creating required directories..."
mkdir -p "$DEPLOY_DIR/uploads" "$DEPLOY_DIR/processed" "$DEPLOY_DIR/output" "$DEPLOY_DIR/tmp" "$DEPLOY_DIR/logs" "$DEPLOY_DIR/audit_logs" "$DEPLOY_DIR/secure_storage"

# Make scripts executable
echo "Making scripts executable..."
chmod +x "$DEPLOY_DIR/startup.sh" 2>/dev/null || echo "⚠️ startup.sh not found or not executable"
chmod +x "$DEPLOY_DIR/ensure-permissions.sh" 2>/dev/null || echo "⚠️ ensure-permissions.sh not found or not executable"

# Show final package size
echo "📊 Final package size:"
du -sh "$DEPLOY_DIR"
du -sh "$DEPLOY_DIR/.next" 2>/dev/null || echo "No .next directory"
du -sh "$DEPLOY_DIR/node_modules" 2>/dev/null || echo "No node_modules directory"

echo "✅ Cleanup completed successfully!"

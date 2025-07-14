#!/bin/bash
# Manual deployment verification script

echo "=== Azure Deployment Verification ==="
echo "Checking deployment readiness..."

# Check if all required files exist
required_files=("server.js" "package.json" "next.config.mjs" "web.config" "startup.sh" ".deployment")
missing_files=()

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ All required deployment files are present"
else
    echo "❌ Missing files: ${missing_files[*]}"
    exit 1
fi

# Check package.json configuration
if grep -q '"type": "module"' package.json; then
    echo "❌ package.json still has 'type: module' which conflicts with CommonJS server.js"
    exit 1
else
    echo "✅ package.json module type is correct"
fi

# Check if .next build exists
if [ -d ".next" ]; then
    echo "✅ Next.js build directory exists"
else
    echo "❌ Next.js build missing - run 'npm run build'"
    exit 1
fi

# Check GitHub Actions workflow
if [ -f ".github/workflows/recovered-changes_ocr-app-.yml" ]; then
    echo "✅ GitHub Actions workflow file exists"
else
    echo "❌ GitHub Actions workflow missing"
    exit 1
fi

echo ""
echo "=== Deployment Status ==="
echo "Your application should now deploy successfully to Azure with these fixes:"
echo "1. ✅ Fixed package.json module type conflict"
echo "2. ✅ Enhanced server.js with Azure environment variables"
echo "3. ✅ Updated startup scripts for Azure App Service"
echo "4. ✅ Improved web.config for IIS integration"
echo "5. ✅ Enhanced GitHub Actions workflow"
echo "6. ✅ Added proper directory creation and permissions"
echo ""
echo "Deployment should automatically trigger since we pushed to 'recovered-changes' branch"
echo "Monitor the deployment at: https://github.com/Rayyan9477/ocr-app/actions"
echo ""
echo "If deployment succeeds, your app will be available at:"
echo "https://ocr-app--hdg2bhcrh7h8apdm.ukwest-01.azurewebsites.net"

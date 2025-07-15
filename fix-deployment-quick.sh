#!/bin/bash
# Quick fix script for Azure deployment issue

echo "=== Fixing Azure Deployment Issue ==="

# Add the changes
git add .github/workflows/azure-deploy.yml fix-azure-deployment.md fix-deployment-quick.sh

# Commit the changes
git commit -m "Fix Azure deployment: remove slot-name, update app name, and add troubleshooting guide"

# Push to trigger new deployment
git push

echo "=== Changes pushed! ==="
echo "Monitor deployment at: https://github.com/Rayyan9477/ocr-app/actions"
echo ""
echo "IMPORTANT: If deployment still fails, you need to:"
echo "1. Go to Azure Portal"
echo "2. Find your App Service (note the exact name)"
echo "3. Download fresh publish profile"
echo "4. Update GitHub secret with new publish profile"
echo ""
echo "See fix-azure-deployment.md for detailed instructions" 
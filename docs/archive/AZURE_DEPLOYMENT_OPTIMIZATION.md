# Azure Deployment Optimization

This document explains the optimizations made to improve the Azure App Service deployment process for this Next.js application.

## Deployment Optimization Files

The following files have been created or modified to optimize the deployment process:

1. `.deployignore` - Lists files and directories to exclude from deployment
2. `.gitattributes` - Controls line endings and marks files for export-ignore
3. `scripts/cleanup-for-deployment.sh` - Script to clean up unnecessary files before deployment
4. `web.config.production` - Fallback web.config file for IIS configuration
5. `package.json.production` - Minimal package.json for production deployment
6. `.github/workflows/azure-deploy.yml` - GitHub Actions workflow for deployment

## Optimization Strategies

### 1. Reducing Deployment Package Size

- Excluded development files, tests, documentation, and build artifacts
- Removed unnecessary files from node_modules
- Optimized .next directory by removing cache and large source maps
- Created minimal package.json for production

### 2. Configuration Resilience

- Added fallback web.config file for IIS configuration
- Enhanced error handling for missing files
- Added validation steps to verify deployment structure

### 3. Static Files Handling

- Ensured proper copying of Next.js static files
- Verified public directory structure
- Added checks for required directories

### 4. Deployment Process Improvements

- Enhanced cleanup process with dedicated script
- Added verification steps throughout the workflow
- Improved error handling and reporting

## How to Use

The deployment process is fully automated through GitHub Actions. When code is pushed to the main branch, the workflow will:

1. Build the Next.js application
2. Create an optimized deployment package
3. Remove unnecessary files using the deployment cleanup script
4. Deploy to Azure App Service
5. Verify the deployment

For manual deployments, you can use the `scripts/cleanup-for-deployment.sh` script to prepare a deployment package:

```bash
# Create deployment directory
mkdir -p deployment

# Copy your application files
cp -r . deployment/

# Run the cleanup script
./scripts/cleanup-for-deployment.sh deployment

# The resulting 'deployment' directory can now be deployed to Azure
```

## Troubleshooting

If deployment fails, check:

1. The logs in GitHub Actions for detailed error messages
2. Verify that web.config and iisnode.yml are correctly formatted
3. Ensure server.js is properly configured for Azure App Service
4. Check that all required directories exist and have proper permissions

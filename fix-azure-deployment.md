# Fix Azure Deployment - GitHub Actions Issue

## Problem
The GitHub Actions deployment is failing with:
```
Error: Deployment Failed, Error: Publish profile is invalid for app-name and slot-name provided. Provide correct publish profile credentials for app.
```

## Root Cause
The publish profile secret in GitHub doesn't match the actual Azure App Service name or the profile is outdated/incorrect.

## Solution Steps

### Step 1: Verify Your Azure App Service Name
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **App Services**
3. Find your OCR app and note the **exact name** (case-sensitive)
4. Current GitHub Actions is trying to deploy to: `ocr-app-`

### Step 2: Download Fresh Publish Profile
1. In Azure Portal, go to your App Service
2. Click **"Get publish profile"** in the toolbar
3. This downloads a `.PublishSettings` file
4. Open the file in a text editor and copy **ALL content**

### Step 3: Update GitHub Secrets
1. Go to your GitHub repository: https://github.com/Rayyan9477/ocr-app
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Find the secret: `AZUREAPPSERVICE_PUBLISHPROFILE_E7A94C1E72D2413EA5D290FEE494EFFF`
4. Click **"Update"** and paste the **complete publish profile XML content**
5. Save the secret

### Step 4: Update App Name in Workflow (if needed)
If your actual app name is different from `ocr-app-`, update `.github/workflows/azure-deploy.yml`:

```yaml
env:
  AZURE_WEBAPP_NAME: YOUR_ACTUAL_APP_NAME  # Replace with exact name from Azure Portal
```

### Step 5: Trigger New Deployment
1. Make a small change (or empty commit):
   ```bash
   git commit --allow-empty -m "Retry deployment with fixed publish profile"
   git push
   ```
2. Or manually trigger in GitHub Actions:
   - Go to **Actions** tab
   - Select the workflow
   - Click **"Run workflow"**

## Common Issues and Fixes

### Issue 1: App Name Mismatch
- **Problem**: The app name in GitHub Actions doesn't match Azure
- **Fix**: Update `AZURE_WEBAPP_NAME` in the workflow file

### Issue 2: Slot Name Issue
- **Problem**: Trying to deploy to a specific slot that doesn't exist
- **Fix**: We've removed `slot-name` from the workflow to use default production slot

### Issue 3: Outdated Publish Profile
- **Problem**: The publish profile was generated for a different app or is expired
- **Fix**: Download a fresh publish profile from the correct app service

### Issue 4: Wrong Secret Name
- **Problem**: Using wrong secret name in GitHub
- **Fix**: Ensure the secret name matches exactly: `AZUREAPPSERVICE_PUBLISHPROFILE_E7A94C1E72D2413EA5D290FEE494EFFF`

## Verification Steps

1. **Check App Service Status**:
   - Ensure your Azure App Service is running
   - Verify it's configured for Node.js 20.x
   - Check that it has sufficient resources

2. **Test Locally**:
   ```bash
   npm run build
   npm start
   ```

3. **Monitor Deployment**:
   - Watch the GitHub Actions run: https://github.com/Rayyan9477/ocr-app/actions
   - Check Azure App Service logs in Azure Portal

## Alternative: Create New App Service

If the current app service has issues, you can create a new one:

1. **Delete current app service** (if needed)
2. **Create new app service**:
   - Name: `ocr-app-rayyan9477` (or your preferred name)
   - Runtime: Node.js 20 LTS
   - Region: Your preferred region
3. **Download new publish profile**
4. **Update GitHub secrets with new publish profile**
5. **Update workflow with new app name**

## Quick Fix Commands

```bash
# 1. Update the workflow file (already done)
# 2. Commit and push changes
git add .github/workflows/azure-deploy.yml
git commit -m "Fix Azure deployment workflow - correct app name and remove slot-name"
git push

# 3. Trigger deployment
git commit --allow-empty -m "Trigger deployment with fixed configuration"
git push
```

## Expected Result

After fixing the publish profile and app name:
- GitHub Actions should complete successfully
- App should be accessible at: `https://ocr-app-.azurewebsites.net`
- Health check endpoint should respond: `https://ocr-app-.azurewebsites.net/api/health`

## Need Help?

If the issue persists:
1. Check the exact error message in GitHub Actions
2. Verify the app service exists and is running in Azure Portal
3. Ensure the publish profile is for the correct app service
4. Try creating a new app service with a different name

The most common fix is simply downloading a fresh publish profile from the correct Azure App Service and updating the GitHub secret. 
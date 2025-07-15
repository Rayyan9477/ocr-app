# Azure Secret Setup for GitHub Actions

## ⚠️ IMPORTANT: Required Secret Configuration

Your GitHub Actions workflow requires the `AZUREAPPSERVICE_PUBLISHPROFILE_E7A94C1E72D2413EA5D290FEE494EFFF` secret to be configured in your repository.

## 🔧 Step-by-Step Setup

### 1. Download Azure Publish Profile

1. Go to the [Azure Portal](https://portal.azure.com)
2. Navigate to your App Service: `ocr-app-rayyan9477`
3. In the Overview page, click **"Get publish profile"**
4. Download the `.publishsettings` file

### 2. Add Secret to GitHub Repository

1. Go to your GitHub repository: `https://github.com/Rayyan9477/ocr-app`
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Set the name as: `AZUREAPPSERVICE_PUBLISHPROFILE_E7A94C1E72D2413EA5D290FEE494EFFF`
6. Open the downloaded `.publishsettings` file in a text editor
7. Copy the ENTIRE contents of the file
8. Paste it into the secret value field
9. Click **Add secret**

### 3. Verify Secret Configuration

After adding the secret, your workflow should work without the "No credentials found" error.

## 🚀 Alternative: Using Azure CLI (Advanced)

If you prefer using Azure CLI instead of publish profile:

```bash
# Login to Azure
az login

# Get publish profile
az webapp deployment list-publishing-profiles --name ocr-app-rayyan9477 --resource-group your-resource-group --xml
```

## 📋 Troubleshooting

### If you still get "No credentials found" error:

1. **Check secret name**: Ensure it's exactly `AZUREAPPSERVICE_PUBLISHPROFILE_E7A94C1E72D2413EA5D290FEE494EFFF`
2. **Check secret content**: Make sure you copied the entire `.publishsettings` file content
3. **Verify App Service name**: Ensure `ocr-app-rayyan9477` matches your actual App Service name
4. **Resource group**: Verify the resource group exists and contains your App Service

### Common Issues:

- **Secret not found**: Double-check the secret name spelling
- **Invalid publish profile**: Re-download the publish profile from Azure Portal
- **Expired credentials**: Regenerate the publish profile if it's old

## ✅ Verification

Once configured, your workflow will:
1. ✅ Verify Azure credentials are present
2. ✅ Login to Azure using the publish profile
3. ✅ Deploy to Azure App Service successfully

## 🔐 Security Best Practices

- Never commit the publish profile to your repository
- Use repository secrets, not environment variables
- Regularly rotate your publish profile credentials
- Consider using Azure Service Principal for production environments

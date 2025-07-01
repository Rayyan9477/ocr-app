# Azure Container Apps Deployment Guide

## Prerequisites
- Azure CLI installed
- Azure subscription
- Resource group created

## Steps:

### 1. Install Azure CLI (if not already installed)
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### 2. Login to Azure
```bash
az login
```

### 3. Create Resource Group
```bash
az group create --name ocr-app-rg --location eastus
```

### 4. Create Container Apps Environment
```bash
az containerapp env create \
  --name ocr-app-env \
  --resource-group ocr-app-rg \
  --location eastus
```

### 5. Build and push to Azure Container Registry
```bash
# Create ACR
az acr create --resource-group ocr-app-rg --name ocrappreg --sku Basic

# Login to ACR
az acr login --name ocrappreg

# Build and push
docker build -t ocrappreg.azurecr.io/ocr-app:latest .
docker push ocrappreg.azurecr.io/ocr-app:latest
```

### 6. Deploy Container App
```bash
az containerapp create \
  --name ocr-app \
  --resource-group ocr-app-rg \
  --environment ocr-app-env \
  --image ocrappreg.azurecr.io/ocr-app:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 2.0 \
  --memory 4.0Gi \
  --env-vars NODE_ENV=production PORT=3000
```

## Security Features for HIPAA Compliance:
- Private networking
- Managed identity
- Key Vault integration
- SSL/TLS encryption
- Audit logging
- Access controls

## Cost: ~$50-100/month for basic setup

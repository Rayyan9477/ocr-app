# Railway Deployment Guide

## Prerequisites
- Railway account
- GitHub repository

## Steps:

### 1. Create Dockerfile for Railway
```dockerfile
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    ghostscript \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build app
RUN npm run build

# Create directories
RUN mkdir -p uploads processed output tmp

EXPOSE 3000

CMD ["npm", "start"]
```

### 2. Deploy via Railway
1. Connect your GitHub repository to Railway
2. Railway will auto-detect the Dockerfile
3. Set environment variables in Railway dashboard
4. Deploy automatically on git push

## Environment Variables:
- NODE_ENV=production
- PORT=3000
- MAX_UPLOAD_SIZE=100

## Features:
- Automatic deployments
- Custom domains
- Database integration
- Monitoring and logs

## Cost: $5-20/month depending on usage

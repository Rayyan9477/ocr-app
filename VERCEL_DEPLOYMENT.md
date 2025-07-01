# Vercel Deployment Guide

## Prerequisites
- Vercel account
- GitHub repository

## Steps:

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy
```bash
vercel --prod
```

## Configuration for OCR App:

### Environment Variables (add in Vercel dashboard):
- NODE_ENV=production
- MAX_UPLOAD_SIZE=100
- NEXT_TELEMETRY_DISABLED=1

### Build Settings:
- Framework Preset: Next.js
- Build Command: npm run build
- Output Directory: .next
- Install Command: npm install

## Limitations:
- File uploads limited to 50MB on Vercel
- Function timeout: 60 seconds (hobby), 300 seconds (pro)
- No persistent file storage
- May need serverless functions for OCR processing

## Cost: 
- Free tier available
- Pro: $20/month per team member

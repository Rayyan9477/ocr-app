# DigitalOcean App Platform Deployment

## Prerequisites
- DigitalOcean account
- GitHub repository

## Steps:

### 1. Create App Spec (app.yaml)
```yaml
name: ocr-app
services:
- name: web
  source_dir: /
  github:
    repo: your-username/ocr-app
    branch: main
  run_command: npm start
  build_command: npm run build
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  routes:
  - path: /
  envs:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: "3000"
  - key: MAX_UPLOAD_SIZE
    value: "100"
```

### 2. Deploy
1. Go to DigitalOcean App Platform
2. Connect your GitHub repository
3. Use the app spec or configure manually
4. Deploy

## Features:
- Automatic scaling
- SSL certificates
- Custom domains
- Database integration
- Monitoring

## Cost: $12-48/month depending on resources

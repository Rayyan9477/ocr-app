# OCR Application Deployment Guide

This guide provides instructions for deploying the OCR application in various environments.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
  - [Docker Deployment](#docker-deployment)
  - [Kubernetes Deployment](#kubernetes-deployment)
  - [Cloud Deployment](#cloud-deployment)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker and Docker Compose (for container deployment)
- Node.js 20+ (for non-containerized deployment)
- OCRmyPDF and its dependencies (for non-containerized deployment)

## Deployment Options

### Docker Deployment

The simplest way to deploy the application is using Docker and Docker Compose.

#### Single Architecture Deployment

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ocr-app
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

3. Build and start the container:
   ```bash
   ./run.sh up
   ```

4. Access the application at http://localhost:3000 (or the configured port)

#### Multi-Architecture Deployment

For deployment across different architectures (e.g., x86_64/amd64 and ARM64):

```bash
# Build for multiple platforms
./build-multiplatform.sh --version 1.0.0 --platforms "linux/amd64,linux/arm64"

# Deploy on specific architecture
TARGETARCH=arm64 docker-compose up -d
```

### Kubernetes Deployment

For Kubernetes deployment, use the following steps:

1. Create a ConfigMap for environment variables:
   ```bash
   kubectl create configmap ocr-app-config --from-env-file=.env
   ```

2. Apply the Kubernetes manifests:
   ```bash
   kubectl apply -f k8s/
   ```

Sample Kubernetes manifests can be found in the `k8s/` directory.

### Cloud Deployment

#### AWS Elastic Container Service (ECS)

1. Create an ECS task definition:
   ```bash
   aws ecs register-task-definition --cli-input-json file://aws/task-definition.json
   ```

2. Create a service:
   ```bash
   aws ecs create-service --cli-input-json file://aws/service-definition.json
   ```

#### Google Cloud Run

```bash
gcloud run deploy ocr-app \
  --image=gcr.io/your-project/ocr-app:1.0.0 \
  --platform=managed \
  --memory=2Gi \
  --cpu=2 \
  --port=3000 \
  --set-env-vars="NODE_ENV=production,MAX_UPLOAD_SIZE=100"
```

#### Azure Container Apps

```bash
az containerapp create \
  --name ocr-app \
  --resource-group your-resource-group \
  --image yourregistry.azurecr.io/ocr-app:1.0.0 \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 5 \
  --env-vars "NODE_ENV=production" "MAX_UPLOAD_SIZE=100"
```

## Configuration

The application can be configured using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | HTTP port for the application | 3000 |
| NODE_ENV | Node.js environment | production |
| MAX_UPLOAD_SIZE | Maximum upload size in MB | 100 |
| OCR_TIMEOUT | OCR processing timeout in ms | 600000 |
| DEFAULT_LANGUAGE | Default OCR language | eng |
| ENABLE_OPTIMIZATION | Enable PDF optimization | true |
| JBIG2_PATH | Path to jbig2 binary | /usr/bin/jbig2 |
| UPLOADS_DIR | Directory for file uploads | ./uploads |
| PROCESSED_DIR | Directory for processed files | ./processed |

## Troubleshooting

### Common Issues

1. **OCRmyPDF not working properly:**
   
   Verify OCRmyPDF installation by accessing:
   ```
   http://your-app/api/check-dependencies
   ```

2. **Permission issues with upload/processed directories:**
   
   Ensure proper permissions:
   ```bash
   chmod -R 777 uploads processed  # For development
   # For production, set appropriate user/group permissions
   ```

3. **Container networking issues:**
   
   Check container status:
   ```bash
   docker-compose ps
   docker-compose logs
   ```

4. **Performance issues:**
   
   Adjust container resources in docker-compose.yml:
   ```yaml
   deploy:
     resources:
       limits:
         memory: 4G  # Increase for larger documents
         cpus: '2'   # Increase for faster processing
   ```

### Health Check

The application provides a health check endpoint:
```
http://your-app/api/status
```

This endpoint returns detailed system status information, including:
- OCRmyPDF availability
- Directory permissions
- System resources

## Support

For additional support or questions, contact the maintainers or file an issue in the repository.

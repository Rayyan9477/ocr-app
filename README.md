# OCR Application

This is a Next.js application that provides OCR (Optical Character Recog### Running on Windows
Works natively on both Intel and Apple Silicon Macs. Follow the Quick Start instructions.

### Running on Windows
Docker Desktop for Windows is required. Then follow the Quick Start instructions.

### Running in Cloud Environments
The application is designed to run in any container-based cloud environment:

- **AWS ECS/EKS**: Use the provided Dockerfile and set appropriate environment variables
- **Google Cloud Run**: Use the provided Dockerfile for deployment
- **Azure Container Apps**: Use the provided Dockerfile and environment variables

## Advanced Usage

### Portability Tools

The application includes several tools to ensure smooth operation across different environments:

- `check-portability.sh`: Checks if your system meets all requirements
- `run-portable.sh`: Runs the application with automatic environment detection
- `healthcheck.sh`: Verifies the application is running correctly
- `build-multiplatform.sh`: Builds images for multiple processor architectures

### Multi-architecture Build

To build for multiple architectures:

```bash
./build-multiplatform.sh --version 1.0.0 --platforms "linux/amd64,linux/arm64"
```

For detailed deployment instructions, see the [DEPLOYMENT.md](DEPLOYMENT.md) file.lities using OCRmyPDF.

## Features

- Upload PDF files for OCR processing
- Process PDFs with OCRmyPDF
- Configure OCR parameters (language, optimization, etc.)
- Download processed files
- Modern UI with Next.js and Tailwind CSS
- **Cross-platform compatibility**: Runs on Linux, macOS, and Windows
- **Multi-architecture support**: Works on x86_64/amd64 and ARM64 processors

## Prerequisites

- Docker and Docker Compose
- Git (for cloning the repository)

No other dependencies are required as all necessary packages are included in the Docker container.

## Quick Start

### Option 1: Quick Install (Recommended for most users)

```bash
git clone <repository-url>
cd ocr-app
./install.sh
```

This script will check requirements, create necessary directories, and start the application.

### Option 2: Portable Run

```bash
git clone <repository-url>
cd ocr-app
./run-portable.sh up
```

The portable run script automatically detects your system architecture and configures the application accordingly.

## Configuration

The application can be configured using environment variables in the `.env` file:

### Application Settings
- `APP_VERSION`: Application version tag for Docker image (default: 1.0.0)
- `PORT`: Port to expose the application (default: 3000)
- `NODE_ENV`: Node.js environment (default: production)

### Resource Limits
- `MAX_UPLOAD_SIZE`: Maximum upload size in MB (default: 100)
- `NODE_MEMORY`: Node.js memory limit in MB (default: 4096)
- `CONTAINER_MEMORY`: Docker container memory limit (default: 4G)
- `CONTAINER_MEMORY_RESERVATION`: Docker container memory reservation (default: 2G)
- `CONTAINER_CPUS`: Docker container CPU limit (default: 2)

### Storage Configuration
- `UPLOADS_DIR`: Directory for uploaded files (default: ./uploads)
- `PROCESSED_DIR`: Directory for processed files (default: ./processed)

### OCR Configuration
- `DEFAULT_LANGUAGE`: Default OCR language (default: eng)
- `ENABLE_OPTIMIZATION`: Enable PDF optimization (default: true)

### Docker Settings
- `TARGETARCH`: Target architecture for build (default: amd64, options: amd64, arm64)
- `CONTAINER_USER`: User to run the container as (default: node)

### Debug Options
- `DEBUG`: Enable debug mode (default: false)

## Multi-platform Support

This application supports both amd64 (x86_64) and arm64 (Apple Silicon/ARM) architectures. To build for a specific architecture:

```bash
# For AMD64/x86_64
TARGETARCH=amd64 docker-compose up -d

# For ARM64
TARGETARCH=arm64 docker-compose up -d
```

## Running on Different Systems

### Running on Linux
No special configuration needed - just follow the Quick Start instructions.

### Running on macOS
Works natively on both Intel and Apple Silicon Macs. Follow the Quick Start instructions.

### Running on Windows
Docker Desktop for Windows is required. Then follow the Quick Start instructions.

### Running in Cloud Environments
The application is designed to run in any container-based cloud environment:

- **AWS ECS/EKS**: Use the provided Dockerfile and set appropriate environment variables
- **Google Cloud Run**: Use the provided Dockerfile for deployment
- **Azure Container Apps**: Use the provided Dockerfile and environment variables

## Advanced Usage

### Building the Docker Image Manually

```bash
# Build for the current architecture
docker build -t ocr-app:1.0.0 .

# Build for a specific architecture
docker build --build-arg TARGETARCH=arm64 -t ocr-app:1.0.0 .
```

### Running OCR with Different Languages

The following language packs are included:
- English (eng)
- French (fra)
- German (deu)
- Spanish (spa)
- Italian (ita)
- Russian (rus)
- Chinese Simplified (chi-sim)
- Japanese (jpn)

Specify the desired language using the UI or set DEFAULT_LANGUAGE in the .env file.

### Storage Considerations

By default, uploaded and processed files are stored in the `./uploads` and `./processed` directories respectively. For production use, consider configuring persistent storage:

```yaml
volumes:
  - /path/to/persistent/uploads:/app/uploads
  - /path/to/persistent/processed:/app/processed
```

## Troubleshooting

### Common Issues

1. **"jbig2 command not working" warning**:
   This is a non-fatal warning. JBIG2 is used for optimization but the application will still work without it.

2. **Permission issues with volumes**:
   Ensure the volumes have appropriate permissions:
   ```bash
   mkdir -p ./uploads ./processed
   chmod 777 ./uploads ./processed
   ```

3. **Application not starting**:
   Check the logs:
   ```bash
   docker-compose logs
   ```

## License

[Your License Information]

## Acknowledgements

- OCRmyPDF: https://github.com/jbarlow83/OCRmyPDF
- JBIG2enc: https://github.com/agl/jbig2enc
- Next.js: https://nextjs.org/
- Tailwind CSS: https://tailwindcss.com/

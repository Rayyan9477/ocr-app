#!/usr/bin/env bash

# Script to build multi-platform Docker images for the OCR application

set -e

# Default values
VERSION="1.0.0"
PLATFORMS="linux/amd64,linux/arm64"
PUSH=false
REPOSITORY="ocr-app"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--version)
      VERSION="$2"
      shift 2
      ;;
    -p|--platforms)
      PLATFORMS="$2"
      shift 2
      ;;
    --push)
      PUSH=true
      shift
      ;;
    -r|--repository)
      REPOSITORY="$2"
      shift 2
      ;;
    -h|--help)
      echo "OCR Application Multi-Platform Build Script"
      echo ""
      echo "Usage: ./build-multiplatform.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -v, --version      Image version (default: 1.0.0)"
      echo "  -p, --platforms    Platforms to build for (default: linux/amd64,linux/arm64)"
      echo "  -r, --repository   Repository name (default: ocr-app)"
      echo "  --push             Push images to Docker registry"
      echo "  -h, --help         Show this help message"
      echo ""
      echo "Examples:"
      echo "  ./build-multiplatform.sh"
      echo "  ./build-multiplatform.sh --version 1.2.0 --push"
      echo "  ./build-multiplatform.sh -r myregistry/ocr-app -v 1.1.0 --push"
      echo ""
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "Building OCR Application multi-platform image:"
echo "- Version: $VERSION"
echo "- Platforms: $PLATFORMS"
echo "- Repository: $REPOSITORY"
echo "- Push: $PUSH"
echo ""

# Ensure buildx is available
if ! docker buildx version >/dev/null 2>&1; then
  echo "Error: Docker buildx is not available"
  echo "Please enable Docker experimental features and install buildx"
  exit 1
fi

# Create a new builder instance if it doesn't exist
if ! docker buildx inspect multiarch >/dev/null 2>&1; then
  echo "Creating new buildx builder instance..."
  docker buildx create --name multiarch --use
fi

# Build command
BUILD_CMD="docker buildx build --platform $PLATFORMS"
BUILD_CMD+=" -t $REPOSITORY:$VERSION"
BUILD_CMD+=" -t $REPOSITORY:latest"

if $PUSH; then
  BUILD_CMD+=" --push"
else
  BUILD_CMD+=" --load"
fi

BUILD_CMD+=" ."

# Execute build
echo "Executing build command:"
echo "$BUILD_CMD"
echo ""

eval "$BUILD_CMD"

echo ""
echo "Build completed successfully!"
if $PUSH; then
  echo "Images have been pushed to the registry"
else
  echo "Images are available locally"
fi

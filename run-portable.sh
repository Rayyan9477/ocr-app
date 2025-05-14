#!/bin/bash
# Wrapper script for running the OCR application with automatic architecture detection

set -e

# Detect system architecture and map to Docker architecture
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)
        DOCKER_ARCH="amd64"
        ;;
    amd64)
        DOCKER_ARCH="amd64"
        ;;
    aarch64|arm64)
        DOCKER_ARCH="arm64"
        ;;
    armv7l)
        DOCKER_ARCH="arm/v7"
        ;;
    *)
        echo "Warning: Unknown architecture $ARCH, defaulting to amd64"
        DOCKER_ARCH="amd64"
        ;;
esac

# Detect operating system
OS=$(uname -s)
case "$OS" in
    Linux)
        PLATFORM="linux"
        ;;
    Darwin)
        PLATFORM="darwin"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        PLATFORM="windows"
        ;;
    *)
        echo "Warning: Unknown platform $OS, defaulting to linux"
        PLATFORM="linux"
        ;;
esac

echo "Detected platform: $PLATFORM/$ARCH (Docker: $DOCKER_ARCH)"

# Set environment variables based on platform and architecture
export TARGETARCH=$DOCKER_ARCH
export PLATFORM=$PLATFORM

# Check for port conflicts
DEFAULT_PORT=3000
PORT=${PORT:-$DEFAULT_PORT}

# On Linux/macOS, check if port is already in use
if [[ "$PLATFORM" != "windows" ]]; then
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
        echo "Warning: Port $PORT is already in use. Trying alternative port..."
        PORT=3001
        # Check if alternative port is also in use
        if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
            echo "Warning: Port $PORT is also in use. Please specify a different port with PORT=xxxx"
            PORT=0
        fi
    fi
fi

# Set final PORT if not 0
if [[ "$PORT" != "0" ]]; then
    export PORT=$PORT
    echo "Using port: $PORT"
fi

# Create data directories if they don't exist
mkdir -p uploads processed

# Pass all arguments to run.sh
./run.sh --arch $DOCKER_ARCH "$@"

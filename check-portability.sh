#!/bin/bash
# Script to check portability requirements for the OCR application

set -e

echo "OCR Application Portability Check"
echo "================================="
echo

# Check Docker availability
echo "Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo "✅ Docker is installed: $DOCKER_VERSION"
else
    echo "❌ Docker is not installed"
    echo "   Please install Docker from https://docs.docker.com/get-docker/"
    HAS_ERROR=true
fi

# Check Docker Compose availability
echo "Checking Docker Compose installation..."
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo "✅ Docker Compose is installed: $COMPOSE_VERSION"
elif docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    echo "✅ Docker Compose plugin is installed: $COMPOSE_VERSION"
else
    echo "❌ Docker Compose is not installed"
    echo "   Please install Docker Compose from https://docs.docker.com/compose/install/"
    HAS_ERROR=true
fi

# Check disk space
echo "Checking available disk space..."
if command -v df &> /dev/null; then
    # Get available space in the current directory in KB
    AVAILABLE_SPACE=$(df -k . | awk 'NR==2 {print $4}')
    # Convert to GB
    AVAILABLE_SPACE_GB=$(echo "scale=2; $AVAILABLE_SPACE/1024/1024" | bc)
    
    # Need at least 2GB free space
    if (( $(echo "$AVAILABLE_SPACE_GB >= 2" | bc -l) )); then
        echo "✅ Sufficient disk space: ${AVAILABLE_SPACE_GB}GB available"
    else
        echo "❌ Insufficient disk space: ${AVAILABLE_SPACE_GB}GB available (need at least 2GB)"
        HAS_ERROR=true
    fi
else
    echo "⚠️ Cannot check disk space (df command not available)"
fi

# Check memory
echo "Checking available system memory..."
if command -v free &> /dev/null; then
    # Get available memory in KB
    AVAILABLE_MEM=$(free -k | awk '/Mem:/ {print $7}')
    # Convert to GB
    AVAILABLE_MEM_GB=$(echo "scale=2; $AVAILABLE_MEM/1024/1024" | bc)
    
    # Need at least 2GB free memory
    if (( $(echo "$AVAILABLE_MEM_GB >= 2" | bc -l) )); then
        echo "✅ Sufficient memory: ${AVAILABLE_MEM_GB}GB available"
    else
        echo "⚠️ Limited memory: ${AVAILABLE_MEM_GB}GB available (recommended at least 2GB)"
        echo "   Performance may be affected"
    fi
else
    echo "⚠️ Cannot check memory (free command not available)"
fi

# Check if curl is available (needed for healthcheck)
echo "Checking curl availability..."
if command -v curl &> /dev/null; then
    CURL_VERSION=$(curl --version | head -n 1)
    echo "✅ curl is installed: $CURL_VERSION"
else
    echo "⚠️ curl is not installed"
    echo "   This is needed for health checks"
fi

# Check architecture
echo "Checking system architecture..."
ARCH=$(uname -m)
case "$ARCH" in
    x86_64|amd64)
        echo "✅ Architecture: $ARCH (fully supported)"
        ;;
    aarch64|arm64)
        echo "✅ Architecture: $ARCH (fully supported)"
        ;;
    armv7l)
        echo "⚠️ Architecture: $ARCH (may have limited performance)"
        ;;
    *)
        echo "⚠️ Architecture: $ARCH (not tested, may have compatibility issues)"
        ;;
esac

# Check operating system
echo "Checking operating system..."
OS=$(uname -s)
case "$OS" in
    Linux)
        echo "✅ Operating System: Linux (fully supported)"
        ;;
    Darwin)
        echo "✅ Operating System: macOS (fully supported)"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        echo "✅ Operating System: Windows (supported with Docker Desktop)"
        ;;
    *)
        echo "⚠️ Operating System: $OS (not tested, may have compatibility issues)"
        ;;
esac

# Check if required ports are available
echo "Checking if default port (3000) is available..."
if command -v lsof &> /dev/null; then
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️ Port 3000 is already in use"
        echo "   You can specify a different port with PORT=xxxx"
    else
        echo "✅ Port 3000 is available"
    fi
elif command -v netstat &> /dev/null; then
    if netstat -tuln | grep ":3000 " >/dev/null; then
        echo "⚠️ Port 3000 is already in use"
        echo "   You can specify a different port with PORT=xxxx"
    else
        echo "✅ Port 3000 is available"
    fi
else
    echo "⚠️ Cannot check port availability (lsof/netstat not available)"
fi

echo
if [ "$HAS_ERROR" = true ]; then
    echo "❌ Some critical requirements are not met. Please fix the issues above."
    exit 1
else
    echo "✅ Your system meets the requirements to run the OCR application."
    echo "   Run './run-portable.sh up' to start the application."
    exit 0
fi

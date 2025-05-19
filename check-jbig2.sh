#!/bin/bash
# Script to check and install jbig2enc if it's missing

echo "Checking for jbig2enc..."
if command -v jbig2 &> /dev/null; then
    JBIG2_VERSION=$(jbig2 --version 2>&1 || echo "Unknown version")
    echo "✅ jbig2enc is already installed: $JBIG2_VERSION"
else
    echo "❌ jbig2enc is not installed"
    
    # Detect OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    elif [ -f /etc/debian_version ]; then
        OS="debian"
    elif [ -f /etc/redhat-release ]; then
        OS="redhat"
    else
        OS="unknown"
    fi
    
    echo "Detected OS: $OS"
    
    # Install based on OS
    case $OS in
        ubuntu|debian)
            echo "Installing jbig2enc using apt..."
            sudo apt-get update
            sudo apt-get install -y jbig2
            ;;
        fedora|centos|rhel)
            echo "Installing jbig2enc using yum..."
            sudo yum install -y jbig2
            ;;
        alpine)
            echo "Installing jbig2enc using apk..."
            sudo apk add --no-cache jbig2enc
            ;;
        *)
            echo "Unsupported OS for automatic installation. Please install jbig2enc manually."
            exit 1
            ;;
    esac
    
    # Verify installation
    if command -v jbig2 &> /dev/null; then
        JBIG2_VERSION=$(jbig2 --version 2>&1 || echo "Unknown version")
        echo "✅ jbig2enc has been installed: $JBIG2_VERSION"
    else
        echo "❌ Failed to install jbig2enc"
        exit 1
    fi
fi

# Output jbig2 path for config
JBIG2_PATH=$(which jbig2)
echo "jbig2 binary path: $JBIG2_PATH"
echo "You can set this path in your environment variables:"
echo "export JBIG2_PATH=$JBIG2_PATH"

exit 0

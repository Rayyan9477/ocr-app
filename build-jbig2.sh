#!/bin/bash
# Script to build and install jbig2enc if not already present

# Console colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}jbig2enc Build and Install Helper${NC}"
echo -e "${BLUE}========================================${NC}"

# Check for jbig2
check_jbig2() {
    if command -v jbig2 &> /dev/null; then
        echo -e "${GREEN}✓ jbig2 is already installed: $(command -v jbig2)${NC}"
        jbig2 --version | head -n 1
        return 0
    elif [ -x "./jbig2enc/src/jbig2" ]; then
        echo -e "${GREEN}✓ jbig2 is already built locally: $(pwd)/jbig2enc/src/jbig2${NC}"
        ./jbig2enc/src/jbig2 --version | head -n 1
        return 0
    else
        echo -e "${YELLOW}⚠️ jbig2 not found, will attempt to build${NC}"
        return 1
    fi
}

# Check for build dependencies
check_dependencies() {
    local missing=0
    
    echo "Checking for build dependencies..."
    
    # Essential build tools
    for cmd in gcc g++ make libtool automake autoconf pkg-config; do
        if ! command -v $cmd &> /dev/null; then
            echo -e "${RED}✗ Missing: $cmd${NC}"
            missing=1
        else
            echo -e "${GREEN}✓ Found: $cmd${NC}"
        fi
    done
    
    # Leptonica library
    if ! pkg-config --exists lept; then
        echo -e "${RED}✗ Missing: leptonica development files${NC}"
        missing=1
    else
        echo -e "${GREEN}✓ Found: leptonica $(pkg-config --modversion lept)${NC}"
    fi
    
    if [ $missing -eq 1 ]; then
        echo -e "${YELLOW}Some dependencies are missing. Install them with:${NC}"
        echo -e "sudo apt-get update && sudo apt-get install -y build-essential libtool automake autoconf pkg-config libleptonica-dev"
        return 1
    fi
    
    return 0
}

# Build jbig2enc from source
build_jbig2() {
    local build_dir="jbig2enc"
    
    # Check if directory already exists
    if [ ! -d "$build_dir" ]; then
        echo "Cloning jbig2enc repository..."
        git clone https://github.com/agl/jbig2enc.git
        if [ $? -ne 0 ]; then
            echo -e "${RED}Failed to clone repository${NC}"
            return 1
        fi
    else
        echo "Using existing jbig2enc directory"
    fi
    
    cd "$build_dir"
    
    # Run the build process
    echo "Preparing build environment..."
    if [ ! -f "configure" ]; then
        echo "Running autogen.sh..."
        ./autogen.sh
        if [ $? -ne 0 ]; then
            echo -e "${RED}autogen.sh failed${NC}"
            return 1
        fi
    fi
    
    echo "Configuring..."
    if [ ! -f "Makefile" ]; then
        ./configure
        if [ $? -ne 0 ]; then
            echo -e "${RED}configure failed${NC}"
            return 1
        fi
    fi
    
    echo "Building jbig2enc..."
    make
    if [ $? -ne 0 ]; then
        echo -e "${RED}Build failed${NC}"
        return 1
    fi
    
    if [ ! -x "src/jbig2" ]; then
        echo -e "${RED}Build completed but jbig2 binary not found${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Successfully built jbig2:${NC}"
    ./src/jbig2 --version | head -n 1
    
    return 0
}

# Main execution
if check_jbig2; then
    echo -e "${GREEN}jbig2 is already available, no need to build${NC}"
    exit 0
fi

if ! check_dependencies; then
    echo -e "${YELLOW}Please install the missing dependencies before continuing${NC}"
    exit 1
fi

if build_jbig2; then
    echo -e "${GREEN}jbig2 has been successfully built${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "You can now use jbig2 for better PDF optimization."
    echo -e "The binary is located at: $(pwd)/jbig2enc/src/jbig2"
    echo -e "${BLUE}========================================${NC}"
    exit 0
else
    echo -e "${RED}Failed to build jbig2${NC}"
    echo -e "Please check the error messages above and try to resolve the issues"
    echo -e "You can also install jbig2enc using your package manager:"
    echo -e "  sudo apt-get install jbig2enc"
    exit 1
fi

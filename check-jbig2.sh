#!/bin/bash
# Script to check for jbig2 at startup and suggest fixes

# Config
WORKSPACE_PATH="/workspaces/ocr-app"
JBIG2_SOURCE_PATH="$WORKSPACE_PATH/jbig2enc/src/jbig2"
JBIG2_DEFAULT_PATH="/usr/bin/jbig2"
JBIG2_LOCAL_PATH="/usr/local/bin/jbig2"
JBIG2_ENV_PATH=$(which jbig2 2>/dev/null)

# Console colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Checking for jbig2 availability...${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if jbig2 is in workspace local build first
if [[ -x "$JBIG2_SOURCE_PATH" ]]; then
    echo -e "${GREEN}✓ jbig2 found in workspace at $JBIG2_SOURCE_PATH${NC}"
    echo -e "  Version: $($JBIG2_SOURCE_PATH --version | head -n 1)"
    echo -e "${GREEN}✓ Using local build for optimal compatibility${NC}"
    echo -e "${BLUE}========================================${NC}"
    exit 0
# Check if jbig2 is in any of the standard locations
elif [[ -x "$JBIG2_LOCAL_PATH" ]]; then
    echo -e "${GREEN}✓ jbig2 found at $JBIG2_LOCAL_PATH${NC}"
    echo -e "  Version: $($JBIG2_LOCAL_PATH --version 2>/dev/null | head -n 1 || echo 'Unknown')"
    echo -e "${BLUE}========================================${NC}"
    exit 0
elif [[ -x "$JBIG2_DEFAULT_PATH" ]]; then
    echo -e "${GREEN}✓ jbig2 found at $JBIG2_DEFAULT_PATH${NC}"
    echo -e "  Version: $($JBIG2_DEFAULT_PATH --version 2>/dev/null | head -n 1 || echo 'Unknown')"
    echo -e "${BLUE}========================================${NC}"
    exit 0
elif [[ -n "$JBIG2_ENV_PATH" ]]; then
    echo -e "${GREEN}✓ jbig2 found in PATH at $JBIG2_ENV_PATH${NC}"
    echo -e "  Version: $($JBIG2_ENV_PATH --version 2>/dev/null | head -n 1 || echo 'Unknown')"
    echo -e "${BLUE}========================================${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️ jbig2 not found in any location.${NC}"
    
    # Check if we can build it from source
    if [[ -d "$WORKSPACE_PATH/jbig2enc" ]]; then
        echo -e "${YELLOW}Found jbig2enc source in workspace. Building...${NC}"
        cd "$WORKSPACE_PATH/jbig2enc"
        
        # Try to build if source directory exists but binary doesn't
        if [[ -f "./autogen.sh" ]]; then
            echo -e "Running build process..."
            ./autogen.sh && ./configure && make
            
            if [[ -x "./src/jbig2" ]]; then
                echo -e "${GREEN}✓ Successfully built jbig2 at $JBIG2_SOURCE_PATH${NC}"
                echo -e "  Version: $(./src/jbig2 --version 2>/dev/null | head -n 1 || echo 'Unknown')"
                echo -e "${BLUE}========================================${NC}"
                exit 0
            else
                echo -e "${RED}✗ Build attempted but binary not created${NC}"
            fi
        fi
    fi
    
    echo -e "${YELLOW}   PDF optimization will be limited. To enable better optimization:${NC}"
    echo -e "${YELLOW}   - Install jbig2enc: sudo apt-get install jbig2enc${NC}"
    echo -e "${YELLOW}   - Or build from source: https://github.com/agl/jbig2enc${NC}"
    echo -e "${BLUE}========================================${NC}"
    exit 1
fi

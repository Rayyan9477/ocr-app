#!/bin/bash

echo "🔧 Setting up Python environment for OCR processing..."

# Ensure pip is available for the system Python
echo "Checking pip installation..."
if ! command -v pip3 &> /dev/null; then
    echo "Installing pip3..."
    sudo apt-get update && sudo apt-get install -y python3-pip
fi

# Install required packages
echo "Installing required Python packages..."
sudo apt-get update
sudo apt-get install -y \
    python3-pip \
    python3-pil \
    python3-numpy \
    python3-opencv \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils

# Create a local directory for additional packages
mkdir -p ~/.local/lib/python3.12/site-packages

# Install pdf2image using pip in user mode
pip3 install --user pdf2image

# Create necessary directories
mkdir -p models/nanovlm
mkdir -p python

# Verify installation
echo "Verifying Python environment..."
python3 -c "import sys; from PIL import Image; print('Python environment verified successfully!')"

# Create a simple test script
cat > python/test_env.py << EOL
from PIL import Image
import sys

print("Python version:", sys.version)
print("PIL version:", Image.__version__)
print("Environment test successful!")
EOL

# Run test script
echo "Running environment test..."
python3 python/test_env.py

echo "✅ Python environment setup complete!"

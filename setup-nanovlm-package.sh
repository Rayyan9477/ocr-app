#!/bin/bash

echo "🚀 Setting up nanovlm package..."

# Activate virtual environment
source nanovlm_env/bin/activate

# Create setup.py if it doesn't exist
cat > python/setup.py << EOL
from setuptools import setup, find_packages

setup(
    name="nanovlm",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "torch",
        "torchvision",
        "transformers",
        "Pillow",
        "fastapi",
        "uvicorn"
    ],
)
EOL

# Install package in development mode
cd python && pip install -e .

echo "✅ nanovlm package installed successfully!"

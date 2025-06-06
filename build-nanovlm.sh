#!/bin/bash

echo "🚀 Building nanoVLM integration..."

# Ensure Python environment
if [ ! -d "nanovlm_env" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv nanovlm_env
fi

# Activate virtual environment
source nanovlm_env/bin/activate

# Install/upgrade pip
echo "🔄 Upgrading pip..."
pip install --upgrade pip

# Install Python dependencies
echo "📥 Installing Python dependencies..."
pip install -r python/requirements.txt

# Install TypeScript dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📥 Installing Node.js dependencies..."
    npm install
fi

# Build TypeScript files
echo "🔨 Building TypeScript files..."
npm run build:ts

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p models/nanovlm
mkdir -p python/nanovlm

# Run Python tests
echo "🧪 Running Python tests..."
if [ -f "python/nanovlm/tests/test_processor.py" ]; then
    python -m pytest python/nanovlm/tests
else
    echo "⚠️  No Python tests found, skipping"
fi

# Run TypeScript tests
echo "🧪 Running TypeScript tests..."
npm run test:nanovlm

echo "✨ Build complete!"

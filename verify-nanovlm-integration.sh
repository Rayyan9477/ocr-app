#!/bin/bash

echo "🔍 Verifying nanoVLM integration..."

# Environment variables
PYTHON_MIN_VERSION="3.8"
MODEL_DIR="models/nanovlm"
PYTHON_MODULE_DIR="python/nanovlm"

# Check Python version
echo "Checking Python version..."
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
if [ "$(printf '%s\n' "$PYTHON_MIN_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$PYTHON_MIN_VERSION" ]; then
    echo "❌ Python $PYTHON_MIN_VERSION+ is required"
    exit 1
fi
echo "✅ Python $PYTHON_VERSION found"

# Check virtual environment
if [ ! -d "nanovlm_env" ]; then
    echo "❌ Virtual environment not found"
    exit 1
fi
echo "✅ Virtual environment found"

# Check model directory
if [ ! -d "$MODEL_DIR" ]; then
    echo "❌ Model directory not found"
    exit 1
fi
echo "✅ Model directory found"

# Check Python module
if [ ! -d "$PYTHON_MODULE_DIR" ]; then
    echo "❌ Python module not found"
    exit 1
fi
if [ ! -f "$PYTHON_MODULE_DIR/processor.py" ]; then
    echo "❌ NanoVLM processor not found"
    exit 1
fi
echo "✅ Python module found"

# Activate virtual environment
source nanovlm_env/bin/activate

# Check Python dependencies
echo "Checking Python dependencies..."
REQUIRED_PACKAGES=("pillow" "numpy" "torch" "transformers")
for package in "${REQUIRED_PACKAGES[@]}"; do
    if ! pip show "$package" &> /dev/null; then
        echo "❌ Required Python package not found: $package"
        exit 1
    fi
done
echo "✅ Python dependencies found"

# Run test files verification
echo "Checking test files..."
declare -A TEST_FILES=(
    ["test_handwritten.png"]="Handwritten test image"
    ["test_text.txt"]="Text test file"
    ["test_vlm_input.png"]="Standard test image"
)

for test_file in "${!TEST_FILES[@]}"; do
    if [ ! -f "$test_file" ]; then
        echo "⚠️  ${TEST_FILES[$test_file]} not found: $test_file"
    else
        echo "✅ ${TEST_FILES[$test_file]} found"
    fi
done

# Run basic OCR test
echo "Running basic OCR test..."
TEST_OUTPUT=$(npm run test:nanovlm 2>&1)
if [ $? -ne 0 ]; then
    echo "❌ Basic OCR test failed:"
    echo "$TEST_OUTPUT"
    exit 1
fi
echo "✅ Basic OCR test passed"

# Verify model files
echo "Verifying model files..."
MODEL_FILES=("config.json" "pytorch_model.bin" "tokenizer.json")
for file in "${MODEL_FILES[@]}"; do
    if [ ! -f "$MODEL_DIR/$file" ]; then
        echo "⚠️  Model file not found: $file (may be downloaded on first run)"
    else
        echo "✅ Model file found: $file"
    fi
done
    
    # Check model files
    find "$MODEL_DIR" -type f -name "*.bin" -o -name "*.json" | while read -r file; do
        echo "Found model file: $(basename "$file")"
    done
else
    echo "❌ Model directory not found"
    exit 1
fi

echo "=== Verification Complete ==="

#!/bin/bash

echo "🔧 Setting up NanoVLM OCR dependencies..."

# Check Python3 installation
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python3 first."
    exit 1
fi

# Install system dependencies
echo "Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv

# Create and activate virtual environment
echo "Creating Python virtual environment..."
python3 -m venv ./venv
source ./venv/bin/activate

# Install Python packages using pip
echo "Installing Python packages..."
pip3 install --no-cache-dir --upgrade pip
pip3 install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip3 install --no-cache-dir numpy pillow transformers tqdm

# Download NanoVLM model
MODEL_DIR="models/nanovlm-222m"
MODEL_URL="https://huggingface.co/lusxvr/nanoVLM-222M/resolve/main/model.safetensors"

echo "Downloading NanoVLM model..."
mkdir -p "$MODEL_DIR"
curl -L "$MODEL_URL" -o "$MODEL_DIR/model.safetensors"

# Create model config
cat > "$MODEL_DIR/config.json" << EOL
{
  "model_path": "model.safetensors",
  "max_batch_size": 16,
  "device": "cuda",
  "fallback_device": "cpu",
  "max_sequence_length": 1024,
  "image_size": 224
}
EOL
# Make processor script executable
echo "Setting up permissions..."
chmod +x /home/rayyan9477/ocr-app/python/processors/nanovlm_processor.py

# Create model directory
mkdir -p /home/rayyan9477/ocr-app/models/nanovlm-222m

echo "✅ NanoVLM setup completed successfully!"

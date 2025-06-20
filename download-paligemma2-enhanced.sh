#!/bin/bash

# Enhanced script to download PaliGemma2 model files
# This script handles getting model files from alternative source

set -e

MODEL_ID="NSTiwari/paligemma2-3b-mix-224-onnx"
CACHE_DIR="./models/paligemma2"
ALTERNATIVE_SOURCE="https://huggingface.co/NSTiwari/paligemma2-3b-mix-224-onnx/resolve/onnx"

echo "🚀 Enhanced PaliGemma2 model downloader"
echo "Model ID: $MODEL_ID"
echo "Cache directory: $CACHE_DIR"

# Create cache directory if it doesn't exist
mkdir -p "$CACHE_DIR"

# Function to download a file with progress bar
download_file() {
  local url="$1"
  local output="$2"
  
  echo "Downloading: $url"
  echo "To: $output"
  
  if which curl >/dev/null 2>&1; then
    curl -L --progress-bar "$url" -o "$output"
  elif which wget >/dev/null 2>&1; then
    wget -O "$output" "$url" --show-progress
  else
    echo "❌ Error: Neither curl nor wget is installed"
    exit 1
  fi
}

# Download essential files (more direct approach)
echo "📦 Downloading model files from alternative source..."

# Create necessary directories
mkdir -p "$CACHE_DIR/feature_extractor"
mkdir -p "$CACHE_DIR/tokenizer"
mkdir -p "$CACHE_DIR/preprocessor"

# Download preprocessor files
echo "📥 Downloading preprocessor files..."
FILES=(
  "preprocessor_config.json"
  "tokenizer_config.json"
  "processor_config.json"
  "feature_extractor/preprocessor_config.json"
  "tokenizer/tokenizer.json"
  "vocab.json"
  "special_tokens_map.json"
)

for file in "${FILES[@]}"; do
  mkdir -p "$(dirname "$CACHE_DIR/$file")"
  download_file "$ALTERNATIVE_SOURCE/$file" "$CACHE_DIR/$file" || true
done

# Try to download ONNX models
echo "📥 Downloading model files..."
MODELS=(
  "model.onnx"
  "decoder_model_merged_quantized.onnx"
  "vision_encoder_quantized.onnx"
)

for model in "${MODELS[@]}"; do
  download_file "$ALTERNATIVE_SOURCE/$model" "$CACHE_DIR/$model" || true
done

echo "✅ Model download attempt completed"
echo "Some files may still be downloaded at runtime if needed"
echo ""
echo "To use the model, run your application normally and the model will be used from the cache directory"

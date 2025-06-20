#!/bin/bash

# Comprehensive PaliGemma2 Model Downloader
# This script downloads PaliGemma2 model files from the specified Google source

set -e  # Exit on errors

# Define model identifiers and directories
GOOGLE_MODEL_ID="google/paligemma2-3b-pt-224"

# Define target directories
BASE_DIR="./models/paligemma2"
GOOGLE_DIR="${BASE_DIR}/google"

# Clean up previous versions
echo "🧹 Deleting previous model versions..."
rm -rf "${BASE_DIR}"
echo "✅ Previous versions deleted."

# Create directories
mkdir -p "${GOOGLE_DIR}"

echo "🚀 PaliGemma2 Comprehensive Model Downloader"
echo "============================================"
echo "This script will attempt to download PaliGemma2 model files from google/paligemma2-3b-pt-224"
echo

# Function to download a file with progress
download_file() {
    local url="$1"
    local output_path="$2"
    local description="$3"
    
    echo "📥 Downloading ${description}..."
    echo "  From: ${url}"
    echo "  To: ${output_path}"
    
    # Create directory if it doesn't exist
    mkdir -p "$(dirname "${output_path}")"
    
    if command -v curl &> /dev/null; then
        curl -L --progress-bar "${url}" -o "${output_path}" || return 1
    elif command -v wget &> /dev/null; then
        wget --show-progress -q "${url}" -O "${output_path}" || return 1
    else
        echo "❌ Error: Neither curl nor wget is available. Please install one of them."
        exit 1
    fi
    
    echo "✅ Download complete: ${description}"
    return 0
}

# Function to handle alternative URL if primary fails
try_download() {
    local primary_url="$1"
    local output_path="$2"
    local description="$3"
    
    if download_file "${primary_url}" "${output_path}" "${description}"; then
        return 0
    else
        echo "❌ Download failed for ${description}"
        return 1
    fi
}

echo "Step 1: Downloading model files"
echo "---------------------------------------------------"

# Configuration and model files
MODEL_FILES=(
    "config.json"
    "preprocessor_config.json"
    "tokenizer_config.json"
    "generation_config.json"
    "special_tokens_map.json"
    "tokenizer.json"
    "model-00001-of-00002.safetensors"
    "model-00002-of-00002.safetensors"
    "model.safetensors.index.json"
)

for file in "${MODEL_FILES[@]}"; do
    try_download \
        "https://huggingface.co/${GOOGLE_MODEL_ID}/resolve/main/${file}" \
        "${GOOGLE_DIR}/${file}" \
        "${file}"
done

echo
echo "✅ Download process completed"
echo "---------------------------"
echo "Model files have been downloaded to: ${GOOGLE_DIR}"
echo "Files in the directory:"
ls -l "${GOOGLE_DIR}"
echo "Note: These might require accepting the license on Hugging Face first"
echo
echo "To use the model, update your application to use the models from: ${GOOGLE_DIR}"

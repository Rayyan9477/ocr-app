#!/bin/bash

# Smart OCR with text enhancement
# Usage: ./run-smart-ocr.sh <input-file>

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <input-file>"
    exit 1
fi

# Run Smart OCR
node run-smart-ocr-with-vlm.js "$1"

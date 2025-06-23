#!/bin/bash

# PaliGemma2 Compatibility Check Script
# This script checks if the current transformers.js version supports PaliGemma2

echo "🚀 Running PaliGemma2 compatibility checker..."
node check-paligemma2-compatibility.js

# Check if the compatibility check succeeded
if [ $? -eq 0 ]; then
  echo "✅ Compatibility check completed successfully"
  
  # Check if we're in processor-only mode
  if grep -q "processorOnlyMode\": true" paligemma2-compatibility.json; then
    echo "⚠️ NOTICE: PaliGemma2 is running in processor-only mode"
    echo "📝 See PALIGEMMA2-PROCESSOR-ONLY-MODE.md for more information and workarounds"
  fi
else
  echo "❌ Compatibility check failed"
  exit 1
fi

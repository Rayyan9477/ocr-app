#!/bin/bash

echo "🔧 Setting up worker script directory..."

# Create necessary directories
mkdir -p .next/worker-script/node

# Check if the worker-script directory exists
if [ ! -d ".next/worker-script/node" ]; then
  echo "❌ Failed to create worker-script directory"
  exit 1
fi

# Create a simple index.js if it doesn't exist
if [ ! -f ".next/worker-script/node/index.js" ]; then
  cat > .next/worker-script/node/index.js << 'EOF'
/**
 * Tesseract.js Worker Script Loader
 * This script helps avoid errors when loading the Tesseract.js worker in a Next.js environment
 */

// Re-export the worker from the node_modules location
try {
  const workerPath = require.resolve('tesseract.js/dist/worker.min.js');
  module.exports = require(workerPath);
} catch (error) {
  console.warn('Tesseract.js worker not found:', error.message);
  // Provide a minimal mock to avoid crashes
  module.exports = {
    loadLanguage: async () => Promise.resolve(),
    initialize: async () => Promise.resolve(),
    recognize: async () => Promise.resolve({ data: { text: '' }}),
    terminate: async () => Promise.resolve()
  };
}
EOF
  echo "✅ Created worker script index.js"
else
  echo "✅ Worker script index.js already exists"
fi

# Ensure proper permissions
chmod 755 .next/worker-script/node/index.js

echo "✅ Worker script directory setup complete"

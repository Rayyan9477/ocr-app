#!/bin/bash
# Test script to validate deployment

echo "=== Deployment Validation Test ==="

# Check if Node.js is available
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Check if required files exist
echo "Checking required files..."
files=("server.js" "package.json" "next.config.mjs" ".next/server.js")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file exists"
    else
        echo "✗ $file missing"
    fi
done

# Check if required directories exist
echo "Checking required directories..."
dirs=("uploads" "processed" "output" "tmp" "logs")
for dir in "${dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "✓ $dir directory exists"
    else
        echo "Creating $dir directory..."
        mkdir -p "$dir"
        echo "✓ $dir directory created"
    fi
done

# Test if the application starts
echo "Testing application startup..."
timeout 30s node server.js &
PID=$!
sleep 10

if kill -0 $PID 2>/dev/null; then
    echo "✓ Application started successfully"
    kill $PID
    exit 0
else
    echo "✗ Application failed to start"
    exit 1
fi

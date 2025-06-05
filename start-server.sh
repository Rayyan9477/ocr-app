#!/bin/bash

echo "Starting OCR server..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build the project
echo "Building project..."
npm run build

# Start the server
echo "Starting server..."
npm run start

#!/bin/bash
# Azure Web App startup script

echo "=== Azure Web App Startup ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Environment: $NODE_ENV"
echo "Port: $PORT"

# Set default environment variables if not set
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-8080}
export WEBSITES_PORT=${PORT}

echo "Starting application on port $PORT"

# Start the Node.js application
exec node server.js

#!/bin/bash
# Azure App Service startup script

# Set environment variables
export NODE_ENV=production
export PORT=${PORT:-8080}

# Start the application
node server.js

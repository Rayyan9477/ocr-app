#!/bin/bash
# Quick installation script for OCR application

set -e

# Print colored text
print_green() {
  echo -e "\033[0;32m$1\033[0m"
}

print_yellow() {
  echo -e "\033[0;33m$1\033[0m"
}

print_red() {
  echo -e "\033[0;31m$1\033[0m"
}

print_green "OCR Application Quick Installer"
print_green "=============================="
echo

# Check for Docker
if ! command -v docker &>/dev/null; then
  print_red "Error: Docker is not installed"
  echo "Please install Docker first: https://docs.docker.com/get-docker/"
  exit 1
fi

# Check for required ports
DEFAULT_PORT=3000
PORT=${PORT:-$DEFAULT_PORT}

# Check if port is in use
check_port() {
  if command -v lsof &>/dev/null; then
    lsof -Pi :"$1" -sTCP:LISTEN -t &>/dev/null
    return $?
  elif command -v netstat &>/dev/null; then
    netstat -tuln | grep ":$1 " &>/dev/null
    return $?
  else
    # Can't check, assume it's available
    return 1
  fi
}

if check_port "$PORT"; then
  print_yellow "Warning: Port $PORT is already in use."
  print_yellow "Trying port 3001 instead..."
  PORT=3001
  
  if check_port "$PORT"; then
    print_yellow "Warning: Port $PORT is also in use."
    read -p "Please specify an available port number: " PORT
  fi
fi

# Create directories
print_green "Creating necessary directories..."
mkdir -p uploads processed

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  print_green "Creating .env file with default settings..."
  if [ -f .env.example ]; then
    cp .env.example .env
  else
    cat >.env <<EOF
# OCR Application Configuration
APP_VERSION=1.0.0
PORT=$PORT
NODE_ENV=production
MAX_UPLOAD_SIZE=100
NODE_MEMORY=4096
CONTAINER_MEMORY=4G
CONTAINER_MEMORY_RESERVATION=2G
CONTAINER_CPUS=2
UPLOADS_DIR=./uploads
PROCESSED_DIR=./processed
DEFAULT_LANGUAGE=eng
ENABLE_OPTIMIZATION=true
TARGETARCH=$(uname -m | sed 's/x86_64/amd64/' | sed 's/aarch64/arm64/')
CONTAINER_USER=node
DEBUG=false
EOF
  fi
  
  # Update PORT in the .env file
  sed -i.bak "s/^PORT=.*/PORT=$PORT/" .env
  rm -f .env.bak
fi

# Check if the app is already running
if docker ps | grep -q "ocr-app"; then
  print_yellow "OCR Application is already running."
  read -p "Do you want to restart it? (y/n): " restart
  if [ "$restart" = "y" ] || [ "$restart" = "Y" ]; then
    print_green "Restarting OCR Application..."
    docker-compose down
    docker-compose up -d
  fi
else
  # Start the application
  print_green "Starting OCR Application..."
  docker-compose up -d
fi

# Print success message
print_green "\nOCR Application is now running!"
print_green "Access it at: http://localhost:$PORT"
print_green "\nUseful commands:"
echo "  docker-compose logs -f    # View logs"
echo "  docker-compose down       # Stop the application"
echo "  docker-compose restart    # Restart the application"
echo "  ./run.sh --help           # Show additional options"

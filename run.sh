#!/usr/bin/env bash

# Helper script to build and run the OCR application with different configurations

set -e

# Functions
show_help() {
  echo "OCR Application Build & Run Script"
  echo ""
  echo "Usage: ./run.sh [OPTIONS] COMMAND"
  echo ""
  echo "Commands:"
  echo "  build        Build the Docker image"
  echo "  run          Run the application"
  echo "  up           Build and run (shorthand for build + run)"
  echo "  down         Stop the application"
  echo "  restart      Restart the application"
  echo "  logs         Show application logs"
  echo ""
  echo "Options:"
  echo "  -a, --arch   Target architecture (amd64 or arm64, default: current system arch)"
  echo "  -p, --port   Port to expose (default: 3000)"
  echo "  -h, --help   Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./run.sh build            # Build for current architecture"
  echo "  ./run.sh --arch arm64 up  # Build and run for ARM64"
  echo "  ./run.sh --port 8080 run  # Run on port 8080"
  echo ""
}

# Default values
ARCH=$(uname -m | sed 's/x86_64/amd64/' | sed 's/aarch64/arm64/')
PORT=3000

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--arch)
      ARCH="$2"
      shift 2
      ;;
    -p|--port)
      PORT="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    build|run|up|down|restart|logs)
      COMMAND="$1"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Convert architecture format if needed
if [[ "$ARCH" == "x86_64" ]]; then
  ARCH="amd64"
elif [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64v8" ]]; then
  ARCH="arm64"
fi

# Validate architecture
if [[ "$ARCH" != "amd64" && "$ARCH" != "arm64" ]]; then
  echo "Error: Unsupported architecture: $ARCH"
  echo "Supported architectures are: amd64, arm64"
  exit 1
fi

# Ensure command is provided
if [[ -z "$COMMAND" ]]; then
  echo "Error: No command specified"
  show_help
  exit 1
fi

# Create .env file if it doesn't exist
if [[ ! -f .env ]]; then
  echo "Creating default .env file..."
  cp .env.example .env
fi

# Update .env file with chosen architecture and port
sed -i.bak "s/^PORT=.*/PORT=$PORT/" .env
sed -i.bak "s/^TARGETARCH=.*/TARGETARCH=$ARCH/" .env
rm -f .env.bak

echo "Configuration:"
echo "- Architecture: $ARCH"
echo "- Port: $PORT"

# Execute command
case "$COMMAND" in
  build)
    echo "Building Docker image for $ARCH architecture..."
    TARGETARCH=$ARCH docker-compose build
    ;;
  run)
    echo "Running application on port $PORT..."
    PORT=$PORT TARGETARCH=$ARCH docker-compose up -d
    echo "Application is running at http://localhost:$PORT"
    ;;
  up)
    echo "Building and running application for $ARCH architecture on port $PORT..."
    PORT=$PORT TARGETARCH=$ARCH docker-compose up -d --build
    echo "Application is running at http://localhost:$PORT"
    ;;
  down)
    echo "Stopping application..."
    docker-compose down
    ;;
  restart)
    echo "Restarting application..."
    docker-compose restart
    ;;
  logs)
    echo "Showing application logs (Ctrl+C to exit)..."
    docker-compose logs -f
    ;;
esac

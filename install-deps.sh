#!/bin/bash
# Script to install required OCR dependencies

echo "=== OCR Dependencies Installation ==="
echo "This script will install required dependencies for the OCR application"

# Check if running with sudo/root permissions
if [ "$(id -u)" -ne 0 ]; then
  echo "This script needs to be run with sudo. Please run: sudo bash install-deps.sh"
  exit 1
fi

# Function to detect OS
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
  elif type lsb_release >/dev/null 2>&1; then
    OS=$(lsb_release -si)
  elif [ -f /etc/lsb-release ]; then
    . /etc/lsb-release
    OS=$DISTRIB_ID
  else
    OS=$(uname -s)
  fi
  echo $OS
}

OS=$(detect_os)
echo "Detected OS: $OS"

# Install dependencies based on OS
case "$OS" in
  *Ubuntu*|*Debian*)
    echo "Installing dependencies for Debian/Ubuntu..."
    apt-get update
    apt-get install -y tesseract-ocr poppler-utils wkhtmltopdf imagemagick pdftk
    ;;
  *Fedora*|*Red\ Hat*|*CentOS*)
    echo "Installing dependencies for Fedora/RHEL/CentOS..."
    dnf install -y tesseract poppler-utils wkhtmltopdf ImageMagick pdftk
    ;;
  *Arch*)
    echo "Installing dependencies for Arch Linux..."
    pacman -Sy tesseract poppler wkhtmltopdf imagemagick pdftk
    ;;
  *Alpine*)
    echo "Installing dependencies for Alpine Linux..."
    apk add tesseract-ocr poppler-utils wkhtmltopdf imagemagick pdftk
    ;;
  *)
    echo "Unsupported OS: $OS. Please install the following packages manually:"
    echo "- tesseract-ocr: OCR engine"
    echo "- poppler-utils: PDF utilities"
    echo "- wkhtmltopdf: HTML to PDF conversion"
    echo "- imagemagick: Image processing"
    echo "- pdftk: PDF toolkit"
    ;;
esac

# Check if installations were successful
echo "Checking installed components..."

check_tool() {
  if command -v $1 >/dev/null 2>&1; then
    echo "✅ $1 is installed"
    return 0
  else
    echo "❌ $1 is NOT installed"
    return 1
  fi
}

check_tool tesseract
check_tool pdftotext
check_tool wkhtmltopdf
check_tool convert
check_tool pdftk

# Create fallback options directory
mkdir -p /home/rayyan9477/ocr/ocr-app/lib/fallbacks

echo "Installation complete!"
echo "Run 'npm run build' to rebuild your application"

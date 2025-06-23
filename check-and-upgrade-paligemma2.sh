#!/bin/bash

# PaliGemma2 Compatibility and Upgrade Script
# This script checks for PaliGemma2 compatibility with transformers.js
# and offers to upgrade if a new version is available

echo "🚀 PaliGemma2 Compatibility and Upgrade Script"
echo "=============================================="
echo ""

# Function to check compatibility
check_compatibility() {
  echo "🔍 Checking PaliGemma2 compatibility with transformers.js..."
  
  # Run the compatibility checker script directly
  node check-paligemma2-compatibility.js
  
  if [ ! -f "paligemma2-compatibility.json" ]; then
    echo "❌ Error: Compatibility check failed to create status file."
    exit 1
  fi
  
  # Extract values from JSON (using grep and cut for simplicity)
  PROCESSOR_ONLY=$(grep "processorOnlyMode" paligemma2-compatibility.json | grep -o "true\|false")
  INSTALLED_VERSION=$(grep "version" paligemma2-compatibility.json | head -1 | cut -d'"' -f4)
  COMPATIBLE=$(grep "modelCompatible" paligemma2-compatibility.json | grep -o "true\|false")
  
  echo
  echo "📊 Current Status:"
  echo "• Current transformers.js version: $INSTALLED_VERSION"
  echo "• PaliGemma2 model compatibility: $COMPATIBLE"
  echo "• Running in processor-only mode: $PROCESSOR_ONLY"
  
  # Also try the API method if server is running
  echo ""
  echo "🔄 Checking with API (if server is running)..."
  result=$(curl -s http://localhost:3000/api/paligemma2-compatibility 2>/dev/null)
  
  if [ $? -eq 0 ] && [ ! -z "$result" ]; then
    # Extract status from JSON result
    is_compatible=$(echo $result | grep -o '"isCompatible":true' | wc -l)
    processor_only=$(echo $result | grep -o '"processorOnlyMode":true' | wc -l)
    installed_version=$(echo $result | grep -o '"installedVersion":"[^"]*"' | cut -d'"' -f4)
    latest_version=$(echo $result | grep -o '"latestVersion":"[^"]*"' | cut -d'"' -f4)
    upgrade_available=$(echo $result | grep -o '"availableUpgrade":true' | wc -l)
    
    echo "📊 API Compatibility Results:"
    echo "-------------------------"
    echo "Installed version: $installed_version"
    echo "Latest version: $latest_version"
    
    if [ $is_compatible -eq 1 ]; then
      echo "✅ Compatible: Yes"
    else
      echo "❌ Compatible: No"
    fi
    
    if [ $processor_only -eq 1 ]; then
      echo "⚠️ Mode: Processor-only"
    else
      echo "✅ Mode: Full model"
    fi
    
    if [ $upgrade_available -eq 1 ]; then
      echo "📦 Upgrade available: Yes"
      echo ""
      echo "Would you like to upgrade transformers.js to version $latest_version? (y/n)"
      read answer
      
      if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
        upgrade_transformers
      else
        echo "Upgrade skipped."
      fi
    else
      echo "📦 Upgrade available: No"
    fi
  else
    # Fall back to npm check if server is not running
    echo "ℹ️ Server not running, checking npm directly..."
    check_npm_upgrade
  fi
}

# Function to check for upgrades via npm
check_npm_upgrade() {
  # Check NPM for latest version
  LATEST_VERSION=$(npm view @huggingface/transformers version)
  
  if [ "$LATEST_VERSION" != "$INSTALLED_VERSION" ]; then
    echo "• Latest available version: $LATEST_VERSION"
    echo "• A newer version is available!"
    
    read -p "Would you like to upgrade to the latest version? (y/n) " UPGRADE
    
    if [[ $UPGRADE =~ ^[Yy]$ ]]; then
      echo
      echo "📦 Upgrading transformers.js to version $LATEST_VERSION..."
      npm install @huggingface/transformers@latest
      
      # Check if we need to restart the server
      read -p "Would you like to restart the server to apply changes? (y/n) " RESTART
      
      if [[ $RESTART =~ ^[Yy]$ ]]; then
        restart_server
      else
        echo "ℹ️ Remember to restart the server to apply changes."
      fi
      
      # Run compatibility check again
      echo
      echo "🔍 Checking compatibility with new version..."
      node check-paligemma2-compatibility.js
    fi
  else
    echo "• You already have the latest version."
    echo "• PaliGemma2 model support may be added in a future release."
  fi
}

# Function to upgrade transformers.js
upgrade_transformers() {
  echo "📦 Upgrading transformers.js..."
  
  # Try API method first
  if [ ! -z "$result" ]; then
    # Make API call to upgrade transformers.js
    result=$(curl -s -X POST http://localhost:3000/api/paligemma2-compatibility)
    
    # Extract status from JSON result
    success=$(echo $result | grep -o '"success":true' | wc -l)
    
    if [ $success -eq 1 ]; then
      echo "✅ Upgrade successful!"
      echo ""
      echo "You need to restart the server for the changes to take effect."
      echo "Would you like to restart the server now? (y/n)"
      read answer
      
      if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
        restart_server
      else
        echo "Server restart skipped. Don't forget to restart the server manually."
      fi
      return 0
    else
      echo "⚠️ API upgrade failed, trying npm directly..."
    fi
  fi
  
  # Fall back to npm install if API method fails
  echo "Installing latest transformers.js via npm..."
  npm install @huggingface/transformers@latest
  
  if [ $? -eq 0 ]; then
    echo "✅ Upgrade successful!"
    echo ""
    echo "You need to restart the server for the changes to take effect."
    echo "Would you like to restart the server now? (y/n)"
    read answer
    
    if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
      restart_server
    else
      echo "Server restart skipped. Don't forget to restart the server manually."
    fi
  else
    echo "❌ Upgrade failed."
    echo "Please try again or upgrade manually with 'npm install @huggingface/transformers@latest'."
  fi
}

# Function to restart the server
restart_server() {
  echo "🔄 Restarting server..."
  
  # First, try using the restart script if it exists
  if [ -f "restart-server.sh" ]; then
    echo "Using restart-server.sh script..."
    chmod +x restart-server.sh
    ./restart-server.sh
    return
  fi
  
  # Otherwise, try to restart manually
  # Kill the current server process
  pkill -f "next dev" || true
  pkill -f "next start" || true
  
  # Detect development or production mode based on available files
  if [ -f ".next/BUILD_ID" ]; then
    # Production mode
    echo "Starting server in production mode..."
    npm run start &
  else
    # Development mode
    echo "Starting server in development mode..."
    npm run dev &
  fi
  
  echo "✅ Server restart initiated."
  echo "Please wait a few moments for the server to initialize."
}

# Check if server is running
check_server() {
  echo "🔍 Checking if server is running..."
  
  curl -s http://localhost:3000 > /dev/null
  
  if [ $? -eq 0 ]; then
    echo "✅ Server is running."
    return 0
  else
    echo "⚠️ Server is not running."
    return 1
  fi
}

# Main script execution
if [ "$1" = "--check" ]; then
  # Just check compatibility, don't offer upgrades
  node check-paligemma2-compatibility.js
elif [ "$1" = "--upgrade" ]; then
  # Directly upgrade without checking
  npm install @huggingface/transformers@latest
  echo "✅ Upgrade completed."
  echo "Please restart the server for changes to take effect."
elif [ "$1" = "--help" ]; then
  echo "Usage:"
  echo "  ./check-and-upgrade-paligemma2.sh             - Check compatibility and offer upgrades"
  echo "  ./check-and-upgrade-paligemma2.sh --check     - Just check compatibility"
  echo "  ./check-and-upgrade-paligemma2.sh --upgrade   - Directly upgrade transformers.js"
  echo "  ./check-and-upgrade-paligemma2.sh --help      - Show this help message"
else
  # Run the full check
  check_compatibility
fi

echo ""
echo "📝 For more information about processor-only mode, see PALIGEMMA2-PROCESSOR-ONLY-MODE.md"
echo ""
if ! curl -s http://localhost:3000 > /dev/null; then
  echo "❌ Server is not running."
  echo "Please start the server first with 'npm run dev'."
  exit 1
fi

# Main menu
echo "Select an option:"
echo "1. Check PaliGemma2 compatibility"
echo "2. Upgrade transformers.js"
echo "3. Restart server"
echo "4. Exit"

read option

case $option in
  1)
    check_compatibility
    ;;
  2)
    upgrade_transformers
    ;;
  3)
    restart_server
    ;;
  4)
    echo "Exiting..."
    exit 0
    ;;
  *)
    echo "Invalid option."
    ;;
esac

echo ""
echo "Done!"

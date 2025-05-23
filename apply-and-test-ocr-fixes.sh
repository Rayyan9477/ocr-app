#!/bin/bash
# apply-and-test-ocr-fixes.sh - Script to apply OCR fixes and test the endpoint

echo "======================================"
echo "OCR API Fixes Application & Test Script"
echo "======================================"

# Step 1: Check if the server is running and stop it if needed
echo "Checking if Next.js server is running..."
PID=$(pgrep -f "next dev" | head -n 1)
#!/bin/bash
# apply-and-test-ocr-fixes.sh - Script to apply OCR fixes and test the endpoint

echo "======================================"
echo "OCR API Fixes Application & Test Script"
echo "======================================"

# Step 1: Check if the server is running and stop it if needed
echo "Checking if Next.js server is running..."
PID=$(lsof -t -i:3000 2>/dev/null || pgrep -f "next dev" | head -n 1)
if [ -n "$PID" ]; then
  echo "Stopping existing Next.js server (PID: $PID)..."
  kill -15 $PID
  sleep 2
  
  # Check if process is still running and force kill if needed
  if ps -p $PID > /dev/null; then
    echo "Force stopping Next.js server..."
    kill -9 $PID
    sleep 1
  fi
fi

# Step 2: Ensure the OCR service is properly installed
echo "Checking OCR dependencies..."
if ! command -v ocrmypdf &> /dev/null; then
  echo "⚠️ OCRmyPDF not found. Some tests may fail."
else
  echo "✅ OCRmyPDF is installed."
fi

# Step 3: Ensure directories exist with proper permissions
echo "Creating necessary directories with proper permissions..."
mkdir -p ./uploads ./processed ./tmp ./logs
chmod -R 777 ./uploads ./processed ./tmp ./logs

echo "✅ Directories created and permissions set"

# Step 4: Apply fixes from our work
echo "Applying OCR API fixes..."
if [ -f "./fix-syntax-errors.sh" ]; then
  chmod +x ./fix-syntax-errors.sh
  ./fix-syntax-errors.sh
  echo "✅ Applied syntax fixes"
fi

if [ -f "./fix-ocr-fallback.sh" ]; then
  chmod +x ./fix-ocr-fallback.sh
  ./fix-ocr-fallback.sh
  echo "✅ Applied OCR fallback fixes"
fi

# Step 5: Start the Next.js server in the background
echo "Starting Next.js server in development mode..."
npm run dev > ./logs/server.log 2>&1 &
SERVER_PID=$!

echo "Server starting with PID: $SERVER_PID"
echo "Waiting for server to start up (this may take a minute)..."

# Wait for the server to start
sleep 15

# Step 6: Test if the server is running
echo "Checking if server is running properly..."
curl -s http://localhost:3000 > /dev/null
if [ $? -ne 0 ]; then
  echo "❌ Server failed to start properly"
  echo "Check logs at ./logs/server.log for details"
  exit 1
fi

echo "✅ Next.js server is running"

# Step 7: Run the OCR API test
echo "Testing OCR API endpoint..."
if [ -f "./test-ocr-api-endpoint.sh" ]; then
  chmod +x ./test-ocr-api-endpoint.sh
  ./test-ocr-api-endpoint.sh
else
  echo "❌ Test script not found"
  exit 1
fi

echo ""
echo "======================================"
echo "Test script complete!"
echo "Next.js server continues running with PID: $SERVER_PID"
echo "To stop the server: kill -15 $SERVER_PID"
echo "======================================"

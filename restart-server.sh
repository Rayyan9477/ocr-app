#!/bin/bash
# Script to restart the Next.js server

echo "Restarting Next.js server..."

# Find the Node.js process running the Next.js server
NEXT_PID=$(ps aux | grep "next" | grep -v grep | awk '{print $2}')

if [ -n "$NEXT_PID" ]; then
  echo "Found Next.js process with PID: $NEXT_PID"
  echo "Stopping Next.js server..."
  kill -15 $NEXT_PID
  
  # Wait for the process to terminate
  sleep 2
  
  # Check if it's still running and force kill if necessary
  if ps -p $NEXT_PID > /dev/null; then
    echo "Process still running, force killing..."
    kill -9 $NEXT_PID
    sleep 1
  fi
  
  echo "Process stopped."
else
  echo "Next.js process not found."
fi

# Change to the application directory
cd /home/rayyan9477/ocr-app

# Restart the Next.js server
echo "Starting Next.js server..."
npm run dev > server.log 2>&1 &

echo "Next.js server restarted. Use 'tail -f server.log' to view logs."
echo "Done!"

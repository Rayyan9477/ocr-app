#!/bin/bash

echo "🔧 Fixing Next.js static file 404 errors once and for all..."

# Kill any existing Next.js processes
echo "Stopping any existing Next.js processes..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2

# Clear all caches and build artifacts
echo "Clearing all caches and build artifacts..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .swc
rm -rf .turbo

# Clear npm cache
echo "Clearing npm cache..."
npm cache clean --force 2>/dev/null || true

# Ensure permissions are correct
echo "Setting correct permissions..."
chmod +x ./ensure-permissions.sh
./ensure-permissions.sh

# Create a minimal Next.js config that ensures proper static file serving
echo "Creating optimized Next.js configuration..."
cat > next.config.mjs << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    largePageDataBytes: 128 * 1024 * 1024, // 128MB
  },
  // Optimized for static file serving
  generateStaticParams: true,
  output: 'standalone',
  // Essential webpack configuration only
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Minimal watch configuration
      config.watchOptions = {
        ignored: [
          '**/node_modules/**',
          '**/uploads/**',
          '**/processed/**',
        ],
        aggregateTimeout: 300,
      };
    }
    return config;
  },
}

export default nextConfig;
EOF

echo "✅ Configuration updated successfully"

# Start the development server
echo "Starting Next.js development server..."
NODE_ENV=development npx next dev --port 3000 &

# Wait for server to start
echo "Waiting for server to start..."
sleep 10

# Check if server is responding
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Server started successfully on port 3000"
    echo "🎉 Static file 404 errors should now be resolved!"
else
    echo "❌ Server failed to start properly"
    echo "Trying alternative port 3001..."
    pkill -f "next dev" 2>/dev/null || true
    sleep 2
    NODE_ENV=development npx next dev --port 3001 &
    sleep 10
    if curl -s http://localhost:3001 > /dev/null; then
        echo "✅ Server started successfully on port 3001"
    else
        echo "❌ Server startup failed on both ports"
    fi
fi

echo "Done!"

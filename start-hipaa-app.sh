#!/bin/bash

# HIPAA-Compliant OCR Application Test Script

echo "🛡️  Starting HIPAA-Compliant OCR Application"
echo "================================================"

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  Creating .env.local from example..."
    cp .env.example .env.local
    echo "✅ Please update .env.local with secure encryption keys!"
fi

# Create required directories
echo "📁 Creating secure directories..."
mkdir -p secure_uploads
mkdir -p audit_logs
chmod 700 secure_uploads audit_logs

# Check dependencies
echo "📦 Checking dependencies..."
if ! npm list bcryptjs jsonwebtoken archiver react-dropzone &> /dev/null; then
    echo "⚠️  Installing missing dependencies..."
    npm install bcryptjs jsonwebtoken archiver react-dropzone @types/jsonwebtoken
fi

# Check if development server is running
if lsof -i:3000 &> /dev/null; then
    echo "⚠️  Port 3000 is already in use. Stopping existing process..."
    pkill -f "next dev" || true
    sleep 2
fi

echo ""
echo "🚀 Starting development server..."
echo ""
echo "HIPAA-Compliant Features Available:"
echo "✅ User Authentication & Authorization"
echo "✅ End-to-end File Encryption"
echo "✅ Comprehensive Audit Logging" 
echo "✅ Role-based Access Control"
echo "✅ Automatic File Cleanup"
echo "✅ Secure OCR Processing"
echo ""
echo "Access the HIPAA interface at: http://localhost:3000/hipaa"
echo ""
echo "Default test credentials:"
echo "Email: admin@test.com"
echo "Password: SecurePass123"
echo "Role: admin"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the development server
npm run dev

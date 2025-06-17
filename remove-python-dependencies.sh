#!/bin/bash

# Script to remove Python dependencies from the OCR application
# as part of the migration to pure TypeScript/JavaScript

echo "Starting Python dependency removal..."

# 1. Remove Python files
echo "Removing Python files..."
rm -rf python/
rm -rf docker/nanovlm/
rm -rf docker/kraken/
rm -rf docker/paddleocr/

# 2. Remove Python test files
echo "Removing Python test files..."
rm -f test_nanovlm.py
rm -f create_test_pdf.py
rm -f create_3page_test.py

# 3. Remove Python-related scripts
echo "Removing Python-related scripts..."
rm -f fix-python-env.sh
rm -f process_with_nanovlm.py
rm -f test_env.py

# 4. Clean any Python cache directories
echo "Cleaning Python cache directories..."
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -type d -name "*.egg-info" -exec rm -rf {} +
find . -type d -name ".pytest_cache" -exec rm -rf {} +

# 5. Remove requirements.txt file if it exists
echo "Removing Python requirements file..."
rm -f requirements.txt

echo "Python dependency removal complete!"
echo "The application has been migrated to pure TypeScript/JavaScript."
echo "Next steps:"
echo "1. Run 'npm install' to install new JS dependencies"
echo "2. Run 'npm run build' to build the application"
echo "3. Run 'npm run dev' to start the development server"

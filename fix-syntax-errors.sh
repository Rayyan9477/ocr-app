#!/bin/bash
# fix-syntax-errors.sh - Script to fix syntax errors in route.ts file

# Working on a temp file to avoid syntax errors during editing
cat /home/rayyan9477/ocr-app/app/api/ocr/route.ts > /tmp/route.ts.tmp

# Add semicolon after catch block for proper syntax
sed -i '/\} catch (ocrProcessError) {/s/ocrProcessError/ocrProcessError;/' /tmp/route.ts.tmp

# Fix the buildOCRCommand function declaration syntax
sed -i 's/async function buildOCRCommand({/const buildOCRCommand = async ({/' /tmp/route.ts.tmp

# Move all export functions to a separate export block to avoid module scope issues
# First, create a temp file with export functions removed
grep -v "^export async function" /tmp/route.ts.tmp > /tmp/route.ts.no-exports

# Capture the export functions to add at the end
grep "^export async function" /tmp/route.ts.tmp > /tmp/route.ts.exports

# Append proper export statement with the functions
cat << 'EOF' >> /tmp/route.ts.no-exports

// Export HTTP methods
export {
EOF

# Add the function names to the export statement
sed -s 's/export async function \([A-Z]*\)().*/  \1,/' /tmp/route.ts.exports >> /tmp/route.ts.no-exports
echo "};" >> /tmp/route.ts.no-exports

# Now add the functions without export keyword
sed -s 's/export async/async/' /tmp/route.ts.exports >> /tmp/route.ts.no-exports

# Replace the original file
cp /tmp/route.ts.no-exports /home/rayyan9477/ocr-app/app/api/ocr/route.ts

echo "Fixed syntax errors in route.ts"

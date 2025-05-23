#!/bin/bash

ROUTE_FILE="app/api/ocr/route.ts"

# Create a backup
cp "$ROUTE_FILE" "$ROUTE_FILE.bak"

# Extract POST function to properly export it
sed -i 's/export async function POST/export const POST = async/' "$ROUTE_FILE"

# Fix HTTP handlers
sed -i 's/async function GET/export const GET = async/' "$ROUTE_FILE"
sed -i 's/async function PUT/export const PUT = async/' "$ROUTE_FILE"
sed -i 's/async function DELETE/export const DELETE = async/' "$ROUTE_FILE"

# Remove redundant exports at the end
sed -i '/\/\/ Export HTTP methods/d' "$ROUTE_FILE"
sed -i '/export { GET, PUT, DELETE };/d' "$ROUTE_FILE"

echo "Applied syntax fixes to $ROUTE_FILE"
echo "Original file backed up as $ROUTE_FILE.bak"

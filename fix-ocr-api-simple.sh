#!/bin/bash
# Simple fix for File not defined error
echo "Fixing OCR API route..."

# Add 'as any' type casting to file
sed -i '/const file = formData.get("file")/s/file = formData.get("file")/file = formData.get("file") as any/' /home/rayyan9477/ocr-app/app/api/ocr/route.ts

# Remove instanceof File check
sed -i '/if (!file || !(file instanceof File))/s/!file || !(file instanceof File)/!file/' /home/rayyan9477/ocr-app/app/api/ocr/route.ts

echo "Fix applied successfully!"

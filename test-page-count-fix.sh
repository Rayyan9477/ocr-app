#!/bin/bash

# Test the actual Smart OCR API with 3-page PDF to verify page count

set -e

PDF_FILE="uploads/test_3page.pdf"

echo "🧪 Testing Smart OCR API with 3-page PDF"
echo "==========================================="

# Test the API
echo "Calling Smart OCR API..."
response=$(curl -s -X POST -F "file=@$PDF_FILE" -F "mode=smart" http://localhost:3000/api/smart-ocr)

echo "Response received, parsing results..."

# Extract key information using grep and basic parsing
echo ""
echo "📊 RESULTS:"
echo "==========="

# Parse JSON response manually (since jq not available)
success=$(echo "$response" | grep -o '"success":[^,]*' | cut -d: -f2)
pageCount=$(echo "$response" | grep -o '"pageCount":[^,}]*' | cut -d: -f2)
averageConfidence=$(echo "$response" | grep -o '"averageConfidence":[^,}]*' | cut -d: -f2)
enginesUsed=$(echo "$response" | grep -o '"used":\[[^\]]*\]' | head -1)
successfulEngines=$(echo "$response" | grep -o '"successful":\[[^\]]*\]' | head -1)

echo "✅ Success: $success"
echo "📄 Page Count: $pageCount"
echo "🎯 Average Confidence: $averageConfidence"
echo "🔧 Engines Used: $enginesUsed"
echo "✅ Successful Engines: $successfulEngines"

echo ""
echo "🔍 Full Response (first 500 chars):"
echo "=================================="
echo "$response" | head -c 500
echo ""
echo "..."

# Check if page count is correct
if [ "$pageCount" = "3" ]; then
    echo ""
    echo "🎉 SUCCESS: Page count is correctly detected as 3!"
elif [ "$pageCount" = "1" ]; then
    echo ""
    echo "❌ ISSUE CONFIRMED: Only 1 page detected instead of 3"
    echo "📝 The multi-page processing fix is needed"
else
    echo ""
    echo "⚠️  UNEXPECTED: Page count is $pageCount (expected 3)"
fi

#!/bin/bash

echo "=== Testing Confidence Detection Components ==="
echo ""

# Test 1: Check if tesseract can generate hOCR
echo "Test 1: Testing Tesseract hOCR generation..."
if [ -f "test_page-01.jpg" ]; then
    echo "Using test image: test_page-01.jpg"
    
    # Create temp directory
    mkdir -p /tmp/confidence_test
    
    # Run tesseract to generate hOCR
    echo "Running tesseract hOCR generation..."
    tesseract test_page-01.jpg /tmp/confidence_test/output -l eng --psm 1 --oem 3 hocr 2>/tmp/confidence_test/tesseract_error.log
    
    if [ -f "/tmp/confidence_test/output.hocr" ]; then
        echo "✓ hOCR file generated successfully"
        
        # Check if it contains confidence scores
        word_count=$(grep -c "ocrx_word" /tmp/confidence_test/output.hocr)
        confidence_count=$(grep -c "x_wconf" /tmp/confidence_test/output.hocr)
        
        echo "  - Words found: $word_count"
        echo "  - Confidence scores found: $confidence_count"
        
        if [ $confidence_count -gt 0 ]; then
            echo "✓ Confidence scores are present in hOCR"
            
            # Show sample confidence scores
            echo "  Sample confidence scores:"
            grep "x_wconf" /tmp/confidence_test/output.hocr | head -3 | sed 's/.*x_wconf \([0-9]*\).*/    Confidence: \1%/'
        else
            echo "❌ No confidence scores found in hOCR"
        fi
        
        # Show first few lines of hOCR for debugging
        echo ""
        echo "First 10 lines of hOCR file:"
        head -10 /tmp/confidence_test/output.hocr
        
    else
        echo "❌ hOCR file not generated"
        echo "Tesseract error log:"
        cat /tmp/confidence_test/tesseract_error.log 2>/dev/null || echo "No error log found"
    fi
else
    echo "❌ Test image not found: test_page-01.jpg"
    ls -la test_*.jpg 2>/dev/null || echo "No test images found"
fi

echo ""
echo "Test 2: Testing PDF conversion with pdftoppm..."

# Create a test PDF if we don't have one
if [ ! -f "test.pdf" ]; then
    echo "Creating test PDF..."
    if command -v convert >/dev/null 2>&1 && [ -f "test_page-01.jpg" ]; then
        convert test_page-01.jpg test.pdf
        echo "✓ Test PDF created"
    else
        echo "❌ Cannot create test PDF (convert not available or no test image)"
    fi
fi

if [ -f "test.pdf" ]; then
    echo "Testing PDF to image conversion..."
    
    mkdir -p /tmp/confidence_test/pdf_pages
    pdftoppm -png -r 300 test.pdf /tmp/confidence_test/pdf_pages/page 2>/tmp/confidence_test/pdftoppm_error.log
    
    page_count=$(find /tmp/confidence_test/pdf_pages -name "*.png" | wc -l)
    echo "  - Pages converted: $page_count"
    
    if [ $page_count -gt 0 ]; then
        echo "✓ PDF conversion successful"
        
        # Test hOCR on converted page
        first_page=$(find /tmp/confidence_test/pdf_pages -name "*.png" | head -1)
        echo "  Testing hOCR on converted page: $(basename $first_page)"
        
        tesseract "$first_page" /tmp/confidence_test/pdf_page_output -l eng --psm 1 hocr 2>/tmp/confidence_test/pdf_tesseract_error.log
        
        if [ -f "/tmp/confidence_test/pdf_page_output.hocr" ]; then
            confidence_count=$(grep -c "x_wconf" /tmp/confidence_test/pdf_page_output.hocr)
            echo "  ✓ PDF page hOCR generated with $confidence_count confidence scores"
        else
            echo "  ❌ PDF page hOCR generation failed"
            cat /tmp/confidence_test/pdf_tesseract_error.log 2>/dev/null
        fi
    else
        echo "❌ PDF conversion failed"
        cat /tmp/confidence_test/pdftoppm_error.log 2>/dev/null
    fi
else
    echo "❌ No test PDF available"
fi

echo ""
echo "Test 3: Checking dependencies..."

# Check required tools
tools=("tesseract" "pdftoppm" "pdftotext")
for tool in "${tools[@]}"; do
    if command -v $tool >/dev/null 2>&1; then
        version=$($tool --version 2>&1 | head -1)
        echo "✓ $tool: $version"
    else
        echo "❌ $tool: Not found"
    fi
done

echo ""
echo "=== Test Summary ==="

# Cleanup
rm -rf /tmp/confidence_test

echo "Confidence detection component test completed."

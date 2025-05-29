#!/bin/bash

# Debug script to test hOCR page detection for 3-page PDF

set -e

PDF_FILE="uploads/test_3page.pdf"
TEMP_DIR="tmp/debug_$(date +%s)"

echo "🔍 Debugging page detection for $PDF_FILE"
mkdir -p "$TEMP_DIR"

# Convert PDF to images
echo "Converting PDF to images..."
pdftoppm -png -r 150 "$PDF_FILE" "$TEMP_DIR/page"

# List generated images
echo "Generated images:"
ls -la "$TEMP_DIR/"

# Process each image with Tesseract
echo "Processing each page with Tesseract..."
for img in "$TEMP_DIR"/page-*.png; do
    if [ -f "$img" ]; then
        base=$(basename "$img" .png)
        echo "Processing $base..."
        tesseract "$img" "$TEMP_DIR/${base}" -l eng --psm 1 hocr
        
        if [ -f "$TEMP_DIR/${base}.hocr" ]; then
            echo "✅ Generated hOCR for $base"
            echo "Page count in hOCR:"
            grep -c "class='ocr_page'" "$TEMP_DIR/${base}.hocr" || echo "0"
        else
            echo "❌ Failed to generate hOCR for $base"
        fi
    fi
done

# Combine hOCR files
echo "Combining hOCR files..."
hocr_files=("$TEMP_DIR"/page-*.hocr)
if [ ${#hocr_files[@]} -gt 0 ] && [ -f "${hocr_files[0]}" ]; then
    # Start with first file
    cp "${hocr_files[0]}" "$TEMP_DIR/combined.hocr"
    
    # Add subsequent pages
    for ((i=1; i<${#hocr_files[@]}; i++)); do
        if [ -f "${hocr_files[i]}" ]; then
            echo "Adding ${hocr_files[i]} to combined file..."
            
            # Use improved extraction method: get from page div start to </body>
            page_start=$(grep -n "class='ocr_page'" "${hocr_files[i]}" | head -1 | cut -d: -f1)
            body_end=$(grep -n "</body>" "${hocr_files[i]}" | head -1 | cut -d: -f1)
            
            if [ -n "$page_start" ] && [ -n "$body_end" ]; then
                # Extract page content from start line to before </body>
                page_content=$(sed -n "${page_start},$((body_end-1))p" "${hocr_files[i]}")
                
                if [ -n "$page_content" ]; then
                    # Insert before closing body tag
                    sed -i "s|</body>|$page_content\n</body>|" "$TEMP_DIR/combined.hocr"
                    echo "✅ Added page content (lines $page_start to $((body_end-1)))"
                else
                    echo "❌ Could not extract page content"
                fi
            else
                echo "❌ Could not find page boundaries (start: $page_start, end: $body_end)"
            fi
        fi
    done
    
    echo "Final combined hOCR page count:"
    grep -c "class='ocr_page'" "$TEMP_DIR/combined.hocr" || echo "0"
    
    echo "Page div locations:"
    grep -n "class='ocr_page'" "$TEMP_DIR/combined.hocr" || echo "No pages found"
    
else
    echo "No hOCR files found to combine"
fi

echo "Debug files saved in: $TEMP_DIR"

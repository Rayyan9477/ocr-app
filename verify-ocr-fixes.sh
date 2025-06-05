#!/bin/bash

echo "=== Comprehensive OCR Fix Verification ==="
echo "Running complete verification of all OCR fixes..."

# Configuration
UPLOADS_DIR="./uploads"
PROCESSED_DIR="./processed"
TEST_FILES=("test-file.pdf" "test_handwritten.png" "test_text.txt")
SERVER_URL="http://localhost:3000"

# Create required directories
mkdir -p "$UPLOADS_DIR" "$PROCESSED_DIR"

# Function to check server status
check_server() {
    echo "Checking server status..."
    if curl -s "$SERVER_URL" > /dev/null; then
        echo "✓ Server is running"
        return 0
    else
        echo "✗ Server is not running"
        return 1
    fi
}

# Function to test OCR processing
test_ocr_processing() {
    local file="$1"
    local description="$2"
    
    echo "Testing OCR processing for $description..."
    
    # Process file
    response=$(curl -s -X POST \
        -F "file=@$file" \
        -F "useSmartOCR=true" \
        -F "language=eng" \
        "$SERVER_URL/api/smart-ocr")
    
    # Check response format
    if echo "$response" | jq . >/dev/null 2>&1; then
        echo "✓ Received valid JSON response"
        
        # Extract output file path
        output_file=$(echo "$response" | jq -r '.outputFile')
        if [ ! -z "$output_file" ]; then
            echo "✓ Output file path received: $output_file"
            
            # Test file download
            if curl -s "$SERVER_URL/api/download?file=$output_file" -o /dev/null; then
                echo "✓ File download successful"
                return 0
            else
                echo "✗ File download failed"
                return 1
            fi
        else
            echo "✗ No output file path in response"
            return 1
        fi
    else
        echo "✗ Invalid JSON response"
        echo "Raw response: $response"
        return 1
    fi
}

# Main test sequence
main() {
    echo "Starting verification..."
    
    # 1. Check server
    check_server || {
        echo "ERROR: Server must be running to proceed with tests"
        exit 1
    }
    
    # 2. Verify Python environment
    echo "Verifying Python environment..."
    python3 -c "import PIL; import numpy; print('✓ Python environment verified')" || {
        echo "✗ Python environment verification failed"
        exit 1
    }
    
    # 3. Test file processing
    echo "Testing file processing..."
    
    # Create a test PDF if it doesn't exist
    if [ ! -f "$UPLOADS_DIR/${TEST_FILES[0]}" ]; then
        echo "Creating test PDF..."
        python3 create_test_pdf.py "$UPLOADS_DIR/${TEST_FILES[0]}" || {
            echo "Failed to create test PDF"
            exit 1
        }
    fi
    
    # Process each test file
    for file in "${TEST_FILES[@]}"; do
        if [ -f "$UPLOADS_DIR/$file" ]; then
            test_ocr_processing "$UPLOADS_DIR/$file" "$file" || {
                echo "ERROR: Processing failed for $file"
                exit 1
            }
        fi
    done
    
    # 4. Verify file naming consistency
    echo "Verifying file naming consistency..."
    processed_files=$(ls "$PROCESSED_DIR")
    echo "$processed_files" | grep -E "_[0-9]+_smart_ocr\.pdf$" || {
        echo "✗ No files found with correct naming pattern"
        exit 1
    }
    
    # 5. Test error handling
    echo "Testing error handling..."
    invalid_response=$(curl -s -X POST "$SERVER_URL/api/smart-ocr")
    if echo "$invalid_response" | grep -q "error"; then
        echo "✓ Error handling working correctly"
    else
        echo "✗ Error handling test failed"
        exit 1
    fi
    
    echo
    echo "=== Test Summary ==="
    echo "✓ All verification tests completed successfully"
}

# Run main test sequence
main

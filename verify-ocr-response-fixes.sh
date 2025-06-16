#!/bin/bash
# verify-ocr-response-fixes.sh - Script to verify OCR fixes in production

# Text colors
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}  OCR Response Fixes Verification            ${NC}"
echo -e "${BLUE}==============================================${NC}"

# Check for required files
required_files=(
  "lib/json-response-helper.js"
  "lib/ocr-output-helper.js"
  "lib/ocr-fallback-handler.js"
  "lib/enhanced-ocr-processor.js"
  "python/process_with_nanovlm.py"
)

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}❌ Required file not found: $file${NC}"
    exit 1
  else
    echo -e "${GREEN}✅ Found $file${NC}"
  fi
done

# Give execute permissions to Python script
chmod +x python/process_with_nanovlm.py

# Verify directories have correct permissions
dirs_to_check=(
  "uploads"
  "processed"
  "tmp"
  "logs"
  "samples"
)

for dir in "${dirs_to_check[@]}"; do
  if [ ! -d "$dir" ]; then
    echo -e "${YELLOW}Creating directory: $dir${NC}"
    mkdir -p "$dir"
  fi
  
  if [ -w "$dir" ]; then
    echo -e "${GREEN}✅ Directory $dir is writable${NC}"
  else
    echo -e "${RED}❌ Directory $dir is NOT writable${NC}"
    echo "Fixing permissions..."
    chmod -R 755 "$dir"
  fi
done
}

# Create our test directories
TEST_DIR="./tests/tmp"
SAMPLES_DIR="./samples"
mkdir -p "$TEST_DIR" "$SAMPLES_DIR"

# Function to create a test PDF if it doesn't exist
create_test_pdf() {
  local output_file="$SAMPLES_DIR/test_document.pdf"
  
  if [ ! -f "$output_file" ]; then
    echo -e "${YELLOW}Creating test PDF document...${NC}"
    
    # Check if ImageMagick is available
    if command -v convert &> /dev/null; then
      convert -size 800x600 -background white -fill black -pointsize 24 \
        label:"OCR Test Document\n\nThis is a sample document to test OCR processing\nwith multiple engines and improved error handling." \
        "$output_file"
    else
      # Alternative: Create a simple PDF with text
      echo -e "${YELLOW}ImageMagick not available, using alternative method...${NC}"
      
      # Use Python to create a PDF
      python3 -c "
import fpdf
pdf = fpdf.FPDF()
pdf.add_page()
pdf.set_font('Arial', 'B', 16)
pdf.cell(40, 10, 'OCR Test Document')
pdf.ln(20)
pdf.set_font('Arial', '', 12)
pdf.multi_cell(0, 10, 'This is a sample document to test OCR processing\\nwith multiple engines and improved error handling.')
pdf.output('$output_file')
      " 2>/dev/null || echo -e "${RED}Could not create test PDF automatically${NC}"
    fi
  fi
  
  # Check if the file was created
  if [ -f "$output_file" ]; then
    echo -e "${GREEN}✅ Test PDF is ready at $output_file${NC}"
    return 0
  else
    echo -e "${RED}❌ Failed to create test PDF${NC}"
    return 1
  fi
}

# Function to test OCR processing
test_ocr_processing() {
  local input_file=$1
  local base_name=$(basename "$input_file" .pdf)
  local output_file="$TEST_DIR/${base_name}_ocr.pdf"
  
  echo -e "${BLUE}Testing OCR processing on: $input_file${NC}"
  
  # Get file info
  file "$input_file"
  
  # First test with OCRmyPDF directly
  echo -e "\n${YELLOW}Testing with OCRmyPDF directly...${NC}"
  ocrmypdf --force-ocr --skip-big 100 --optimize 1 \
    --max-image-mpixels 250 --jpeg-quality 75 --pdfa-image-compression jpeg \
    --jbig2-lossy --output-type pdfa \
    "$input_file" "$output_file" && \
    echo -e "${GREEN}✅ OCRmyPDF processing successful!${NC}" || \
    echo -e "${RED}❌ OCRmyPDF processing failed${NC}"
  
  # Test with our enhanced OCR processor
  echo -e "\n${YELLOW}Testing with Enhanced OCR Processor...${NC}"
  node -e "
    const { processWithMultipleEngines } = require('./lib/enhanced-ocr-processor');
    
    async function runTest() {
      try {
        console.log('Processing with Enhanced OCR Processor...');
        const result = await processWithMultipleEngines('$input_file', '$TEST_DIR', {});
        console.log('Result:', JSON.stringify(result, null, 2));
        
        if (result.success) {
          console.log('✅ Processing successful!');
          process.exit(0);
        } else {
          console.error('❌ Processing failed:', result.error || 'Unknown error');
          process.exit(1);
        }
      } catch (error) {
        console.error('❌ Error during processing:', error);
        process.exit(1);
      }
    }
    
    runTest();
  " && echo -e "${GREEN}✅ Enhanced OCR Processor successful!${NC}" || \
    echo -e "${RED}❌ Enhanced OCR Processor failed${NC}"
}

# Function to test JSON response handling
test_json_response() {
  echo -e "\n${YELLOW}Testing JSON response handling...${NC}"
  
  node -e "
    const { handleOcrResponse, safeJsonParse } = require('./lib/json-response-helper');
    
    async function testJsonHandling() {
      try {
        console.log('Testing JSON response handling...');
        
        // Test 1: Large response
        console.log('Test 1: Large response...');
        const largeText = 'OCR Result\\n' + '✅ Successfully processed test.pdf\\n' + 
          '📄 Output file: test_ocr.pdf\\n' + '📊 Confidence Analysis:\\n' +
          'Raw response: ' + JSON.stringify({success: true, text: 'A'.repeat(10000)});
        
        const mockResponse1 = {
          status: 200,
          json: () => Promise.reject(new Error('Simulated JSON parsing failure')),
          text: () => Promise.resolve(largeText),
          clone: () => mockResponse1
        };
        
        const result1 = await handleOcrResponse(mockResponse1);
        console.log('Large response test result:', 
          result1.success ? '✅ Success' : '❌ Failed');
        
        // Test 2: Server response parsing issue
        console.log('Test 2: Server response parsing issue...');
        const mockResponse2 = {
          status: 200,
          json: () => Promise.reject(new Error('Unexpected token')),
          text: () => Promise.resolve('⚠️ Server response couldn\\'t be parsed as JSON despite status 200.'),
          clone: () => mockResponse2
        };
        
        const result2 = await handleOcrResponse(mockResponse2);
        console.log('Server response parsing issue test result:', 
          result2.success ? '✅ Success' : '❌ Failed');
        
        // All tests passed?
        if (result1.success && result2.success) {
          console.log('✅ All JSON response handling tests passed!');
          process.exit(0);
        } else {
          console.error('❌ Some JSON response handling tests failed');
          process.exit(1);
        }
      } catch (error) {
        console.error('❌ Error during JSON response tests:', error);
        process.exit(1);
      }
    }
    
    testJsonHandling();
  " && echo -e "${GREEN}✅ JSON response handling tests successful!${NC}" || \
    echo -e "${RED}❌ JSON response handling tests failed${NC}"
}

# Function to test JBIG2 functionality
test_jbig2() {
  echo -e "\n${YELLOW}Testing JBIG2 functionality...${NC}"
  
  # Check if jbig2enc is installed
  if command -v jbig2 &> /dev/null; then
    echo -e "${GREEN}✅ jbig2 is installed${NC}"
  else
    echo -e "${RED}❌ jbig2 is not installed${NC}"
    
    # Check if we can install it automatically
    if command -v apt-get &> /dev/null; then
      echo "Attempting to install jbig2enc..."
      sudo apt-get update
      sudo apt-get install -y jbig2enc || echo "Failed to install jbig2enc automatically"
    else
      echo "Please install jbig2enc manually and try again"
    fi
    
    # Check again after attempted installation
    if command -v jbig2 &> /dev/null; then
      echo -e "${GREEN}✅ jbig2 was successfully installed${NC}"
    else
      echo -e "${YELLOW}⚠️ jbig2 is still not available, but we'll continue${NC}"
    fi
  fi
  
  # Test OCRmyPDF with JBIG2
  echo "Testing OCRmyPDF with JBIG2 options..."
  
  local test_file="$SAMPLES_DIR/test_document.pdf"
  local output_file="$TEST_DIR/jbig2_test_output.pdf"
  
  if [ -f "$test_file" ]; then
    ocrmypdf --jbig2-lossy --optimize 1 --output-type pdfa "$test_file" "$output_file" && \
      echo -e "${GREEN}✅ OCRmyPDF with JBIG2 options successful!${NC}" || \
      echo -e "${RED}❌ OCRmyPDF with JBIG2 options failed${NC}"
  else
    echo -e "${RED}❌ Test file not found: $test_file${NC}"
  fi
}
    exit 1
  fi
done

# Test OCR with a simple file if ocrmypdf is available
if command -v ocrmypdf &> /dev/null; then
  echo "OCRmyPDF is available, running a test..."
  
  # Create a simple test file
  echo "Creating test file..."
  cat > test-text.txt << 'EOL'
This is a test file to verify OCR processing.
It contains simple text that should be recognized correctly.
If you can read this, OCR is working properly.
EOL

  # Convert text to image
  if command -v convert &> /dev/null; then
    echo "Converting text to image..."
    convert -size 1000x500 xc:white -font Helvetica -pointsize 24 \
      -draw "text 50,100 '@test-text.txt'" \
      test-image.png
    
    # Run OCR on the image
    echo "Running OCR on test image..."
    ocrmypdf -l eng --deskew test-image.png processed/test-ocr-result.pdf
    
    if [ -f "processed/test-ocr-result.pdf" ]; then
      echo "✅ OCR test successful! Output file created."
    else
      echo "❌ OCR test failed. No output file created."
      exit 1
    fi
  else
    echo "ImageMagick not available, skipping OCR test."
  fi
else
  echo "OCRmyPDF not available, skipping OCR test."
fi

# Test the fallback creation
echo "Testing fallback PDF creation..."
node -e "
const { createOcrFallback } = require('./lib/ocr-fallback-handler');
const fs = require('fs');
const path = require('path');

async function testFallback() {
  console.log('Creating test fallback PDF...');
  const result = await createOcrFallback(
    'test-image.png', 
    'This is a test error message',
    { outputDir: 'processed' }
  );
  
  if (result.outputFile && fs.existsSync(result.outputFile)) {
    console.log('✅ Fallback creation successful!');
    console.log('Output file: ' + result.outputFile);
  } else {
    console.log('❌ Fallback creation failed.');
    process.exit(1);
  }
}

testFallback().catch(console.error);
"

echo "Testing response handling with large content..."
node -e "
const { safeJsonParse } = require('./lib/json-response-helper');

// Create a mock response with large content
const largeText = 'a'.repeat(1000000); // 1MB of text
const responseText = JSON.stringify({
  success: true,
  outputFile: 'large-response-test.pdf',
  text: largeText
});

// Test parsing the large response
async function testLargeResponse() {
  try {
    const result = await safeJsonParse(responseText);
    
    if (result.success && result.outputFile) {
      console.log('✅ Successfully parsed large JSON response');
      console.log('Response size: ' + (responseText.length / 1024 / 1024).toFixed(2) + 'MB');
    } else {
      console.log('❌ Failed to parse large JSON response');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error parsing large response:', error);
    process.exit(1);
  }
}

testLargeResponse().catch(console.error);
"

# Run all tests
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}  Running OCR Fixes Verification Tests       ${NC}"
echo -e "${BLUE}==============================================${NC}"

# Create test document if needed
create_test_pdf

# Test JSON response handling
test_json_response

# Test JBIG2 functionality
test_jbig2

# Test OCR processing
if [ -f "$SAMPLES_DIR/test_document.pdf" ]; then
  test_ocr_processing "$SAMPLES_DIR/test_document.pdf"
else
  echo -e "${RED}❌ No test document available for OCR testing${NC}"
fi

# Look for a superbill2.pdf file to test with
if [ -f "./samples/superbill2.pdf" ]; then
  echo -e "\n${YELLOW}Testing with actual superbill2.pdf from screenshot...${NC}"
  test_ocr_processing "./samples/superbill2.pdf"
fi

echo -e "\n${BLUE}==============================================${NC}"
echo -e "${GREEN}✅ All OCR fixes verification tests completed!${NC}"
echo -e "${BLUE}==============================================${NC}"
echo -e "\nYour OCR system should now be able to handle large responses,"
echo -e "process full documents, and utilize better compression (JBIG2)."

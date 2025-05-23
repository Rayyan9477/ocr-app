#!/bin/bash
# Script to fix the stuck OCR API route compilation

echo "Applying fix for stuck OCR API route compilation..."

# Step 1: Check if the API route file exists
if [ ! -f "/home/rayyan9477/ocr-app/app/api/ocr/route.ts" ]; then
  echo "Error: OCR API route file not found!"
  exit 1
fi

# Step 2: Create a simple modification to the OCR API route
# This will fix the issue without requiring extra function imports

# Create a temporary file with the modified error handling code
cat << 'EOF' > /tmp/ocr_error_handler_fix.ts
try {
  // Get the error type and message
  let errorType = 'ocr_failed';
  let errorDetails = 'OCR process failed';
  let statusCode = 500;

  // Check for known error conditions
  if (stderrOutput.toLowerCase().includes('already contains text')) {
    errorType = 'has_text';
    errorDetails = 'PDF already contains text';
    statusCode = 400;
  }

  if (stderrOutput.toLowerCase().includes('tagged pdf')) {
    errorType = 'tagged_pdf';
    errorDetails = 'PDF is a tagged PDF';
    statusCode = 400;
  }

  // Check if the error message indicates a file was successfully created despite the error
  if (errorMessage.includes('Output written to') || stderrOutput.includes('Output written to')) {
    console.log("File was processed despite error, checking for output...");
    
    // Look for valid output file
    let fallbackPath = outputPath;
    if (existsSync(outputPath)) {
      console.log(`✅ Despite error, output file exists at: ${outputPath}`);
      
      // Return a success response with the output file path
      return createJsonResponse({
        success: true,
        warning: errorDetails,
        warningType: errorType,
        inputFile: path.basename(inputPath),
        outputFile: path.basename(outputPath),
        details: errorMessage,
        fallback: false
      }, 200);
    }
    
    // Look for fallback file with similar name pattern
    const basePath = outputPath.replace(/\.pdf$/, '');
    const fallbackPattern = `${basePath}_fallback_*.pdf`;
    
    // Try to find a matching fallback file
    try {
      const { exec: execCallback } = await import('child_process');
      const { promisify } = await import('util');
      const execPromise = promisify(execCallback);
      
      const { stdout } = await execPromise(`find "${processedDir}" -name "${path.basename(fallbackPattern)}" -type f | sort -r | head -n 1`);
      
      if (stdout.trim()) {
        console.log(`✅ Found fallback file: ${stdout.trim()}`);
        fallbackPath = stdout.trim();
        
        return createJsonResponse({
          success: true,
          warning: errorDetails,
          warningType: errorType,
          inputFile: path.basename(inputPath),
          outputFile: path.basename(fallbackPath),
          details: errorMessage,
          fallback: true
        }, 200);
      }
    } catch (findError) {
      console.error("Error searching for fallback files:", findError);
      // Continue to normal error handling
    }
  }
  
  // Handle the error and ensure we have an output file
  const errorResult = await handleOcrError(
    inputPath, 
    `${errorDetails}: ${errorMessage}`
  );

  // Return response with the fallback output file
  return createJsonResponse({
    success: false,
    errorType,
    error: errorDetails,
    details: errorMessage,
    inputFile: path.basename(inputPath),
    outputFile: path.basename(errorResult.outputFile || ""),
    fallback: true
  }, statusCode);
EOF

# Use sed to replace the error handler section with our modified version
# Find the section between "try {" after "catch (execError: any) {" and before "} catch (fallbackError) {"
sed -i '/catch (execError: any) {/,/try {/!b;/try {/!d;r /tmp/ocr_error_handler_fix.ts' /home/rayyan9477/ocr-app/app/api/ocr/route.ts

echo "Fix applied to OCR API route."
echo "Please restart the Next.js server for changes to take effect."

# Clean up temporary file
rm -f /tmp/ocr_error_handler_fix.ts

echo "Done!"

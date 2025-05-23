// Fix for OCR API route that ensures better error handling for fallback PDFs

// In the OCR API route, find the following section that handles OCR errors:
/*
try {
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
    inputFile: path.basename(inputPath),  // Use the full path we have
    outputFile: path.basename(errorResult.outputFile || ""),  // Just return the filename part
    fallback: true
  }, statusCode);
*/

// And replace it with:
/*
try {
  // Check if the OCR error message contains references to an output file
  // This happens when OCRmyPDF fails with a 500 status but still creates a file
  const potentialPaths = extractPotentialPathsFromError(errorMessage);
  const validOutputPath = potentialPaths.find(p => fs.existsSync(p));
  
  if (validOutputPath) {
    console.log(`Despite OCR error, found valid output file: ${validOutputPath}`);
    
    // Return response with the detected output file
    return createJsonResponse({
      success: true, // Mark as success since we have a valid output
      warningType: errorType,
      warning: errorDetails,
      details: `${errorMessage} (File was successfully created despite error)`,
      inputFile: path.basename(inputPath),
      outputFile: path.basename(validOutputPath),
      fallback: false
    }, 200); // Return 200 since we have a valid result
  }
  
  // If no valid output found in error message, handle error normally
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
*/

// Also add this import at the top:
// import { extractPotentialPathsFromError } from "@/lib/ocr-output-helper";

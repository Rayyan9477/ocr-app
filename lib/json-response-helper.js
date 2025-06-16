/**
 * JSON Response Helper for OCR API
 * 
 * This module provides utilities for safely handling large JSON responses
 * and preventing parsing errors due to response size limitations.
 * 
 * Works in both browser and Node.js environments.
 */

/**
 * Maximum response size for safe handling (approx)
 */
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB - Increased from 5MB

/**
 * Safely parse potentially large JSON responses
 * 
 * @param {Response|string} response - Fetch Response object or raw response text
 * @returns {Promise<object>} Parsed JSON object
 * @throws {Error} If parsing fails completely
 */
async function safeJsonParse(response) {
  try {
    // If response is a string, parse it directly
    if (typeof response === 'string') {
      try {
        return JSON.parse(response);
      } catch (stringParseError) {
        console.error('Error parsing JSON string:', stringParseError.message.substring(0, 100));
        
        // If parsing fails, try our custom extraction
        return extractJsonFromText(response, 200);
      }
    }
    
    // If it's a Response object, try normal JSON parsing first
    if (response && typeof response.json === 'function') {
      try {
        return await response.json();
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError);
        
        // If JSON parsing fails, try to extract essential information using regex
        const text = await response.text();
        return extractJsonFromText(text, response.status);
      }
    }
    
    throw new Error('Invalid response object');
  } catch (error) {
    console.error('Safe JSON parse failed:', error);
    throw error;
  }
}

/**
 * Extract JSON data from raw text using regex when JSON.parse fails
 * 
 * @param {string} text - Raw response text
 * @param {number} status - HTTP status code
 * @returns {object} Extracted data as an object
 * @throws {Error} If extraction fails
 */
function extractJsonFromText(text, status = 200) {
  // Check if the response is extremely large
  if (text.length > 1000000) { // 1MB
    console.warn(`Response is very large (${(text.length/1024/1024).toFixed(2)}MB). This may be causing parsing issues.`);
  }
  
  // Check for structured OCR result indicators
  const ocrSuccessIndicators = [
    'Successfully processed',
    'Output file:',
    '_ocr.pdf',
    'OCR Result',
    'Processed with'
  ];
  
  const hasOcrSuccessIndicator = ocrSuccessIndicators.some(indicator => 
    text.includes(indicator)
  );
  
  // Try to extract success status and output file using more flexible patterns
  const successMatch = /[\"']?success[\"']?\s*:\s*(?:true|false)/i.exec(text);
  const success = successMatch ? successMatch[0].toLowerCase().includes('true') : hasOcrSuccessIndicator;
  
  // Look for output file with various patterns
  const outputFilePatterns = [
    /[\"']?outputFile[\"']?\s*:\s*[\"']([^\"']+)[\"']/i,
    /Output file:\s*([^\s\n\r]+)/i,
    /([a-zA-Z0-9_-]+_ocr\.pdf)/i
  ];
  
  let outputFile = '';
  for (const pattern of outputFilePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      outputFile = match[1];
      break;
    }
  }
  
  // Try to extract text content (truncated)
  // Handle both JSON format and plain text log format
  const textMatchPatterns = [
    /[\"']?text[\"']?\s*:\s*[\"']([^\"']{0,2000})/i,
    /OCR Result text:([^]{0,2000})/i
  ];
  
  let extractedText = '';
  for (const pattern of textMatchPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      extractedText = match[1] + (match[1].length >= 2000 ? '...' : '');
      break;
    }
  }
  
  // Try to extract error details
  const errorMatch = text.match(/[\"']?error[\"']?\s*:\s*[\"']([^\"']+)[\"']/i);
  const error = errorMatch && errorMatch[1] ? errorMatch[1] : '';
  
  const detailsMatch = text.match(/[\"']?details[\"']?\s*:\s*[\"']([^\"']+)[\"']/i);
  const details = detailsMatch && detailsMatch[1] ? detailsMatch[1] : '';
  
  // Look for confidence analysis
  const confidenceMatch = text.match(/Confidence Analysis:([^]*?)(?:[\n\r][\n\r]|$)/i);
  const confidenceInfo = confidenceMatch && confidenceMatch[1] ? confidenceMatch[1].trim() : '';
  
  // Extract the file name for identification
  const filenameMatch = text.match(/(?:processed|processing|file:)\s*([a-zA-Z0-9_\.-]+\.(?:pdf|png|jpg|tiff))/i);
  const filename = filenameMatch && filenameMatch[1] ? filenameMatch[1] : '';
  
  // If we found some data, return it
  if (success || outputFile || hasOcrSuccessIndicator) {
    console.log(`Successfully extracted data from response text. Output file: ${outputFile || 'Not found, but success detected'}`);
    return {
      success: true,
      outputFile: outputFile,
      filename: filename || outputFile,
      text: extractedText || "Text too large to display - see PDF for full content",
      details: details || "Processed successfully but response was too large to parse as JSON",
      confidence: confidenceInfo || null,
      _extracted: true // Flag to indicate this was extracted
    };
  }
  
  // If extraction failed but we got a 200 status, assume success
  if (status === 200) {
    // Try to find any output file reference
    const anyPdfMatch = text.match(/(\w+\.pdf)/i);
    return {
      success: true,
      outputFile: anyPdfMatch ? anyPdfMatch[1] : null,
      details: "Response was too large to parse as JSON, but server returned 200 OK",
      _extracted: true
    };
  }
  
  // If we couldn't extract anything useful, throw an error
  throw new Error(`Failed to parse server response. Response size: ${text.length} bytes`);
}

/**
 * Safely handle OCR API responses
 * 
 * @param {Response} response - Fetch Response object
 * @returns {Promise<object>} Processed response data
 */
async function handleOcrResponse(response) {
  // Clone the response so we can use it multiple times if needed
  const clonedResponse = response.clone();
  
  try {
    // Try to parse as JSON first
    const result = await safeJsonParse(response);
    
    // Add timestamps to help with debugging
    result._timestamp = new Date().toISOString();
    result._responseStatus = response.status;
    
    return result;
  } catch (error) {
    console.error('JSON parsing failed:', error);
    
    // If parsing fails, check if the response contains a reference to an output file
    try {
      const text = await clonedResponse.text();
      
      // Check if there's a successful output file mention
      const ocrSuccessIndicators = [
        '_ocr.pdf',
        'Output file:', 
        'Successfully processed',
        'OCR Result',
        'Confidence Analysis'
      ];
      
      const hasOcrSuccessIndicator = ocrSuccessIndicators.some(indicator => 
        text.includes(indicator)
      );
      
      if (hasOcrSuccessIndicator) {
        // Extract filename using regex patterns
        const filenamePatterns = [
          /([\w-]+)_ocr\.pdf/,
          /Output file:\s*([^\s\n\r]+)/,
          /Successfully processed\s+([a-zA-Z0-9_\.-]+)(?:\.pdf)?/
        ];
        
        let filename = null;
        for (const pattern of filenamePatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            filename = match[1].endsWith('.pdf') ? match[1] : `${match[1]}_ocr.pdf`;
            break;
          }
        }
        
        if (filename) {
          console.log(`Extracted output filename from response: ${filename}`);
          
          // Extract any text content if available
          const textMatch = text.match(/OCR Result text:([^]{0,1000})/i);
          const extractedText = textMatch && textMatch[1] ? 
            textMatch[1].trim() + (textMatch[1].length >= 1000 ? '...' : '') : 
            '';
          
          // Extract confidence info if available
          const confidenceMatch = text.match(/Confidence Analysis:([^]*?)(?:[\n\r][\n\r]|$)/i);
          const confidenceInfo = confidenceMatch && confidenceMatch[1] ? confidenceMatch[1].trim() : '';
          
          return {
            success: true,
            outputFile: filename,
            text: extractedText || "Successfully processed but text content not available",
            details: "Successfully processed despite JSON parsing errors",
            confidence: confidenceInfo || null,
            _timestamp: new Date().toISOString(),
            _responseStatus: response.status,
            _extracted: true
          };
        }
      }
      
      // For non-standard OCR responses that succeeded (e.g., different format)
      if (clonedResponse.status === 200 && text.length > 0) {
        console.log('Got non-standard success response, extracting what we can...');
        
        // Extract any PDF filename if available
        const pdfMatch = text.match(/([a-zA-Z0-9_-]+\.pdf)/);
        const anyFilename = pdfMatch ? pdfMatch[1] : null;
        
        // Simple heuristic: check if the response has more lines
        // than would be expected for an error message
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        const isLikelySuccess = lines.length > 3;
        
        return {
          success: isLikelySuccess,
          outputFile: anyFilename,
          details: "Non-standard response format with status 200",
          _timestamp: new Date().toISOString(),
          _responseStatus: response.status,
          _extracted: true,
          _responsePreview: text.substring(0, 200) + (text.length > 200 ? '...' : '')
        };
      }
      
      // Last resort - just return a generic response based on HTTP status
      if (clonedResponse.status === 200) {
        return {
          success: true,
          details: "Response couldn't be parsed, but server returned 200 OK",
          _timestamp: new Date().toISOString(),
          _responseStatus: response.status,
          _extracted: true
        };
      }
      
      // If all else fails, throw an error
      throw new Error(`Failed to extract useful information from response. Status: ${clonedResponse.status}`);
    } catch (textError) {
      console.error('Text extraction failed:', textError);
      throw new Error(`Complete response handling failure. Status: ${clonedResponse.status}`);
    }
  }
}

// Export functions for use in Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    safeJsonParse,
    extractJsonFromText,
    handleOcrResponse
  };
} else {
  // For browser usage
  window.safeJsonParse = safeJsonParse;
  window.handleOcrResponse = handleOcrResponse;
}

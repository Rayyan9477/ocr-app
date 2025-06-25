/**
 * Safe API wrapper for OCR processing to prevent server crashes
 */
import { NextResponse } from 'next/server';

/**
 * Creates a safe wrapper for API endpoints that use OCR processing
 * Ensures responses are always valid JSON and handles errors gracefully
 */
export function createSafeOcrApiHandler(handlerFn) {
  return async function safeHandler(req) {
    try {
      // Execute the original handler
      return await handlerFn(req);
    } catch (error) {
      console.error('OCR API error:', error);
      
      // Send a safe error response
      return safeJsonResponse({
        success: false,
        error: 'OCR processing failed',
        message: error.message || 'Unknown error occurred',
        code: 'OCR_PROCESSING_ERROR',
        outputFile: `ocr_error_${Date.now()}.pdf` // Always include an output filename
      }, { status: 500 });
    }
  };
}

/**
 * Sends a JSON response with proper headers and ensures it's serializable
 * @param {Object} data - The data to send
 * @param {Object} options - Response options (status, headers)
 */
export function safeJsonResponse(data, options = {}) {
  try {
    // Default options
    const { status = 200, headers = {} } = options;
    
    // Ensure there's always an outputFile field for OCR responses
    if (data && !data.outputFile && data.success !== false) {
      data.outputFile = `ocr_result_${Date.now()}.pdf`;
      console.warn('No outputFile in result, using generated filename');
    }
    
    // Limit text size to prevent response truncation
    if (data && data.text && typeof data.text === 'string' && data.text.length > 30000) {
      console.warn(`Large text detected (${data.text.length} chars), truncating to 30000 chars`);
      data.text = data.text.substring(0, 30000) + '... [truncated due to size]';
      data.textTruncated = true;
    }
    
    // Test serialization first to catch any issues
    const serialized = JSON.stringify(data);
    
    // Check for excessively large response
    if (serialized.length > 10 * 1024 * 1024) { // > 10MB
      console.error('Response size too large:', serialized.length, 'bytes');
      
      // Create a minimal response with base64 encoding for text
      const minimalResult = {
        success: data.success !== false,
        message: 'Response truncated due to size limits',
        outputFile: data.outputFile || `ocr_result_${Date.now()}.pdf`
      };
      
      if (data.text) {
        minimalResult.textEncoded = Buffer.from(data.text.substring(0, 10000)).toString('base64');
        minimalResult.encoding = 'base64';
      }
      
      return new NextResponse(JSON.stringify(minimalResult), {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });
    }
    
    // Create response with properly serialized data
    return new NextResponse(serialized, {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });
  } catch (jsonError) {
    console.error('JSON serialization error:', jsonError);
    
    // Send minimal safe response
    return NextResponse.json({
      success: false,
      error: 'Invalid JSON response generated',
      code: 'JSON_SERIALIZATION_ERROR',
      outputFile: `ocr_error_${Date.now()}.pdf` // Always include an output filename
    }, {
      status: 500,
    });
  }
}

export default { createSafeOcrApiHandler, safeJsonResponse };

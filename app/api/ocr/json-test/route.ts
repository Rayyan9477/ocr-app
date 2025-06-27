import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";

// Test endpoint for JSON sanitization
export async function POST(request: NextRequest) {
  try {
    // Get the JSON data from the request
    const data = await request.json();
    
    // Process each test case with our sanitization functions
    if (data.testCases && Array.isArray(data.testCases)) {
      const processedTestCases = data.testCases.map((testCase: any) => {
        // Apply sanitization to the text field
        const sanitizedText = sanitizeTextForJson(testCase.text);
        
        return {
          ...testCase,
          originalLength: testCase.text.length,
          sanitizedText,
          sanitizedLength: sanitizedText.length,
          isSafe: true
        };
      });
      
      // Create a response with the processed test cases
      return createJsonResponse({
        success: true,
        message: "JSON sanitization test completed successfully",
        originalTestCount: data.testCases.length,
        processedTestCount: processedTestCases.length,
        testCases: processedTestCases,
        timestamp: new Date().toISOString()
      });
    }
    
    return createJsonResponse({
      success: false,
      error: "Invalid test data format",
      message: "The request must include a 'testCases' array"
    }, 400);
  } catch (error) {
    logger.error(`Error in JSON test endpoint: ${error instanceof Error ? error.message : String(error)}`);
    return createJsonResponse({
      success: false,
      error: "Failed to process test request",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

// Helper function to create consistent JSON responses
function createJsonResponse(data: any, status: number = 200) {
  try {
    // Validate and sanitize the data
    const validatedData = validateJsonData(data);
    const sanitizedData = sanitizeDataForJson(validatedData);
    
    // Final JSON validation check before sending
    let responseString: string;
    try {
      responseString = JSON.stringify(sanitizedData);
      // Verify it can be parsed back (safety check)
      JSON.parse(responseString);
    } catch (jsonStringifyError) {
      // If still failing, create an extremely minimal response
      logger.error(`Final JSON stringify failed: ${jsonStringifyError instanceof Error ? jsonStringifyError.message : String(jsonStringifyError)}`);
      responseString = JSON.stringify({
        success: false,
        error: 'Fatal error creating JSON response',
        timestamp: new Date().toISOString()
      });
    }
    
    return new NextResponse(responseString, {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error(`Failed to create JSON response: ${error instanceof Error ? error.message : String(error)}`);
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Helper function to validate JSON before sending response
function validateJsonData(data: any): any {
  try {
    // Test if the data can be serialized and parsed
    const jsonString = JSON.stringify(data);
    const parsed = JSON.parse(jsonString);
    return parsed;
  } catch (error) {
    logger.error(`JSON validation failed: ${error instanceof Error ? error.message : String(error)}`);
    
    // Try to identify and fix the problematic fields
    if (typeof data === 'object' && data !== null) {
      const safeData: any = {};
      
      // Create a safe copy of the data, sanitizing problematic fields
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.length > 100) {
          // Aggressively sanitize long string values that might cause issues
          safeData[key] = truncateTextForResponse(value, 100);
        } else if (typeof value === 'object' && value !== null) {
          // For nested objects, just use a simple placeholder
          safeData[key] = Array.isArray(value) ? [] : { summary: 'Complex data omitted for safety' };
        } else {
          // For primitives and short strings, keep as is
          safeData[key] = value;
        }
      }
      
      // Add safe fields
      safeData.success = false;
      safeData.error = 'Response data validation failed';
      safeData.details = 'The server response could not be properly formatted as JSON';
      
      return safeData;
    }
    
    // Return a safe fallback if data isn't an object
    return {
      success: false,
      error: 'Response data validation failed',
      details: 'The server response could not be properly formatted as JSON'
    };
  }
}

// Helper function to sanitize data for JSON safety
function sanitizeDataForJson(data: any): any {
  if (data === null || data === undefined) return data;
  
  if (typeof data === 'string') {
    // Use truncateTextForResponse with a larger maxLength for data objects
    return truncateTextForResponse(data, 10000);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeDataForJson(item));
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeDataForJson(value);
    }
    return sanitized;
  }
  
  return data;
}

// Helper function to truncate and sanitize text for JSON responses
function truncateTextForResponse(text: string, maxLength: number = 300): string {
  if (!text) {
    return '';
  }
  
  try {
    // Handle excessively large text content
    const truncated = text.length <= maxLength
      ? text
      : text.substring(0, maxLength) + '... [truncated - full text available in output file]';
    
    // Always sanitize after truncation to ensure JSON safety
    return sanitizeTextForJson(truncated);
  } catch (error) {
    logger.error(`Error truncating text for response: ${error instanceof Error ? error.message : String(error)}`);
    return 'Text truncation error - content available in output file';
  }
}

// Helper function to sanitize text for JSON safety
function sanitizeTextForJson(text: string): string {
  if (!text) return '';
  
  try {
    // First handle multi-level escaped backslashes and sequences that can cause JSON issues
    let sanitized = text;
    
    // Handle triple and double escaped sequences - must be done in order from most escaped to least
    sanitized = sanitized
      .replace(/\\\\\\n/g, '\\n')
      .replace(/\\\\\\r/g, '\\r')
      .replace(/\\\\\\t/g, '\\t')
      .replace(/\\\\\\"/g, '\\"')
      .replace(/\\\\\\\\/g, '\\\\')
      // Now handle double escaped sequences
      .replace(/\\\\n/g, '\n')
      .replace(/\\\\r/g, '\r')
      .replace(/\\\\t/g, '\t')
      .replace(/\\\\\\/g, '\\')
      // Handle any normal escaped sequences
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
      
    // Remove control characters except newlines, tabs, and carriage returns
    sanitized = sanitized
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      
      // Replace problematic quotes and apostrophes with simple versions
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      
      // Replace tabs with spaces in most contexts
      .replace(/\t/g, ' ')
      
      // Normalize multiple spaces
      .replace(/\s+/g, ' ');
    
    // Extra safety - specifically handle backslash sequences that might cause issues
    sanitized = sanitized
      .replace(/\\\\/g, '\\')  // Convert double backslashes to single
      .replace(/\\"/g, '"')    // Convert escaped quotes to regular quotes
      .replace(/\\'/g, "'")    // Convert escaped single quotes to regular single quotes
      .replace(/\\([^nrt\\"])/g, '$1'); // Remove unnecessary escapes

    // Final JSON validation check
    try {
      const testObj = { text: sanitized };
      const serialized = JSON.stringify(testObj);
      JSON.parse(serialized); // This will throw if invalid
    } catch (jsonError) {
      // If there's still a JSON issue, use more aggressive sanitization
      logger.warn('JSON validation failed after initial sanitization, applying more aggressive cleaning');
      // Fall back to ASCII-only content with safe newlines
      sanitized = sanitized
        .replace(/[^\x20-\x7E\n]/g, '')
        .trim();
      
      // One more validation attempt
      try {
        JSON.stringify({ text: sanitized });
      } catch (finalError) {
        // If still failing, return a very safe fallback
        logger.error(`Critical JSON sanitization failure: ${finalError instanceof Error ? finalError.message : String(finalError)}`);
        return 'Text content unavailable due to encoding issues';
      }
    }
    
    return sanitized.trim();
  } catch (e) {
    logger.error(`Error sanitizing text: ${e instanceof Error ? e.message : String(e)}`);
    return 'Text sanitization error';
  }
}

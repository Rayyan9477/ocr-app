import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

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
        const truncatedText = truncateTextForResponse(testCase.text, 50); // Shorter for testing
        
        return {
          ...testCase,
          originalLength: testCase.text.length,
          sanitizedText,
          sanitizedLength: sanitizedText.length,
          truncatedText,
          truncatedLength: truncatedText.length,
          isSafe: true
        };
      });
      
      // Create a response with the processed test cases - use the validateAndSanitizeResponse
      // to ensure consistent error handling with the main API
      const response = {
        success: true,
        message: "JSON sanitization test completed successfully",
        originalTestCount: data.testCases.length,
        processedTestCount: processedTestCases.length,
        testCases: processedTestCases,
        timestamp: new Date().toISOString()
      };

      // Use the response creation pattern from the main API
      return NextResponse.json(validateAndSanitizeResponse(response));
    }
    
    return NextResponse.json(validateAndSanitizeResponse({
      success: false,
      error: "Invalid test data format",
      message: "The request must include a 'testCases' array"
    }), { status: 400 });
  } catch (error) {
    logger.error(`Error in JSON test endpoint: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({
      success: false,
      error: "Failed to process test request",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Helper function to truncate and sanitize text for JSON responses
 * @param text The text to truncate and sanitize
 * @param maxLength Maximum length before truncation, defaults to 300
 * @returns Truncated and sanitized text
 */
function truncateTextForResponse(text: string | unknown, maxLength: number = 300): string {
  if (text === null || text === undefined) {
    return '';
  }
  
  // Convert to string if not already
  let strText: string;
  try {
    strText = String(text);
  } catch (e) {
    return 'Invalid text content';
  }
  
  try {
    // Handle excessively large text content
    const truncated = strText.length <= maxLength
      ? strText
      : strText.substring(0, maxLength) + '... [truncated - full text available in output file]';
    
    // Always sanitize after truncation to ensure JSON safety
    return sanitizeTextForJson(truncated);
  } catch (error) {
    logger.error(`Error truncating text for response: ${error instanceof Error ? error.message : String(error)}`);
    return 'Text truncation error - content available in output file';
  }
}

/**
 * Sanitize text to be JSON-safe with robust handling of escape sequences
 */
function sanitizeTextForJson(text: string | unknown): string {
  if (text === null || text === undefined) return '';
  
  // Convert to string if not already
  let strText: string;
  try {
    strText = String(text);
  } catch (e) {
    return 'Invalid text content';
  }

  try {
    // First handle multi-level escaped backslashes and sequences that can cause JSON issues
    let sanitized = strText;
    
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
  } catch (error) {
    logger.error(`Error sanitizing text: ${error instanceof Error ? error.message : String(error)}`);
    return 'Error sanitizing text';
  }
}

// Validate and sanitize response data
function validateAndSanitizeResponse(data: unknown): Record<string, unknown> {
  if (data === null || data === undefined) {
    return {
      success: false,
      error: 'No data received from OCR process',
      timestamp: new Date().toISOString()
    };
  }

  const response = typeof data === 'object' && data !== null 
    ? data as Record<string, unknown>
    : { value: data };

  const cleanResponse: Record<string, unknown> = {
    success: Boolean(response?.success),
    timestamp: new Date().toISOString()
  };

  // Add all keys from the original response, but sanitize text and string values
  for (const [key, value] of Object.entries(response)) {
    if (key === 'text' && typeof value === 'string') {
      // Use our improved truncation and sanitization function
      cleanResponse.text = truncateTextForResponse(value, 10000); // 10KB max text length
    } else if (key === 'testCases' && Array.isArray(value)) {
      // Handle test cases array specially - make sure all text fields are sanitized
      cleanResponse.testCases = value.map((testCase: any) => {
        const cleanCase: Record<string, unknown> = {};
        for (const [tcKey, tcValue] of Object.entries(testCase)) {
          if (typeof tcValue === 'string') {
            cleanCase[tcKey] = sanitizeTextForJson(tcValue);
          } else {
            cleanCase[tcKey] = tcValue;
          }
        }
        return cleanCase;
      });
    } else if (typeof value === 'string') {
      // Sanitize all other string values
      cleanResponse[key] = sanitizeTextForJson(value);
    } else {
      // Keep non-string values as-is
      cleanResponse[key] = value;
    }
  }

  // Final validation to ensure JSON is safe
  try {
    const jsonString = JSON.stringify(cleanResponse);
    JSON.parse(jsonString); // This will throw if invalid
    return cleanResponse;
  } catch (jsonError) {
    logger.error(`Failed to create valid JSON response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
    // Return a very safe fallback response
    return {
      success: false,
      error: 'Failed to create valid JSON response',
      timestamp: new Date().toISOString()
    };
  }
}

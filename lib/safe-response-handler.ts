/**
 * Safe Response Handler for OCR API (Client-Side)
 * 
 * This module provides client-side utilities for safely handling large JSON responses
 * and preventing parsing errors due to response size limitations.
 * 
 * NOTE: This is the CLIENT-SIDE version. For server-side utilities, use server-safe-response-handler.ts
 */

// Simple logger for client-side use (will use console methods)
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
};

/**
 * Maximum text length to include in direct API responses before truncating
 */
const MAX_SAFE_TEXT_LENGTH = 500000; // 500KB

/**
 * Maximum response size for safe handling (approx)
 */
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Client-side function to safely parse potentially large JSON responses
 */
export async function safeJsonParse(response: Response): Promise<any> {
  try {
    // Try normal JSON parsing first
    return await response.json();
  } catch (error) {
    console.error('Error parsing JSON response:', error);
    
    // If JSON parsing fails, try to extract essential information using regex
    const text = await response.text();
    
    // Check if the response is extremely large
    if (text.length > 1000000) { // 1MB
      console.warn(`Response is very large (${(text.length/1024/1024).toFixed(2)}MB). This may be causing parsing issues.`);
    }
    
    // Try to extract success status and output file
    try {
      const successMatch = /\"success\":true/.test(text);
      const outputFileMatch = text.match(/\"outputFile\":\"([^\"]+)\"/);
      
      if (successMatch && outputFileMatch && outputFileMatch[1]) {
        console.log(`Successfully extracted output file from response: ${outputFileMatch[1]}`);
        return {
          success: true,
          outputFile: outputFileMatch[1],
          text: "Text too large to display - see PDF for full content",
          details: "Processed successfully but response was too large to parse as JSON"
        };
      }
    } catch (regexError) {
      console.error("Failed extracting data with regex:", regexError);
    }
    
    // If we couldn't extract anything useful, throw an error
    throw new Error('Failed to parse server response. The response may be too large.');
  }
}

/**
 * Estimates the size of a JSON response to check if it might exceed limits (client-side)
 */
export function estimateJsonResponseSize(data: any): number {
  if (!data) return 0;
  
  try {
    // Fast estimation based on text length if present
    if (data.text && typeof data.text === 'string') {
      // Basic estimate: text length plus some overhead for other fields
      return data.text.length + JSON.stringify(data).length - data.text.length;
    }
    
    // Otherwise use full JSON stringification (less efficient)
    return JSON.stringify(data).length;
  } catch (error) {
    logger.error('Error estimating response size:', error);
    return MAX_RESPONSE_SIZE + 1; // Assume it's too large if we can't estimate
  }
}

/**
 * Checks if a response might be too large for safe handling (client-side)
 */
export function isResponseTooLarge(data: any): boolean {
  return estimateJsonResponseSize(data) > MAX_RESPONSE_SIZE;
}

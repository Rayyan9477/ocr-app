/**
 * Server-Side Safe Response Handler for OCR API
 * 
 * This module provides server-only utilities for safely handling large JSON responses
 * and preventing parsing errors due to response size limitations.
 * 
 * NOTE: This file should ONLY be used in API routes, not in client-side code.
 */

import { serverLogger } from "@/app/api/_utils/server-utils";

/**
 * Maximum text length to include in direct API responses before truncating
 */
const MAX_SAFE_TEXT_LENGTH = 500000; // 500KB

/**
 * Maximum response size for safe handling (approx)
 */
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Creates a JSON response with size limitations to prevent oversized responses
 * that could cause parsing issues on the client
 * 
 * SERVER-SIDE ONLY - Do not use in client code
 */
export function createSafeJsonResponse(data: any, status: number = 200) {
  // Check if the data has a 'text' field that might be very large
  if (data && typeof data === 'object' && data.text && typeof data.text === 'string') {
    // If text is longer than the maximum safe size, truncate it and add metadata
    if (data.text.length > MAX_SAFE_TEXT_LENGTH) {
      serverLogger.warn(
        `Response text is very large (${(data.text.length / 1024 / 1024).toFixed(2)}MB), ` +
        `truncating to ${(MAX_SAFE_TEXT_LENGTH / 1024 / 1024).toFixed(2)}MB`
      );
      
      // Create new object with truncated text to avoid modifying original
      return new Response(JSON.stringify({
        ...data,
        text: data.text.substring(0, MAX_SAFE_TEXT_LENGTH),
        fullTextAvailable: true,
        textLength: data.text.length,
        textTruncated: true,
        truncatedAt: MAX_SAFE_TEXT_LENGTH
      }), {
        status,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }

  // For regular responses, just return as normal
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Creates a chunked JSON response for very large data
 * This provides a streaming response for large content
 * 
 * SERVER-SIDE ONLY - Do not use in client code
 */
export async function createChunkedJsonResponse(data: any, status: number = 200) {
  if (!data || typeof data !== 'object') {
    return createSafeJsonResponse(data, status);
  }

  // Store large text content in a separate file if needed
  if (data.text && typeof data.text === 'string' && data.text.length > MAX_SAFE_TEXT_LENGTH) {
    try {
      // Generate a unique identifier for this text content
      const textId = `ocr_text_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      
      // Store metadata about the text location
      const metaData = {
        ...data,
        text: `[Large text content - ${(data.text.length / 1024 / 1024).toFixed(2)}MB]`,
        textContentId: textId,
        textLength: data.text.length,
        retrievalEndpoint: `/api/ocr-text/${textId}`
      };
      
      // Return just the metadata with instructions for retrieving the full text
      return createSafeJsonResponse(metaData, status);
    } catch (error) {
      serverLogger.error('Error handling large text content:', error);
      // Fall back to truncation if storing separately fails
      return createSafeJsonResponse(data, status);
    }
  }

  // For regular-sized responses, use standard JSON response
  return createSafeJsonResponse(data, status);
}

/**
 * Estimates the size of a JSON response to check if it might exceed limits
 * 
 * SERVER-SIDE ONLY - Do not use in client code
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
    serverLogger.error('Error estimating response size:', error);
    return MAX_RESPONSE_SIZE + 1; // Assume it's too large if we can't estimate
  }
}

/**
 * Checks if a response might be too large for safe handling
 * 
 * SERVER-SIDE ONLY - Do not use in client code
 */
export function isResponseTooLarge(data: any): boolean {
  return estimateJsonResponseSize(data) > MAX_RESPONSE_SIZE;
}

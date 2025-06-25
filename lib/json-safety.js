/**
 * JSON safety utilities to prevent API errors
 */

/**
 * Ensures text is safe for JSON serialization
 * 
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
export function sanitizeJsonText(text) {
  if (!text) return '';
  
  try {
    // Apply aggressive sanitization
    let sanitized = String(text)
      // Remove all control characters
      .replace(/[\u0000-\u001F\u007F-\u00A0]/g, '')
      // Replace backslashes
      .replace(/\\/g, '/')
      // Replace quotes
      .replace(/"/g, "'")
      // Remove other problematic characters
      .replace(/[\u2028\u2029\uFEFF\u200B-\u200F]/g, '')
      .trim();
    
    // Test if sanitized text is JSON safe
    JSON.stringify({ test: sanitized });
    
    return sanitized;
  } catch (e) {
    console.warn('JSON sanitization failed, falling back to ASCII-only', e);
    // Fallback to ASCII only
    return String(text).replace(/[^\x20-\x7E\n]/g, '').trim();
  }
}

/**
 * Validates a complete JSON object for safety
 * 
 * @param {Object} obj - Object to check
 * @returns {Object} Safe object
 */
export function validateJsonSafety(obj) {
  try {
    // Try to serialize then parse back
    const serialized = JSON.stringify(obj);
    JSON.parse(serialized);
    
    // If too large, reject it
    if (serialized.length > 5 * 1024 * 1024) { // 5MB limit
      throw new Error('Response too large');
    }
    
    return obj;
  } catch (e) {
    console.error('JSON validation failed, returning minimal safe object', e);
    
    // Minimal safe fallback
    return {
      success: false,
      error: 'JSON validation failed',
      fallback: true,
      message: 'The response could not be safely serialized'
    };
  }
}

/**
 * Creates a JSON-safe version of an OCR result
 * 
 * @param {Object} result - OCR result object
 * @returns {Object} Safe version
 */
export function createSafeOcrResult(result) {
  if (!result) return { success: false, error: 'No result provided' };
  
  // Base64 encode text for safety
  let textEncoded = '';
  
  if (result.text) {
    try {
      textEncoded = Buffer.from(result.text).toString('base64');
    } catch (e) {
      console.warn('Failed to encode text to base64:', e);
    }
  }
  
  // Create minimal safe result
  const safeResult = {
    success: result.success === false ? false : true,
    engine: result.engine || 'unknown',
    outputFile: result.outputFile || `ocr_result_${Date.now()}.pdf`,
    confidence: result.confidence || 0,
    textEncoded,
    encoding: 'base64'
  };
  
  // Add metadata if available
  if (result.processingTime) safeResult.processingTime = result.processingTime;
  if (result.error) safeResult.error = sanitizeJsonText(result.error);
  
  // Add sanitized text if possible
  if (result.text) {
    try {
      safeResult.text = sanitizeJsonText(result.text);
      
      // Double-check if sanitized text is safe
      const testObj = { test: safeResult.text };
      const testSerialized = JSON.stringify(testObj);
      JSON.parse(testSerialized);
    } catch (e) {
      console.warn('Text remains unsafe after sanitization, removing');
      safeResult.text = 'Text only available in base64 encoded form';
    }
  }
  
  return safeResult;
}

export default { sanitizeJsonText, validateJsonSafety, createSafeOcrResult };

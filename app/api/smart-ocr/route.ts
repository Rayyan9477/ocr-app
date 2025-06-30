import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { MultiEngineOCR } from '../../../lib/multi-engine-ocr';
import { DocumentAnalyzer, DocumentAnalysis } from '../../../lib/document-analyzer';
import { initializeDirectories } from '../../../lib/initialize-dirs';
import logger from '../../../lib/logger';

// Types for better type safety

interface OCRResult {
  success: boolean;
  engine: string;
  outputPath?: string;
  text?: string;
  confidence?: number;
  processingTime?: number;
  error?: string | Error;
  warning?: string | null;
  [key: string]: unknown; // Allow additional properties
}

type ExtendedOCRResult = OCRResult & Record<string, unknown>;

// Default OCR result
const DEFAULT_OCR_RESULT: OCRResult = {
  success: false,
  engine: 'unknown',
  text: '',
  confidence: 0,
  processingTime: 0,
  error: 'OCR processing failed'
};

// Initialize directories on module load
try {
  initializeDirectories();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`Failed to initialize directories: ${errorMessage}`);
  throw new Error('Failed to initialize application directories');
}

// Initialize OCR components
const multiEngineOCR = new MultiEngineOCR();
const documentAnalyzer = new DocumentAnalyzer();

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const responseHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

// Helper function to create error responses with size limits and ensure valid JSON
const createErrorResponse = (message: string, details?: string): Record<string, unknown> => {
  // Ensure we have a valid message
  const safeMessage = typeof message === 'string' ? message : 'Unknown error';
  
  // Create a minimal error response first
  const errorResponse: Record<string, unknown> = {
    success: false,
    error: '',
    timestamp: new Date().toISOString()
  };

  // Safely truncate and add error message
  try {
    errorResponse.error = safeMessage.length > 200 
      ? safeMessage.substring(0, 197) + '...' 
      : safeMessage;
  } catch (e) {
    errorResponse.error = 'Error processing error message';
  }

  // Safely add details if provided
  if (details) {
    try {
      const safeDetails = typeof details === 'string' 
        ? (details.length > 500 ? details.substring(0, 497) + '...' : details)
        : String(details);
      errorResponse.details = safeDetails;
    } catch (e) {
      // If we can't process details, omit them
    }
  }

  // Final validation to ensure we can stringify
  try {
    JSON.stringify(errorResponse);
    return errorResponse;
  } catch (e) {
    // Fallback to minimal valid response if stringification fails
    return {
      success: false,
      error: 'An error occurred',
      timestamp: new Date().toISOString()
    };
  }
};

// Safety wrapper for JSON response creation with size limits
const createSafeJsonResponse = (data: unknown, status: number = 200): NextResponse => {
  // Create a minimal safe response that's guaranteed to be valid JSON
  const createMinimalSafeResponse = (error: string, statusCode: number = 500) => {
    const minimalResponse = {
      success: false,
      error: error.length > 200 ? error.substring(0, 197) + '...' : error,
      timestamp: new Date().toISOString()
    };
    const jsonString = JSON.stringify(minimalResponse);
    return new NextResponse(jsonString, {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(jsonString, 'utf8').toString()
      }
    });
  };

  try {
    // First, ensure we have a valid object
    let responseData: Record<string, unknown>;
    
    if (data === null || data === undefined) {
      return createMinimalSafeResponse('No data provided for response');
    }
    
    // Handle different data types
    if (typeof data === 'object' && data !== null) {
      try {
        responseData = {};
        // Safely copy properties
        for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
          responseData[key] = value;
        }
      } catch (entryError) {
        logger.error(`Error in Object.entries: ${entryError instanceof Error ? entryError.message : String(entryError)}`);
        responseData = { error: 'Failed to process object data', originalType: typeof data };
      }
    } else {
      responseData = { value: String(data) };
    }
    
    // Ensure required fields exist
    if (responseData.success === undefined) {
      responseData.success = status >= 200 && status < 400;
    }
    
    if (!responseData.timestamp) {
      responseData.timestamp = new Date().toISOString();
    }
    
    // Sanitize the response data
    const sanitizedData = sanitizeResponseObject(responseData);
    
    // Generate JSON with size checking
    let jsonString: string;
    try {
      jsonString = JSON.stringify(sanitizedData);
      
      // Check response size and truncate if necessary (500KB limit to be safe)
      const maxResponseSize = 500 * 1024;
      if (jsonString.length > maxResponseSize) {
        logger.warn(`Response too large (${jsonString.length} bytes), creating truncated response`);
        
        // Create a minimal response with only essential fields
        const minimalResponse: Record<string, unknown> = {
          success: sanitizedData.success || false,
          engine: sanitizedData.engine || 'unknown',
          outputFile: sanitizedData.outputFile || '',
          confidence: sanitizedData.confidence || 0,
          processingTime: sanitizedData.processingTime || 0,
          timestamp: sanitizedData.timestamp || new Date().toISOString(),
          warning: 'Response was truncated due to size limits. Full content available in output file.'
        };
        
        // Only include error if it exists
        if (sanitizedData.error) {
          const error = String(sanitizedData.error);
          minimalResponse.error = error.length > 500 ? error.substring(0, 497) + '...' : error;
        }
        
        // Force stringify to ensure it's valid JSON
        jsonString = JSON.stringify(minimalResponse);
      }
      
      // Verify by parsing
      JSON.parse(jsonString);
      
      return new NextResponse(jsonString, {
        status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(jsonString, 'utf8').toString()
        }
      });
      
    } catch (jsonError) {
      logger.error(`JSON generation failed: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
      return createMinimalSafeResponse('Failed to generate valid JSON response');
    }
    
  } catch (error) {
    logger.error(`Critical response creation error: ${error instanceof Error ? error.message : String(error)}`);
    return createMinimalSafeResponse('Internal Server Error');
  }
};

// Helper function to detect if a value is a plain object
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
};

// Helper function to safely get string representation of any value
const safeStringify = (value: unknown): string => {
  try {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Error) return value.message || 'Error';
    if (value instanceof Date) return value.toISOString();
    return JSON.stringify(value, (_, val) => 
      typeof val === 'bigint' ? val.toString() : val
    );
  } catch (e) {
    return '[Unable to stringify value]';
  }
};

// Helper function to recursively sanitize all values in an object while handling circular references
function sanitizeResponseObject(obj: unknown, seen = new WeakSet()): any {
  // Handle primitives and null/undefined
  if (obj === null || obj === undefined) {
    return null;
  }
  
  // Handle strings
  if (typeof obj === 'string') {
    return sanitizeTextForJson(obj);
  }
  
  // Handle numbers, booleans
  if (typeof obj !== 'object') {
    return obj;
  }
  
  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    // Limit array size to prevent huge responses
    const maxArrayLength = 100;
    try {
      const limitedArray = obj.length > maxArrayLength 
        ? obj.slice(0, maxArrayLength).concat([`[${obj.length - maxArrayLength} more items...]`])
        : obj;
      
      return limitedArray.map(item => sanitizeResponseObject(item, seen));
    } catch (arrayError) {
      logger.error(`Error processing array: ${arrayError instanceof Error ? arrayError.message : String(arrayError)}`);
      return [`[Array processing error: ${obj.length} items]`];
    }
  }
  
  // Handle plain objects with circular reference detection
  if (isPlainObject(obj)) {
    // Check for circular references
    if (seen.has(obj)) {
      return '[Circular Reference]';
    }
    
    // Add current object to seen set
    seen = new WeakSet(seen);
    seen.add(obj);
    
    const result: Record<string, unknown> = {};
    let entries: [string, unknown][];
    
    try {
      entries = Object.entries(obj);
    } catch (entriesError) {
      logger.error(`Error getting object entries: ${entriesError instanceof Error ? entriesError.message : String(entriesError)}`);
      return '[Object entries error]';
    }
    
    // Limit number of properties to prevent huge responses
    const maxProperties = 50;
    const limitedEntries = entries.length > maxProperties 
      ? entries.slice(0, maxProperties).concat([['_truncated', `[${entries.length - maxProperties} more properties...]`]])
      : entries;
    
    for (const [key, value] of limitedEntries) {
      // Skip functions and undefined
      if (typeof value === 'function' || value === undefined) {
        continue;
      }
      
      try {
        // Special handling for common complex objects
        if (value instanceof Error) {
          result[key] = {
            message: value.message,
            name: value.name,
            stack: process.env.NODE_ENV === 'development' ? value.stack : undefined
          };
        } else {
          result[key] = sanitizeResponseObject(value, seen);
        }
      } catch (error) {
        // If processing a property fails, use a safe string representation
        logger.warn(`Failed to sanitize property ${key}: ${error}`);
        result[key] = `[Error: ${safeStringify(error).substring(0, 200)}]`;
      }
    }
    
    return result;
  }
  
  // For any other object types, return a string representation
  return safeStringify(obj).substring(0, 500); // Limit string length
}

/**
 * Validate and sanitize response data
 */
export function validateAndSanitizeResponse(data: unknown): Record<string, unknown> {
  if (data === null || data === undefined) {
    return createErrorResponse('No data received from OCR process') as Record<string, unknown>;
  }

  try {
    // Handle stringified JSON that wasn't properly parsed
    let processedData = data;
    if (typeof data === 'string') {
      try {
        processedData = JSON.parse(data);
        logger.info('Successfully parsed string data as JSON');
      } catch (e) {
        logger.warn(`Failed to parse string as JSON: ${e instanceof Error ? e.message : String(e)}`);
        // Continue with string data, will be wrapped in value property below
      }
    }

    const response = typeof processedData === 'object' && processedData !== null 
      ? processedData as Record<string, unknown>
      : { value: processedData };

    // Create a sanitized response with only the essential fields
    const cleanResponse: Record<string, unknown> = {
      success: Boolean(response?.success),
      timestamp: new Date().toISOString()
    };

    // Add required fields with sanitization
    if ('engine' in response) {
      cleanResponse.engine = String(response.engine || 'unknown');
    }
    
    if ('outputFile' in response) {
      cleanResponse.outputFile = String(response.outputFile || '');
    }
    
    if ('confidence' in response) {
      cleanResponse.confidence = Number.isFinite(Number(response.confidence)) 
        ? Math.max(0, Math.min(1, Number(response.confidence)))
        : 0;
    }
    
    if ('processingTime' in response) {
      cleanResponse.processingTime = Number.isFinite(Number(response.processingTime))
        ? Math.max(0, Number(response.processingTime))
        : 0;
    }
    
    // Handle text content with size limits and sanitization
    if ('text' in response && response.text !== undefined) {
      try {
        const responseText = String(response.text);
        // Use a conservative text length limit to ensure JSON response size is manageable
        cleanResponse.text = sanitizeTextForJson(responseText.substring(0, 200)); // 200 bytes max text length
      } catch (textError) {
        cleanResponse.text = '';
        cleanResponse.textError = 'Text sanitization failed';
      }
    } else {
      cleanResponse.text = '';
    }

    // Add optional fields with sanitization
    if ('error' in response && response.error !== undefined) {
      cleanResponse.error = sanitizeTextForJson(String(response.error));
    }
    
    if ('warning' in response && response.warning !== undefined) {
      cleanResponse.warning = sanitizeTextForJson(String(response.warning));
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
  } catch (finalError) {
    logger.error(`Critical response sanitization error: ${finalError instanceof Error ? finalError.message : String(finalError)}`);
    return {
      success: false,
      error: 'Critical error sanitizing response',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Create OCR response with proper formatting
 */
export async function createOCRResponse(result: unknown): Promise<Record<string, unknown>> {
  if (!result) {
    return validateAndSanitizeResponse({
      success: false,
      error: 'No result from OCR process'
    });
  }
  
  // Early return for error cases to minimize response size
  const resultObj = result as Record<string, unknown>;
  if (resultObj.error) {
    return validateAndSanitizeResponse({
      success: false,
      error: String(resultObj.error || 'Unknown error occurred during OCR processing'),
      engine: String(resultObj.engine || 'unknown')
    });
  }

  const outputPath = safeGet(resultObj, 'outputPath', '');
  
  if (!outputPath || !fs.existsSync(outputPath)) {
    return validateAndSanitizeResponse({
      success: false,
      error: 'Output file was not generated or is missing.',
      engine: safeGet<string>(resultObj, 'engine', 'unknown')
    });
  }

  const outputFilename = path.basename(String(outputPath));
  const permanentDir = path.join(process.cwd(), 'public', 'output');
  const permanentPath = path.join(permanentDir, outputFilename);

  try {
    // Ensure the permanent output directory exists
    await fs.promises.mkdir(permanentDir, { recursive: true });
    // Move the file from the temporary location to the permanent one
    await fs.promises.rename(outputPath, permanentPath);
    logger.info(`Moved processed file to ${permanentPath}`);
  } catch (moveError) {
    logger.error(`Failed to move processed file: ${moveError}`);
    return validateAndSanitizeResponse({
      success: false,
      error: 'Failed to make output file available for download.',
      engine: safeGet<string>(resultObj, 'engine', 'unknown')
    });
  }

  // The new output file path for the client is a public URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
  const publicUrl = `${baseUrl}/output/${outputFilename}`;

  // Process text content with proper error handling and JSON safety
  let processedText = '';
  try {
    const text = safeGet<string>(resultObj, 'text', '');
    if (text) {
      // Use a much smaller maximum length to avoid response size issues
      const maxLength = 200; // Conservative 200 byte limit for text content
      processedText = truncateTextForResponse(text, maxLength);
      
      // Log warning if text was very large
      if (String(text).length > maxLength) {
        logger.warn(`Large text truncated from ${String(text).length} to ${maxLength} characters`);
      }
    }
  } catch (textError) {
    const error = textError as Error;
    const errorMessage = `Error processing text content: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMessage);
    processedText = 'Error processing text content';
    // Ensure we still return a valid response even if text processing fails
    return {
      success: false,
      error: errorMessage,
      engine: safeGet<string>(resultObj, 'engine', 'unknown'),
      text: 'Error processing text content',
      confidence: 0,
      processingTime: 0,
      timestamp: new Date().toISOString()
    };
  }

  // Build response object with safe property access and correct type handling
  // Build minimal response object first
  const response: Record<string, unknown> = {
    success: safeGet<boolean>(resultObj, 'success', false) === true,
    engine: String(safeGet<string>(resultObj, 'engine', 'unknown')),
    outputFile: publicUrl, // Return the public URL for download
    confidence: Math.max(0, Math.min(1, Number(safeGet<number | string>(resultObj, 'confidence', 0)) || 0)),
    processingTime: Math.max(0, Number(safeGet<number | string>(resultObj, 'processingTime', 0)) || 0),
    timestamp: new Date().toISOString()
  };
  
  // Only add text if it's not too large
  if (processedText && processedText.length <= 5000) { // 5KB max for text in response
    response.text = processedText;
  } else if (processedText) {
    response.text = processedText.substring(0, 5000) + '... [truncated - full text available in output file]';
    response.note = 'Text was truncated in response. Download the output file for full text.';
  }

  // Add error if present
  const error = safeGet<unknown>(resultObj, 'error', null);
  if (error !== null && error !== undefined) {
    response.error = isErrorWithMessage(error) ? error.message : String(error);
  }

  // Add warning if present
  const warning = safeGet<unknown>(resultObj, 'warning', null);
  if (warning !== null && warning !== undefined) {
    response.warning = String(warning);
  }

  return validateAndSanitizeResponse(response);
};

// Type guard for error objects
function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

// Helper to safely access object properties
function safeGet<T>(obj: unknown, key: string, defaultValue: T): T {
  if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
    const value = (obj as Record<string, unknown>)[key];
    return (value !== undefined && value !== null) ? (value as T) : defaultValue;
  }
  return defaultValue;
}

/**
 * Select the appropriate default OCR engine based on file type
 */
async function selectDefaultEngineForFile(inputPath: string, outputDir: string, analysis: DocumentAnalysis): Promise<OCRResult> {
  if (!inputPath || !outputDir) {
    throw new Error('Input and output paths are required');
  }

  const isPdf = inputPath.toLowerCase().endsWith('.pdf');
  // Use analysis to select engine, with fallback
  const engine = analysis.customizations?.ocrEngine || (isPdf ? 'ocrmypdf' : 'tesseract');
  const documentType = analysis.documentType || 'regular';
  
  try {
    logger.info(`${isPdf ? 'PDF' : 'Image'} file detected, document type: ${documentType}, using ${engine.toUpperCase()} engine`);
    const result = await multiEngineOCR.processWithEngine(engine, inputPath, outputDir, documentType);
    
    // Ensure the result has required fields
    const safeResult = typeof result === 'object' && result !== null ? result : {};
    return {
      ...DEFAULT_OCR_RESULT,
      ...safeResult,
      success: true,
      engine
    };
  } catch (error) {
    logger.error(`${engine.toUpperCase()} failed: ${error instanceof Error ? error.message : String(error)}`);
    
    if (isPdf) {
      // Try fallback to nanoVLM for PDFs
      try {
        logger.info('Trying nanoVLM as fallback for PDF');
        const fallbackResult = await multiEngineOCR.processWithEngine('nanovlm', inputPath, outputDir);
        const safeFallback = typeof fallbackResult === 'object' && fallbackResult !== null ? fallbackResult : {};
        return {
          ...DEFAULT_OCR_RESULT,
          ...safeFallback,
          success: true,
          engine: 'nanovlm',
          warning: 'Used nanoVLM as fallback'
        };
      } catch (fallbackError) {
        logger.error(`NanoVLM fallback also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        throw new Error('No suitable PDF OCR engine available');
      }
    }
    
    throw error; // Re-throw for non-PDF files
  }
}

/**
 * Helper function to truncate and sanitize text for JSON responses
 * @param text The text to truncate and sanitize
 * @param maxLength Maximum length before truncation, defaults to 500
 * @returns Truncated and sanitized text
 */
function truncateTextForResponse(text: string | unknown, maxLength: number = 200): string {
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

  // Early return for empty strings
  if (!strText || strText.length === 0) return '';

  try {
    // Remove control characters first (except common ones)
    let sanitized = strText
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      .replace(/[\uFEFF\uFFFE\uFFFF]/g, ''); // Remove BOM and other problematic unicode

    // Replace problematic quotes and apostrophes with simple versions
    sanitized = sanitized
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
      
    // Normalize line breaks and whitespace
    sanitized = sanitized
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' '); // Collapse multiple spaces
    
    // Handle escape sequences more conservatively
    sanitized = sanitized
      .replace(/\\\\/g, '\\')  // Convert double backslashes to single
      .replace(/\\"/g, '"')    // Convert escaped quotes to regular quotes
      .replace(/\\'/g, "'");   // Convert escaped single quotes to regular single quotes

    // Final validation - try to create a JSON object
    try {
      const testObj = { text: sanitized };
      JSON.stringify(testObj);
      return sanitized.trim();
    } catch (jsonError) {
      // If JSON validation fails, use ASCII-only fallback
      logger.warn('JSON validation failed, using ASCII-only fallback');
      const asciiOnly = sanitized
        .replace(/[^\x20-\x7E\n]/g, '') // Keep only printable ASCII + newlines
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Collapse spaces
        .trim();
      
      // Final test
      try {
        JSON.stringify({ text: asciiOnly });
        return asciiOnly;
      } catch (finalError) {
        logger.error(`Critical JSON sanitization failure: ${finalError instanceof Error ? finalError.message : String(finalError)}`);
        return 'Text content unavailable due to encoding issues';
      }
    }
  } catch (error) {
    logger.error(`Error sanitizing text: ${error instanceof Error ? error.message : String(error)}`);
    return 'Error sanitizing text';
  }
}

// Helper function to ensure safe JSON response
function sanitizeAndValidateJson(data: unknown): Record<string, unknown> {
  // Create base response structure
  const safeResponse: Record<string, unknown> = {
    success: false,
    timestamp: new Date().toISOString()
  };

  try {
    if (typeof data === 'object' && data !== null) {
      const input = data as Record<string, unknown>;
      
      // Copy safe fields with validation
      if ('success' in input) safeResponse.success = Boolean(input.success);
      if ('engine' in input) safeResponse.engine = String(input.engine || 'unknown');
      if ('outputFile' in input) safeResponse.outputFile = String(input.outputFile || '');
      if ('confidence' in input) {
        const conf = Number(input.confidence);
        safeResponse.confidence = Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0;
      }
      if ('processingTime' in input) {
        const time = Number(input.processingTime);
        safeResponse.processingTime = Number.isFinite(time) ? Math.max(0, time) : 0;
      }
      
      // Handle text content safely
      if ('text' in input && input.text) {
        const text = String(input.text);
        if (text.length > 5000) {
          safeResponse.text = text.substring(0, 5000) + '... [truncated]';
          safeResponse.textTruncated = true;
        } else {
          safeResponse.text = text;
        }
      }

      // Handle errors and warnings
      if ('error' in input) safeResponse.error = String(input.error).substring(0, 500);
      if ('warning' in input) safeResponse.warning = String(input.warning).substring(0, 500);
    }

    // Final validation
    const jsonString = JSON.stringify(safeResponse);
    JSON.parse(jsonString); // Will throw if invalid
    return safeResponse;
  } catch (error) {
    return {
      success: false,
      error: 'Failed to create valid JSON response',
      timestamp: new Date().toISOString()
    };
  }
}

// Helper function to validate analysis data
function validateAnalysisData(analysis: unknown): Record<string, unknown> {
  const defaultAnalysis = {
    documentType: 'regular',
    pageCount: 0,
    containsImages: false,
    containsText: false,
    quality: {
      dpi: 0,
      clarity: 0
    }
  };

  if (!analysis || typeof analysis !== 'object') {
    return defaultAnalysis;
  }

  const validated: Record<string, unknown> = {};
  const source = analysis as Record<string, unknown>;

  // Validate and sanitize each field
  validated.documentType = typeof source.documentType === 'string' ? source.documentType : 'regular';
  validated.pageCount = typeof source.pageCount === 'number' && source.pageCount > 0 ? source.pageCount : 0;
  validated.containsImages = Boolean(source.containsImages);
  validated.containsText = Boolean(source.containsText);
  
  // Ensure quality metrics are valid numbers
  validated.quality = {
    dpi: typeof source.quality?.dpi === 'number' ? Math.max(0, source.quality.dpi) : 0,
    clarity: typeof source.quality?.clarity === 'number' ? Math.max(0, Math.min(1, source.quality.clarity)) : 0
  };

  return validated;
}

// Helper function to create safe JSON response
function createSafeJsonResponse(data: unknown): NextResponse {
  try {
    // Deep clone the data to avoid mutation
    const response = structuredClone(data) as Record<string, unknown>;

    // Ensure required fields with valid values
    response.success = Boolean(response.success);
    response.engine = String(response.engine || 'unknown');
    response.outputFile = String(response.outputFile || '');
    response.confidence = typeof response.confidence === 'number' ? 
      Math.max(0, Math.min(1, response.confidence)) : 0;
    response.processingTime = typeof response.processingTime === 'number' ? 
      Math.max(0, response.processingTime) : 0;
    response.timestamp = new Date().toISOString();

    // Validate and sanitize analysis data
    if (response.analysis) {
      response.analysis = validateAnalysisData(response.analysis);
    }

    // Handle text content safely
    if (response.text) {
      const text = String(response.text);
      if (text.length > 1000) {
        response.text = text.substring(0, 1000) + '... [truncated]';
        response._truncated = true;
      }
    }

    // Final validation
    const jsonString = JSON.stringify(response);
    JSON.parse(jsonString); // Will throw if invalid

    return new NextResponse(jsonString, {
      status: response.success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    // Fallback to minimal valid response
    console.error('Error creating JSON response:', error);
    return new NextResponse(
      JSON.stringify({
        success: false,
        engine: 'unknown',
        error: 'Failed to create valid JSON response',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );
  }
}

// Use in the POST handler
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Set up error handling for the entire request
  let ocrResult: OCRResult | null = null;
  let inputPath = '';
  let outputPath = '';
  let outputDir = '';
  let result: OCRResult | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    // Check for file upload
    if (!file) {
      return createSafeJsonResponse(
        createErrorResponse('No file uploaded'),
        400
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return createSafeJsonResponse(
        createErrorResponse('File size exceeds the limit of 10MB'),
        400
      );
    }

    // Save the uploaded file to a temporary location
    const tempDir = await fs.promises.mkdtemp(path.join(process.cwd(), 'temp-'));
    const tempFile = path.join(tempDir, file.name);
    const fileBuffer = await file.arrayBuffer();
    await fs.promises.writeFile(tempFile, Buffer.from(fileBuffer));

    // Set input and output paths
    inputPath = tempFile;
    outputDir = tempDir;

    // Analyze the document before processing
    const analysisResult = await documentAnalyzer.analyzeDocument(inputPath);
    logger.info(`Document analysis result: ${JSON.stringify(analysisResult, null, 2)}`);

    // Process with the default engine, now with analysis context
    result = await selectDefaultEngineForFile(inputPath, outputDir, analysisResult);

    // Log processing completion
    const resultSummary = {
      success: result?.success ?? false,
      engine: result?.engine ?? 'unknown',
      hasOutputPath: !!(result?.outputPath),
      textLength: result?.text?.length || 0,
      confidence: result?.confidence ?? 0,
      processingTime: result?.processingTime ?? 0
    };
    
    logger.info(`OCR processing completed. Result summary: ${JSON.stringify(resultSummary, null, 2)}`);
    
    // Create and validate the response
    logger.info(`Creating OCR response from result type: ${typeof result}, success: ${result?.success}`);
    const response = await createOCRResponse(result);
    logger.info(`OCR response created successfully with keys: ${Object.keys(response).join(', ')}`);
    
    // Create a minimal analysis result to include in response
    let minimalAnalysis = null;
    try {
      minimalAnalysis = analysisResult ? {
        documentType: analysisResult.documentType,
        pageCount: analysisResult.pageCount,
        containsImages: analysisResult.containsImages,
        containsText: analysisResult.containsText,
        // Skip any large data structures
        _info: 'Analysis details available in output file'
      } : null;
      logger.info(`Created minimal analysis: ${JSON.stringify(minimalAnalysis)}`);
    } catch (analysisError) {
      logger.error(`Error creating minimal analysis: ${analysisError}`);
      minimalAnalysis = { error: 'Analysis processing failed' };
    }
    
    // Build final response with proper sanitization - avoid complex object processing
    let finalResponse: Record<string, unknown>;
    try {
      finalResponse = {
        // Include only essential fields from the response - manually construct to avoid iteration issues
        success: Boolean(response.success),
        engine: String(response.engine || 'unknown'),
        outputFile: String(response.outputFile || ''),
        confidence: Number(response.confidence || 0),
        processingTime: Number(response.processingTime || 0),
        timestamp: String(response.timestamp || new Date().toISOString()),
        // Add analysis with size limits - simple object construction
        analysis: minimalAnalysis,
        // Add a note about truncated data
        _note: (response.text && String(response.text).length > 5000) 
          ? 'Text was truncated in response. Download the output file for full text.'
          : 'For detailed analysis, download the output file.'
      };
      
      // Add error/warning if present - simple string assignment
      if (response.error) {
        finalResponse.error = String(response.error).substring(0, 500);
      }
      if (response.warning) {
        finalResponse.warning = String(response.warning).substring(0, 500);
      }
      
      logger.info(`Final response constructed with manual field assignment`);
      
    } catch (constructionError) {
      logger.error(`Error constructing final response: ${constructionError}`);
      // Ultra-safe fallback
      finalResponse = {
        success: false,
        error: 'Response construction failed',
        engine: 'unknown',
        timestamp: new Date().toISOString()
      };
    }
    
    // Return the response with proper error handling
    try {
      // Double-check that the response can be serialized - simplified approach
      logger.info(`About to stringify final response with keys: ${Object.keys(finalResponse).join(', ')}`);
      
      // Simple JSON stringification without complex sanitization
      const jsonString = JSON.stringify(finalResponse, (key, value) => {
        // Simple replacer function to handle problematic values
        if (value === undefined) return null;
        if (typeof value === 'function') return '[Function]';
        if (typeof value === 'bigint') return value.toString();
        if (value instanceof Error) return value.message;
        return value;
      });
      
      // Verify by parsing back
      const testResponse = JSON.parse(jsonString);
      
      return new NextResponse(jsonString, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(jsonString, 'utf8').toString()
        }
      });
      
    } catch (jsonError) {
      logger.error(`Final response validation failed: ${jsonError}`);
      logger.error(`Response object type: ${typeof finalResponse}, keys: ${finalResponse ? Object.keys(finalResponse).join(', ') : 'none'}`);
      
      // Fallback to minimal response if serialization fails
      const fallbackResponse = {
        success: false,
        error: 'Failed to generate response',
        outputFile: typeof response === 'object' && response && 'outputFile' in response ? String(response.outputFile) : '',
        timestamp: new Date().toISOString()
      };
      
      const fallbackJson = JSON.stringify(fallbackResponse);
      return new NextResponse(fallbackJson, {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
    }
  } catch (error) {
    // Log the full error for debugging
    const errorMessage = error instanceof Error 
      ? `${error.message}\n${error.stack || 'No stack trace available'}`
      : String(error);
      
    logger.error(`Error processing request: ${errorMessage}`);
    
    // Log error details for debugging the iteration issue
    if (error instanceof Error && error.message.includes('iterable')) {
      logger.error(`Iteration error stack trace: ${error.stack}`);
      logger.error(`Request processing failed at iteration step`);
    }
    
    // Create a safe error response
    const safeError = createErrorResponse(
      'Failed to process request',
      error instanceof Error ? error.message : 'An unknown error occurred'
    );
    
    // Ensure we can safely stringify the error response
    try {
      JSON.stringify(safeError);
      return createSafeJsonResponse(safeError, 500);
    } catch (jsonError) {
      // If we can't stringify the error, use a minimal safe response
      logger.error(`Failed to stringify error response: ${jsonError}`);
      return createSafeJsonResponse(
        {
          success: false,
          error: 'An error occurred while processing your request',
          timestamp: new Date().toISOString()
        },
        500
      );
    }
  } finally {
    // Clean up the uploaded file and output directory
    try {
      if (inputPath && fs.existsSync(inputPath)) {
        await fs.promises.unlink(inputPath).catch(err => 
          logger.warn(`Failed to clean up input file: ${err}`)
        );
      }
      
      if (outputDir && fs.existsSync(outputDir)) {
        await fs.promises.rm(outputDir, { recursive: true, force: true }).catch(err => 
          logger.warn(`Failed to clean up output directory: ${err}`)
        );
      }
    } catch (cleanupError) {
      logger.warn(`Error during cleanup: ${cleanupError}`);
    }
  }
}

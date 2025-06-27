import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { MultiEngineOCR } from '../../../lib/multi-engine-ocr';
import { DocumentAnalyzer } from '../../../lib/document-analyzer';
import { initializeDirectories } from '../../../lib/initialize-dirs';
import logger from '../../../lib/logger';

// Types for better type safety
interface DocumentAnalysis {
  hasHandwriting: boolean;
  hasTables: boolean;
  poorQuality: boolean;
  complexLayout: boolean;
  confidence: {
    handwriting: number;
    tables: number;
    quality: number;
    layout: number;
  };
  isHandwritten?: boolean; // For backward compatibility
  hasComplexLayout?: boolean; // For backward compatibility
}

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

interface DocumentAnalysisResult {
  hasHandwriting: boolean;
  hasTables: boolean;
  poorQuality: boolean;
  complexLayout: boolean;
  confidence: {
    handwriting: number;
    tables: number;
    quality: number;
    layout: number;
  };
}

// Default analysis result
const DEFAULT_ANALYSIS: DocumentAnalysisResult = {
  hasHandwriting: false,
  hasTables: false,
  poorQuality: false,
  complexLayout: false,
  confidence: {
    handwriting: 0,
    tables: 0,
    quality: 0,
    layout: 0
  }
};

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

// Helper function to create error responses
const createErrorResponse = (message: string, details?: string) => ({
  success: false,
  error: message,
  details: details || null,
  timestamp: new Date().toISOString()
});

// Safety wrapper for JSON response creation
const createSafeJsonResponse = (data: any, status: number = 200): NextResponse => {
  try {
    // First try to sanitize the data
    const sanitizedData = typeof data === 'object' ? sanitizeResponseObject(data) : { value: String(data) };
    
    // Try to generate JSON
    let jsonString: string;
    try {
      jsonString = JSON.stringify(sanitizedData);
      // Verify by parsing
      JSON.parse(jsonString);
    } catch (jsonError) {
      // If JSON generation fails, create a minimal safe response
      logger.error(`JSON generation failed: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
      jsonString = JSON.stringify({
        success: false,
        error: "Failed to generate valid JSON response",
        timestamp: new Date().toISOString()
      });
    }
    
    return new NextResponse(jsonString, {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    // Ultimate fallback for catastrophic failures
    logger.error(`Critical response creation error: ${error instanceof Error ? error.message : String(error)}`);
    return new NextResponse(
      '{"success":false,"error":"Internal Server Error","timestamp":"'+new Date().toISOString()+'"}',
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Helper function to recursively sanitize all string values in an object
function sanitizeResponseObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (typeof obj === 'string') {
    // Sanitize strings
    return sanitizeTextForJson(obj);
  }
  
  if (Array.isArray(obj)) {
    // Sanitize arrays
    return obj.map(item => sanitizeResponseObject(item));
  }
  
  if (typeof obj === 'object') {
    // Sanitize objects recursively
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip functions and undefined values
      if (typeof value !== 'function' && value !== undefined) {
        try {
          result[key] = sanitizeResponseObject(value);
        } catch (error) {
          // If processing a property fails, substitute a safe value
          logger.warn(`Failed to sanitize property ${key}: ${error}`);
          result[key] = typeof value === 'object' ? null : String(value).substring(0, 100);
        }
      }
    }
    return result;
  }
  
  // Return primitives directly
  return obj;
}

// Helper function to sanitize text for JSON safety
function sanitizeTextForJson(text: string): string {
  if (text === null || text === undefined) return '';
  
  try {
    // Get safe string length
    const maxLength = 100000; // 100KB max to avoid excessive processing
    const truncated = text.length > maxLength ? 
      text.substring(0, maxLength) + '... [truncated]' : text;
    
    // Handle multi-level escaped sequences
    let sanitized = truncated;
    
    // First, normalize all line endings
    sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remove control characters except line breaks
    sanitized = sanitized.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
    
    // Extra safety - check if valid JSON can be created
    try {
      JSON.stringify({ test: sanitized });
      return sanitized;
    } catch (error) {
      // If that fails, be more aggressive
      return sanitized
        .replace(/[^\x20-\x7E\n]/g, '') // ASCII only with newlines
        .replace(/\\(?!["\\/bfnrtu])/g, '\\\\'); // Escape backslashes
    }
  } catch (error) {
    logger.error(`Failed to sanitize text: ${error}`);
    return ''; // Empty string as ultimate fallback
  }
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
        // Use our improved truncation and sanitization function
        cleanResponse.text = sanitizeTextForJson(responseText.substring(0, 10000)); // 10KB max text length
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

  const resultObj = result as Record<string, unknown>;
  const outputPath = safeGet(resultObj, 'outputPath', '');
  const outputFilename = outputPath ? path.basename(String(outputPath)) : 'unknown.pdf';

  // Process text content with proper error handling and JSON safety
  let processedText = '';
  try {
    const text = safeGet<string>(resultObj, 'text', '');
    if (text) {
      // Use the improved truncation and sanitization function
      const maxLength = 10000; // Use a safer maximum length to avoid response size issues
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
  // Build response object with type safety
  const response: Record<string, unknown> = {
    success: safeGet<boolean>(resultObj, 'success', false) === true,
    engine: String(safeGet<string>(resultObj, 'engine', 'unknown')),
    outputFile: outputFilename,
    confidence: Math.max(0, Math.min(1, Number(safeGet<number | string>(resultObj, 'confidence', 0)) || 0)),
    text: processedText,
    processingTime: Math.max(0, Number(safeGet<number | string>(resultObj, 'processingTime', 0)) || 0),
    timestamp: new Date().toISOString()
  };

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
async function selectDefaultEngineForFile(inputPath: string, outputDir: string): Promise<OCRResult> {
  if (!inputPath || !outputDir) {
    throw new Error('Input and output paths are required');
  }

  const isPdf = inputPath.toLowerCase().endsWith('.pdf');
  const engine = isPdf ? 'ocrmypdf' : 'tesseract';
  
  try {
    logger.info(`${isPdf ? 'PDF' : 'Image'} file detected, using ${engine.toUpperCase()} engine`);
    const result = await multiEngineOCR.processWithEngine(engine, inputPath, outputDir);
    
    // Ensure the result has required fields
    return {
      ...DEFAULT_OCR_RESULT,
      ...result,
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
        return {
          ...DEFAULT_OCR_RESULT,
          ...fallbackResult,
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

  // Handle the case when text is already a stringified JSON
  try {
    // Check if the text is already a JSON string
    const parsed = JSON.parse(strText);
    if (typeof parsed === 'object' && parsed !== null) {
      // It's a valid JSON string, return the original text
      return strText;
    }
  } catch (e) {
    // Not a JSON string, continue with normal sanitization
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

    try {
      // Save the uploaded file to a temporary location
      const tempDir = await fs.promises.mkdtemp(path.join(process.cwd(), 'temp-'));
      const tempFile = path.join(tempDir, file.name);
      const fileBuffer = await file.arrayBuffer();
      await fs.promises.writeFile(tempFile, Buffer.from(fileBuffer));

      // Set input and output paths
      inputPath = tempFile;
      outputDir = tempDir;

      try {
        // Process with the default engine
        result = await selectDefaultEngineForFile(inputPath, outputDir);

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
        const response = await createOCRResponse(result);
        
        // Return the successful response
        return createSafeJsonResponse(response, 200);
      } catch (processingError) {
        const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown processing error';
        logger.error(`Error in OCR processing: ${errorMessage}`);
        
        return createSafeJsonResponse(
          createErrorResponse('Failed to process document', errorMessage),
          500
        );
      }
    } catch (fileError) {
      const errorMessage = fileError instanceof Error ? fileError.message : 'Unknown file error';
      logger.error(`Error handling file: ${errorMessage}`);
      
      return createSafeJsonResponse(
        createErrorResponse('Failed to process file', errorMessage),
        500
      );
    }
  } catch (requestError) {
    const errorMessage = requestError instanceof Error ? requestError.message : 'Unknown request error';
    logger.error(`Error processing request: ${errorMessage}`);
    
    return createSafeJsonResponse(
      createErrorResponse('Failed to process request', errorMessage),
      500
    );
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

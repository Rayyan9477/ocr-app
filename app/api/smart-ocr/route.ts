import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import multiEngineOCR from '@/lib/multi-engine-ocr';

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
const PROCESSED_DIR = join(UPLOAD_DIR, 'processed');

/**
 * Safe JSON parsing with fallback
 */
function safeJsonParse(jsonString: string, fallback: any = {}) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return fallback;
  }
}

/**
 * Creates a safe JSON response
 */
function safeJsonResponse(data: any, options: { status?: number, headers?: Record<string, string> } = {}) {
  try {
    // Set defaults
    const status = options.status || 200;
    const headers = options.headers || {};
    
    // Convert to string with extra safety
    const jsonString = JSON.stringify(data);
    
    return new NextResponse(jsonString, {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });
  } catch (error) {
    console.error('Failed to create safe JSON response:', error);
    
    // Ultra-safe fallback response
    return NextResponse.json({
      success: false,
      error: 'Failed to generate valid JSON response',
      fallback: true
    }, { status: 500 });
  }
}

/**
 * OCR processing API handler
 */
export async function POST(req: NextRequest) {
  try {
    // Handle form data upload
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return safeJsonResponse(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Get additional options if available
    let options = {};
    try {
      const optionsField = formData.get('options');
      if (typeof optionsField === 'string' && optionsField) {
        options = safeJsonParse(optionsField, {});
      }
    } catch (error) {
      console.warn('Invalid options provided:', error);
    }
    
    // Create upload and processing directories
    try {
      await mkdir(UPLOAD_DIR, { recursive: true });
      await mkdir(PROCESSED_DIR, { recursive: true });
    } catch (dirError: any) {
      console.error('Error creating directories:', dirError);
      return safeJsonResponse(
        { success: false, error: `Failed to create necessary directories: ${dirError.message}` },
        { status: 500 }
      );
    }
    
    // Save uploaded file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = file.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_'); // Sanitize filename
    const filepath = join(UPLOAD_DIR, filename);
    await writeFile(filepath, buffer);
    
    console.log(`Processing uploaded file: ${filename}`);
    
    // Process with OCR engine
    try {
      const result = await multiEngineOCR.processDocument(filepath, PROCESSED_DIR, options);
      
      // Return result with original filename
      return safeJsonResponse({
        ...result,
        inputFile: filename // Include original filename for reference
      });
    } catch (ocrError: any) {
      console.error('OCR processing error:', ocrError);
      
      return safeJsonResponse(
        { 
          success: false, 
          error: 'OCR processing failed',
          message: ocrError?.message || 'Unknown processing error',
          outputFile: filename.replace(/\.[^/.]+$/, "") + "_error.pdf"
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Unhandled error in smart-ocr API route:', error);
    
    return safeJsonResponse(
      { 
        success: false, 
        error: 'API processing error',
        message: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - method not allowed
 */
export function GET() {
  return safeJsonResponse(
    { success: false, error: 'Method Not Allowed' },
    { status: 405 }
  );
}
 */
export function GET() {
  return safeJsonResponse(
    { success: false, error: 'Method Not Allowed' },
    { status: 405 }
  );
}
    return safeJsonResponse({
      ...result,
      inputFile: filename // Include original filename for reference
    });
    
  } catch (error: any) {
    console.error('Error in smart-ocr API route:', error);
    
    // Generate a safe output filename for the error response
    let outputFile = 'error_result.pdf';
    if (req.formData) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (file && file.name) {
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, '_');
        outputFile = `${baseName}_ocr.pdf`;
      }
    }
    
    return safeJsonResponse(
      {
        success: false,
        error: 'OCR processing failed',
        message: error.message || 'Unknown error',
        outputFile // Always include an output filename
      },
      { status: 500 }
    );
  }
}

// Export the safe handler wrapper
export const POST = createSafeOcrApiHandler(handler);

// HTTP GET method - returns method not allowed response
export function GET() {
  return safeJsonResponse({ success: false, error: 'Method Not Allowed' }, { status: 405 });
}

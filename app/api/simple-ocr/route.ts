/**
 * Simplified Cross-Platform OCR API
 *
 * This endpoint works on Windows, Mac, and Linux without any system dependencies.
 * It uses only JavaScript libraries (tesseract.js, pdf-lib, sharp).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import SimpleOCRService from '@/lib/simple-ocr-service';
import logger from '@/lib/logger';

// Configure Next.js to handle large files
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false
  }
};

/**
 * Ensure required directories exist
 */
async function ensureDirectories() {
  const uploadDir = join(process.cwd(), 'uploads');
  const processedDir = join(process.cwd(), 'processed');

  for (const dir of [uploadDir, processedDir]) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  }
}

/**
 * Create JSON response helper
 */
function createJsonResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status });
}

/**
 * POST handler - Process OCR request
 */
export async function POST(request: NextRequest) {
  logger.info('Simple OCR API called');

  try {
    await ensureDirectories();

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return createJsonResponse(
        {
          success: false,
          error: 'No file provided'
        },
        400
      );
    }

    logger.info(`Processing file: ${file.name} (${file.size} bytes)`);

    // Get OCR options from form data
    const options = {
      language: formData.get('language')?.toString() || 'eng',
      deskew: formData.get('deskew') === 'true',
      enhanceContrast: formData.get('enhanceContrast') === 'true',
      removeNoise: formData.get('removeNoise') === 'true',
      outputDir: join(process.cwd(), 'processed')
    };

    // Save uploaded file
    const uploadDir = join(process.cwd(), 'uploads');
    const filePath = join(uploadDir, file.name);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    logger.info(`File saved to: ${filePath}`);

    // Process with OCR
    const result = await SimpleOCRService.processFile(filePath, options);

    if (!result.success) {
      return createJsonResponse(
        {
          success: false,
          error: result.error || 'OCR processing failed'
        },
        500
      );
    }

    // Return success response
    return createJsonResponse({
      success: true,
      inputFile: file.name,
      text: result.text,
      confidence: Math.round(result.confidence * 100) / 100,
      processingTime: result.processingTime,
      pageCount: result.pageCount,
      outputFile: result.outputPath ? result.outputPath.split('/').pop() : undefined,
      message: 'OCR processing completed successfully'
    });
  } catch (error) {
    logger.error('OCR processing error:', error);

    return createJsonResponse(
      {
        success: false,
        error: 'Unexpected error during OCR processing',
        details: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
}

/**
 * GET handler - API information
 */
export async function GET() {
  return createJsonResponse({
    service: 'Simple Cross-Platform OCR',
    version: '1.0.0',
    features: [
      'PDF to text conversion',
      'Image to text conversion',
      'Multiple language support',
      'Automatic image enhancement',
      'Works on Windows, Mac, and Linux'
    ],
    supportedFormats: ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'bmp', 'webp'],
    languages: ['eng', 'fra', 'deu', 'spa', 'por', 'ita', 'rus', 'chi_sim', 'jpn', 'kor'],
    usage: {
      endpoint: '/api/simple-ocr',
      method: 'POST',
      contentType: 'multipart/form-data',
      parameters: {
        file: 'File to process (required)',
        language: 'OCR language (optional, default: eng)',
        deskew: 'Auto-rotate/deskew (optional, default: true)',
        enhanceContrast: 'Enhance image contrast (optional, default: true)',
        removeNoise: 'Remove image noise (optional, default: true)'
      }
    }
  });
}

/**
 * OPTIONS handler - CORS support
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

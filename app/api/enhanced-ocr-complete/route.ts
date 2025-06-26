import { NextRequest, NextResponse } from 'next/server';
import { EnhancedOCRService } from '../../../lib/enhanced-ocr-service';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Enhanced OCR API endpoint with comprehensive preprocessing features
 */
export async function POST(request: NextRequest) {
  let enhancedOCRService: EnhancedOCRService | null = null;
  let tempFilePath: string | null = null;
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ 
        error: 'No file uploaded',
        success: false 
      }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/tiff', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Unsupported file type. Allowed: PNG, JPEG, TIFF, PDF',
        success: false 
      }, { status: 400 });
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size: 50MB',
        success: false 
      }, { status: 400 });
    }

    // Get enhancement options from form data
    const options = {
      applyCLAHE: formData.get('applyCLAHE') === 'true',
      deskew: formData.get('deskew') !== 'false', // Default true
      enhanceEdges: formData.get('enhanceEdges') === 'true',
      normalize: formData.get('normalize') === 'true',
      perspectiveCorrection: formData.get('perspectiveCorrection') === 'true',
      optimizeHighlightedText: formData.get('optimizeHighlightedText') === 'true',
      enableHandwritingDetection: formData.get('enableHandwritingDetection') === 'true',
      language: formData.get('language') as string || 'eng',
      edgeStrength: parseFloat(formData.get('edgeStrength') as string) || 1.0,
      claheClipLimit: parseFloat(formData.get('claheClipLimit') as string) || 2.0
    };

    // Save uploaded file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    tempFilePath = join(tmpdir(), `enhanced_ocr_upload_${Date.now()}_${file.name}`);
    await writeFile(tempFilePath, buffer);

    console.log(`[Enhanced OCR API] Processing file: ${file.name}, size: ${file.size} bytes`);
    console.log(`[Enhanced OCR API] Options: ${JSON.stringify(options)}`);

    // Process with enhanced OCR
    enhancedOCRService = new EnhancedOCRService();
    const result = await enhancedOCRService.processDocument(tempFilePath, options);

    // Prepare response
    const response = {
      success: result.success,
      text: result.text,
      confidence: result.confidence,
      processingTime: result.processingTime,
      
      // File information
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      
      // Processing details
      preprocessingOperations: result.preprocessingOperations,
      documentType: result.documentType,
      qualityScore: result.qualityScore,
      
      // Content analysis
      wordCount: result.wordCount,
      charCount: result.text.length,
      lineCount: result.text.split('\n').length,
      
      // Highlight information
      highlightedRegionsCount: result.highlightedRegions?.length || 0,
      highlightedRegions: result.highlightedRegions?.map(region => ({
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        confidence: region.confidence,
        text: region.text?.substring(0, 100) // Truncate for API response
      })) || [],
      
      // Enhancement recommendations
      recommendationsApplied: result.recommendationsApplied || [],
      
      // Processing options used
      optionsUsed: options,
      
      // Error information (if any)
      error: result.error
    };

    console.log(`[Enhanced OCR API] Processing completed: success=${result.success}, confidence=${result.confidence}%, time=${result.processingTime}ms`);

    return NextResponse.json(response, {
      status: result.success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Processing-Time': result.processingTime.toString(),
        'X-OCR-Engine': 'enhanced-tesseract',
        'X-Document-Type': result.documentType || 'unknown'
      }
    });

  } catch (error) {
    console.error('[Enhanced OCR API] Processing error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Enhanced OCR processing failed',
      details: error instanceof Error ? error.message : String(error),
      processingTime: 0,
      text: '',
      confidence: 0,
      wordCount: 0
    }, { status: 500 });
    
  } finally {
    // Cleanup
    if (enhancedOCRService) {
      enhancedOCRService.cleanup();
    }
    
    // Clean up uploaded file
    if (tempFilePath) {
      try {
        const fs = require('fs');
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        console.warn('[Enhanced OCR API] Cleanup warning:', cleanupError);
      }
    }
  }
}

/**
 * GET endpoint for API capabilities and status
 */
export async function GET() {
  try {
    const service = new EnhancedOCRService();
    const capabilities = service.getCapabilities();
    
    return NextResponse.json({
      status: 'active',
      service: 'Enhanced OCR API',
      version: '1.0.0',
      capabilities,
      endpoints: {
        POST: {
          description: 'Process document with enhanced OCR',
          parameters: {
            file: 'File to process (required)',
            applyCLAHE: 'Enable CLAHE enhancement (boolean)',
            deskew: 'Enable deskewing (boolean, default: true)',
            enhanceEdges: 'Enable edge enhancement (boolean)',
            normalize: 'Enable normalization (boolean)',
            perspectiveCorrection: 'Enable perspective correction (boolean)',
            optimizeHighlightedText: 'Enable highlight optimization (boolean)',
            enableHandwritingDetection: 'Enable handwriting detection (boolean)',
            language: 'OCR language (string, default: eng)',
            edgeStrength: 'Edge enhancement strength (number, default: 1.0)',
            claheClipLimit: 'CLAHE clip limit (number, default: 2.0)'
          }
        },
        GET: {
          description: 'Get API capabilities and status'
        }
      },
      limits: {
        maxFileSize: '50MB',
        supportedFormats: ['PNG', 'JPEG', 'TIFF', 'PDF'],
        timeout: '60 seconds'
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: 'Failed to get capabilities',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

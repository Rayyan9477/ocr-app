import { NextRequest, NextResponse } from 'next/server';
import { EnhancedOCRService } from '../../../lib/enhanced-ocr-service';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export async function POST(request: NextRequest) {
  let enhancedOCRService: EnhancedOCRService | null = null;
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Get enhancement options from form data
    const options = {
      applyCLAHE: formData.get('applyCLAHE') === 'true',
      deskew: formData.get('deskew') === 'true',
      enhanceEdges: formData.get('enhanceEdges') === 'true',
      normalize: formData.get('normalize') === 'true',
      perspectiveCorrection: formData.get('perspectiveCorrection') === 'true',
      optimizeHighlightedText: formData.get('optimizeHighlightedText') === 'true'
    };

    // Save uploaded file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempPath = join(tmpdir(), `upload_${Date.now()}_${file.name}`);
    await writeFile(tempPath, buffer);

    // Process with enhanced OCR with timeout
    enhancedOCRService = new EnhancedOCRService();
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Processing timeout')), 30000); // 30 second timeout
    });

    const result = await Promise.race([
      enhancedOCRService.processDocument(tempPath, options),
      timeoutPromise
    ]) as any;

    return NextResponse.json({
      success: result.success,
      text: result.text,
      confidence: result.confidence,
      processingTime: result.processingTime || Date.now() - startTime,
      preprocessingOperations: result.preprocessingOperations,
      wordCount: result.wordCount,
      highlightedRegions: result.highlightedRegions?.length || 0,
      error: result.error
    });

  } catch (error) {
    console.error('Enhanced OCR API error:', error);
    
    const processingTime = Date.now() - startTime;
    
    if (error instanceof Error && error.message === 'Processing timeout') {
      return NextResponse.json({
        success: false,
        error: 'Processing timeout - operation took longer than 30 seconds',
        processingTime,
        timeout: true
      }, { status: 408 });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Enhanced OCR processing failed', 
      details: error instanceof Error ? error.message : String(error),
      processingTime
    }, { status: 500 });
  } finally {
    // Cleanup
    if (enhancedOCRService) {
      enhancedOCRService.cleanup();
    }
  }
}

import { NextResponse } from 'next/server';
import { EnhancedOCRPipeline } from '../../../lib/enhanced-ocr-pipeline';
import { type EnhancedOCROptions } from '../../../lib/enhanced-ocr-pipeline';
import * as fs from 'fs';
import * as path from 'path';

/**
 * API endpoint for OCR performance testing
 */
export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ 
        success: false, 
        errorType: 'input_error',
        error: 'No file provided'
      }, { status: 400 });
    }

    // Process OCR Options from request
    const options: EnhancedOCROptions = {
      preprocessing: {
        // Base preprocessing options
        applyCLAHE: formData.get('applyCLAHE') === 'true',
        claheClipLimit: parseFloat(formData.get('claheClipLimit') as string) || 2.0,
        enhanceEdges: formData.get('enhanceEdges') === 'true',
        edgeStrength: parseFloat(formData.get('edgeStrength') as string) || 1.2,
        deskew: formData.get('deskew') === 'true',
        normalize: formData.get('normalize') === 'true',
      },
      // Advanced options
      useVLMRecommendations: formData.get('useVLMRecommendations') === 'true',
      enhanceWithVLM: formData.get('enhanceWithVLM') === 'true',
      language: (formData.get('language') as string) || 'eng',
      outputDir: './tmp/perf-test'
    };

    // Process additional boolean options
    const useAdvancedImageProcessing = formData.get('useAdvancedImageProcessing') === 'true';
    const useTensorOCR = formData.get('useTensorOCR') === 'true';
    const multiScaleProcessing = formData.get('multiScaleProcessing') === 'true';
    const useNeuralEnhancement = formData.get('useNeuralEnhancement') === 'true';
    const applyDenoising = formData.get('applyDenoising') === 'true';
    const sharpenText = formData.get('sharpenText') === 'true';
    const adaptiveContrast = formData.get('adaptiveContrast') === 'true';
    const usePostProcessing = formData.get('usePostProcessing') === 'true';

    // Apply advanced options if requested
    if (useAdvancedImageProcessing) {
      options.preprocessing = {
        ...options.preprocessing,
        applyCLAHE: true,
        enhanceEdges: true,
        normalize: true,
        deskew: true
      };
    }

    if (applyDenoising) {
      options.preprocessing.applyDenoising = true;
    }

    if (sharpenText) {
      options.preprocessing.sharpenText = true;
    }

    if (adaptiveContrast) {
      options.preprocessing.adaptiveContrast = true;
    }

    if (useNeuralEnhancement) {
      options.enhanceWithVLM = true;
    }

    // Set custom options based on the test scenario
    const engineParams: Record<string, any> = {};

    if (useTensorOCR) {
      engineParams.useTensorFlow = true;
    }

    if (multiScaleProcessing) {
      engineParams.multiScale = true;
    }

    if (usePostProcessing) {
      engineParams.postProcess = true;
    }

    if (Object.keys(engineParams).length > 0) {
      options.engineParams = engineParams;
    }

    // Create temporary directory if it doesn't exist
    const tmpDir = path.resolve('./tmp/perf-test');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Save file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempFilePath = path.join(tmpDir, `input_${Date.now()}_${file.name}`);
    fs.writeFileSync(tempFilePath, buffer);

    // Process with enhanced OCR pipeline
    const ocrPipeline = new EnhancedOCRPipeline();
    const result = await ocrPipeline.processDocument(tempFilePath, options);

    // Calculate performance metrics
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Return combined results
    return NextResponse.json({
      success: result.success,
      text: result.text,
      confidence: result.confidence,
      processingTime: result.processingTime,
      totalApiTime: totalTime,
      documentType: result.documentType,
      preprocessingOperations: result.preprocessingOperations,
      wordCount: result.wordCount,
      qualityScore: result.qualityScore || 0,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cacheHit: false, // For test purposes
      systemLoad: {
        cpuUsage: process.cpuUsage(),
        memoryUsage: process.memoryUsage()
      }
    });

  } catch (error) {
    console.error('Performance test error:', error);
    return NextResponse.json({
      success: false,
      errorType: 'processing_error',
      error: `${error}`,
      processingTime: Date.now() - startTime
    }, { status: 500 });
  }
}

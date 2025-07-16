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
    const contentType = request.headers.get('content-type') || '';
    let file: File | null = null;
    let options: EnhancedOCROptions;
    let useAdvancedImageProcessing = false;
    let useTensorOCR = false;
    let multiScaleProcessing = false;
    let useNeuralEnhancement = false;
    let applyDenoising = false;
    let sharpenText = false;
    let adaptiveContrast = false;
    let usePostProcessing = false;

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData input
      const formData = await request.formData();
      file = formData.get('file') as File;

      options = {
        preprocessing: {
          applyCLAHE: formData.get('applyCLAHE') === 'true',
          claheClipLimit: parseFloat(formData.get('claheClipLimit') as string) || 2.0,
          enhanceEdges: formData.get('enhanceEdges') === 'true',
          edgeStrength: parseFloat(formData.get('edgeStrength') as string) || 1.2,
          deskew: formData.get('deskew') === 'true',
          normalize: formData.get('normalize') === 'true',
        },
        useVLMRecommendations: formData.get('useVLMRecommendations') === 'true',
        enhanceWithVLM: formData.get('enhanceWithVLM') === 'true',
        language: (formData.get('language') as string) || 'eng',
        outputDir: './tmp/perf-test'
      };

      useAdvancedImageProcessing = formData.get('useAdvancedImageProcessing') === 'true';
      useTensorOCR = formData.get('useTensorOCR') === 'true';
      multiScaleProcessing = formData.get('multiScaleProcessing') === 'true';
      useNeuralEnhancement = formData.get('useNeuralEnhancement') === 'true';
      applyDenoising = formData.get('applyDenoising') === 'true';
      sharpenText = formData.get('sharpenText') === 'true';
      adaptiveContrast = formData.get('adaptiveContrast') === 'true';
      usePostProcessing = formData.get('usePostProcessing') === 'true';
    } else if (contentType.includes('application/json')) {
      // Handle JSON input for test mode (without file)
      const body = await request.json();
      
      options = {
        preprocessing: {
          applyCLAHE: body.applyCLAHE ?? false,
          claheClipLimit: body.claheClipLimit ?? 2.0,
          enhanceEdges: body.enhanceEdges ?? false,
          edgeStrength: body.edgeStrength ?? 1.2,
          deskew: body.deskew ?? false,
          normalize: body.normalize ?? false,
        },
        useVLMRecommendations: body.useVLMRecommendations ?? false,
        enhanceWithVLM: body.enhanceWithVLM ?? false,
        language: body.language ?? 'eng',
        outputDir: './tmp/perf-test'
      };

      useAdvancedImageProcessing = body.useAdvancedImageProcessing ?? false;
      useTensorOCR = body.useTensorOCR ?? false;
      multiScaleProcessing = body.multiScaleProcessing ?? false;
      useNeuralEnhancement = body.useNeuralEnhancement ?? false;
      applyDenoising = body.applyDenoising ?? false;
      sharpenText = body.sharpenText ?? false;
      adaptiveContrast = body.adaptiveContrast ?? false;
      usePostProcessing = body.usePostProcessing ?? false;

      // For JSON mode, use a test file if no file provided
      if (body.mode === 'light' || body.mode === 'test') {
        const testFilePath = path.resolve('./uploads/test-file.pdf');
        if (fs.existsSync(testFilePath)) {
          // Read the test file and create a buffer for processing
          const testFileBuffer = fs.readFileSync(testFilePath);
          // Create a mock file-like object for processing
          file = {
            name: 'test-file.pdf',
            size: testFileBuffer.length,
            type: 'application/pdf',
            arrayBuffer: async () => testFileBuffer.buffer.slice(testFileBuffer.byteOffset, testFileBuffer.byteOffset + testFileBuffer.byteLength)
          } as File;
        }
      }
    } else {
      return NextResponse.json({
        success: false,
        errorType: 'input_error',
        error: 'Content-Type must be multipart/form-data (for file upload) or application/json (for test mode)',
        supportedModes: {
          'multipart/form-data': 'Upload and process a file',
          'application/json': 'Test mode with sample file (use mode: "light" or "test")'
        }
      }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ 
        success: false, 
        errorType: 'input_error',
        error: 'No file provided. For JSON mode, include {"mode": "light"} to use test file.'
      }, { status: 400 });
    }

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

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import VLMModelManager from '@/lib/vlm-model-manager.js';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  let inputPath = '';
  try {
    logger.info('PaliGemma2-only OCR API called');
    
    const formData = await request.formData();
    const fileField = formData.get('image') || formData.get('file');
    if (!fileField) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    let fileName = 'unknown.pdf';
    let fileBuffer;
    if (typeof fileField === 'object' && fileField !== null) {
      if ('name' in fileField && typeof fileField.name === 'string') {
        fileName = fileField.name;
      }
      if ('arrayBuffer' in fileField && typeof fileField.arrayBuffer === 'function') {
        const arrayBuffer = await fileField.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else {
        return NextResponse.json({ error: 'Invalid file format' }, { status: 400 });
      }
    }
    const uploadsDir = path.join(process.cwd(), 'uploads');
    inputPath = path.join(uploadsDir, `${Date.now()}_${fileName}`);
    fs.writeFileSync(inputPath, fileBuffer);
    const outputDir = path.join(process.cwd(), 'processed');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Initialize VLM Model Manager with no fallbacks
    const modelManager = new VLMModelManager({
      enableOLMOCR: true,
      fallbackToSimple: false,
      enableCloudFallback: false,
      useEnhancedIntegration: true
    });
    
    logger.info('Loading PaliGemma2 model...');
    await modelManager.loadModel('paligemma2');
    
    // Process document with PaliGemma2
    const prompt = "<image>extract all text from this document accurately, preserving formatting and structure";
    const startTime = Date.now();
    const result = await modelManager.processImage(inputPath, prompt);
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      engine: 'paligemma2',
      outputFile: path.basename(inputPath),
      text: result.text || "",
      confidence: result.confidence || 0.8,
      processingTime,
      modelUsed: result.modelUsed || "PaliGemma2",
      enginesUsed: ['paligemma2'] // Only PaliGemma2 is used
    });
  } catch (error) {
    logger.error(`Error in PaliGemma2-only OCR route: ${error}`);
    return NextResponse.json({ 
      error: `Failed to process document with PaliGemma2: ${(error as Error).message || error}` 
    }, { status: 500 });
  }
}
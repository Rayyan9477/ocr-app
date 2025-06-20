import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import VLMModelManager from '../../../lib/vlm-model-manager.js';
import { initializeDirectories } from '../../../lib/initialize-dirs';
import logger from '../../../lib/logger';

// Initialize directories on module load
initializeDirectories();

// Initialize VLM manager for PaliGemma2
const vlmManager = new VLMModelManager({
    modelId: 'NSTiwari/paligemma2-3b-mix-224-onnx',
    useLocalFiles: true,
    enableOLMOCR: true,
    fallbackToSimple: false,
    enableCloudFallback: false,
    useEnhancedIntegration: true,
    modelPaths: [
        path.join(process.cwd(), 'models', 'paligemma2', 'google')
    ],
    timeout: 30000
});

/**
 * Process document using PaliGemma2 with enhanced OCR prompt for smart OCR features
 */
async function processPaliGemma2Only(inputPath, documentType = 'general') {
  const startTime = Date.now();
  let prompt = "<image>extract all text from this document accurately, preserving formatting and structure";
  
  // Enhance prompt based on document type
  if (documentType === 'handwriting') {
    prompt = "<image>extract all handwritten text from this document accurately, preserving formatting and structure";
  } else if (documentType === 'form') {
    prompt = "<image>extract all text from this form/structured document, maintaining table layouts and field relationships";
  }
  
  logger.info(`Processing document with PaliGemma2 (document type: ${documentType})`);
  
  try {
    // Load PaliGemma2 model
    await vlmManager.loadModel('paligemma2');
    
    // Process the document
    const result = await vlmManager.processImage(inputPath, prompt);
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      text: result.text || "",
      confidence: result.confidence || 0.85,
      engine: "paligemma2",
      outputPath: inputPath, // Since we're not creating a new file
      processingTime,
      vlmEnhanced: true,
      modelUsed: result.modelUsed || "PaliGemma2"
    };
  } catch (error) {
    logger.error(`PaliGemma2 processing failed: ${error.message}`);
    throw error;
  }
}

async function createOCRResponse(result) {
  // Ensure we have a valid result object
  if (!result) {
    return { error: 'No result from OCR process' };
  }

  // Get just the filename from the full path
  const outputFilename = result.outputPath ? path.basename(result.outputPath) : undefined;

  // Truncate text to prevent response size issues
  const truncatedText = result.text && result.text.length > 1000 
    ? result.text.substring(0, 1000) + '... [truncated]'
    : result.text;

  // Create response object
  return {
    success: result.success,
    engine: result.engine,
    outputFile: outputFilename, // Send only filename, not full path
    confidence: result.confidence || 0,
    text: truncatedText,
    processingTime: result.processingTime,
    error: result.error,
    // Add VLM-related fields if available
    vlmEnhanced: result.vlmEnhanced || false,
    vlmProcessingTime: result.vlmProcessingTime,
    modelUsed: result.modelUsed || "PaliGemma2"
  };
}

export async function POST(request) {
  let inputPath = "";
  
  try {
    // Check if the request has the correct content type
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      logger.info(`Form data keys received: ${contentType}`);
      return NextResponse.json({ 
        error: 'Content type must be multipart/form-data',
        received: contentType
      }, { status: 400 });
    }
    
    // Parse form data with error handling
    let formData;
    try {
      formData = await request.formData();
      // Log received form data keys for debugging
      const keys = Array.from(formData.keys());
      logger.info(`Form data keys received: ${keys.join(', ')}`);
    } catch (formDataError) {
      logger.error(`Failed to parse form data: ${formDataError.message}`);
      return NextResponse.json({ 
        error: 'Failed to parse form data. Make sure it is properly formatted multipart/form-data.'
      }, { status: 400 });
    }
    
    const fileField = formData.get('image') || formData.get('file');
    if (!fileField) {
      logger.error('No file provided in form data');
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
    
    // Determine document type (if provided)
    const documentType = formData.get('documentType')?.toString() || 'general';
    
    // Process with PaliGemma2 only
    let result;
    try {
      result = await processPaliGemma2Only(inputPath, documentType);
    } catch (error) {
      logger.error(`Smart OCR failed: ${error}`);
      return NextResponse.json({ error: `Smart OCR failed: ${error.message || error}` }, { status: 500 });
    }
    
    const response = await createOCRResponse(result);
    return NextResponse.json(response);
  } catch (error) {
    logger.error(`Error in smart-ocr: ${error}`);
    return NextResponse.json({ error: 'Failed to process document' }, { status: 500 });
  }
}

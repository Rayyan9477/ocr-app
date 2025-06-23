import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import VLMModelManager from '../../../lib/vlm-model-manager.js';
import { initializeDirectories } from '../../../lib/initialize-dirs';
import logger from '../../../lib/logger';
import { compatibilityMonitor } from '../../../lib/paligemma2-compatibility-monitor';

// Initialize directories on module load
initializeDirectories();

// Initialize VLM manager for PaliGemma2
const vlmManager = new VLMModelManager({
    modelId: 'NSTiwari/paligemma2-3b-mix-224-onnx',
    useLocalFiles: true,
    enableOLMOCR: true,
    fallbackToSimple: true, // Enable fallback to simple version
    enableCloudFallback: false,
    useEnhancedIntegration: true, // Try to use enhanced integration if available
    modelPaths: [
        path.join(process.cwd(), 'models', 'paligemma2', 'google')
    ],
    timeout: 120000, // Increase timeout for complex documents
    maxRetries: 3
});

// Get compatibility status on module load
let compatibilityStatus = null;

// Check compatibility on module load
async function initializeCompatibilityStatus() {
  try {
    compatibilityStatus = await compatibilityMonitor.checkCompatibility();
    logger.info(`PaliGemma2 compatibility status loaded: processorOnlyMode=${compatibilityStatus.processorOnlyMode}`);
  } catch (error) {
    logger.error(`Failed to check compatibility status: ${error.message}`);
    compatibilityStatus = { 
      processorOnlyMode: true, 
      isCompatible: false,
      upgradeInstructions: 'Check documentation for upgrade instructions'
    };
  }
}

// Initialize compatibility status
initializeCompatibilityStatus();

/**
 * Process document using PaliGemma2 with enhanced OCR prompt for smart OCR features
 */
async function processPaliGemma2Only(inputPath, documentType = 'general', ocrMode = 'paligemma2') {
  const startTime = Date.now();
  
  // Enhanced prompts for different document types
  const prompts = {
    general: "<image>extract all text from this document accurately, preserving formatting and structure",
    handwriting: "<image>extract all handwritten text from this document accurately, preserving formatting and structure",
    form: "<image>extract all text from this form/structured document, maintaining table layouts and field relationships",
    invoice: "<image>extract all invoice details including dates, amounts, line items, totals, and vendor information",
    medical: "<image>extract all medical text content from this document, including patient information, diagnoses, and other relevant details",
    id: "<image>extract all identification information from this document including names, dates, numbers, and other personal details"
  };
  
  // Select appropriate prompt based on document type
  let prompt = prompts[documentType] || prompts.general;
  
  logger.info(`Processing document with PaliGemma2 (document type: ${documentType})`);
  
  try {
    // Check compatibility status if not already done
    if (!compatibilityStatus) {
      compatibilityStatus = await compatibilityMonitor.checkCompatibility();
    }
    
    // Add compatibility warnings to the prompt if in processor-only mode
    if (compatibilityStatus?.processorOnlyMode) {
      logger.warn(`Processing in processor-only mode due to transformers.js compatibility issues`);
    }
    
    // Load PaliGemma2 model
    const model = await vlmManager.loadModel('paligemma2');
    
    // Check model status
    const modelStatus = model.getStatus ? model.getStatus() : { 
      initialized: !!model,
      processorOnly: typeof model.model === 'undefined'
    };
    
    // Process the document
    const result = await vlmManager.processImage(inputPath, prompt);
    const processingTime = Date.now() - startTime;
    
    // Include model status information in the result
    return {
      success: true,
      text: result.text || "",
      confidence: result.confidence || 0.85,
      engine: "paligemma2",
      outputPath: inputPath, // Since we're not creating a new file
      processingTime,
      vlmEnhanced: true,
      modelUsed: result.modelUsed || "PaliGemma2 Service",
      modelStatus: {
        processorOnly: modelStatus.processorOnly || (result.status === 'limited'),
        initialized: modelStatus.initialized || true,
        transformersCompatible: !modelStatus.processorOnly && !(result.status === 'limited'),
        upgradeAvailable: compatibilityStatus?.availableUpgrade || false,
        upgradeInstructions: compatibilityStatus?.upgradeInstructions || 'Check documentation for upgrade instructions'
      }
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

  // Check compatibility status if not already done
  if (!compatibilityStatus) {
    try {
      compatibilityStatus = await compatibilityMonitor.checkCompatibility();
    } catch (error) {
      logger.warn(`Failed to check compatibility status: ${error.message}`);
    }
  }

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
    modelUsed: result.modelUsed || "PaliGemma2 Service",
    // Add model status information if available
    modelStatus: result.modelStatus || {
      processorOnly: compatibilityStatus?.processorOnlyMode || true,
      initialized: true,
      transformersCompatible: !(compatibilityStatus?.processorOnlyMode || true),
      upgradeAvailable: compatibilityStatus?.availableUpgrade || false,
      upgradeInstructions: compatibilityStatus?.upgradeInstructions || 'Check documentation for upgrade instructions'
    }
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
    
    // Get OCR mode (if provided)
    const ocrMode = formData.get('ocrMode')?.toString() || 'paligemma2';
    
    // Process with PaliGemma2 only
    let result;
    try {
      result = await processPaliGemma2Only(inputPath, documentType, ocrMode);
    } catch (error) {
      logger.error(`Smart OCR failed: ${error}`);
      
      // Check compatibility status for error response
      if (!compatibilityStatus) {
        try {
          compatibilityStatus = await compatibilityMonitor.checkCompatibility();
        } catch (compatError) {
          logger.warn(`Failed to check compatibility status: ${compatError.message}`);
        }
      }
      
      return NextResponse.json({ 
        error: `Smart OCR failed: ${error.message || error}`,
        modelStatus: {
          processorOnly: compatibilityStatus?.processorOnlyMode || true,
          initialized: false,
          transformersCompatible: !(compatibilityStatus?.processorOnlyMode || true),
          upgradeAvailable: compatibilityStatus?.availableUpgrade || false,
          upgradeInstructions: compatibilityStatus?.upgradeInstructions || 'Check documentation for upgrade instructions',
          error: error.message || "Unknown error"
        }
      }, { status: 500 });
    }
    
    const response = await createOCRResponse(result);
    return NextResponse.json(response);
  } catch (error) {
    logger.error(`Error in smart-ocr: ${error}`);
    
    // Check compatibility status for error response
    if (!compatibilityStatus) {
      try {
        compatibilityStatus = await compatibilityMonitor.checkCompatibility();
      } catch (compatError) {
        logger.warn(`Failed to check compatibility status: ${compatError.message}`);
      }
    }
    
    return NextResponse.json({ 
      error: 'Failed to process document', 
      details: error.message || "Unknown error",
      modelStatus: {
        processorOnly: compatibilityStatus?.processorOnlyMode || true,
        initialized: false,
        transformersCompatible: !(compatibilityStatus?.processorOnlyMode || true),
        upgradeAvailable: compatibilityStatus?.availableUpgrade || false,
        upgradeInstructions: compatibilityStatus?.upgradeInstructions || 'Check documentation for upgrade instructions',
        error: error.message || "Unknown error"
      }
    }, { status: 500 });
  }
}

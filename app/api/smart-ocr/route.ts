import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { multiEngineOCR } from '@/lib/multi-engine-ocr';
import { DocumentAnalyzer } from '../../../lib/document-analyzer';
import { EnhancedDocumentAnalyzer, enhancedDocumentAnalyzer } from '../../../lib/enhanced-document-analyzer';
import VLMModelManager from '../../../lib/vlm-model-manager.js';
import { initializeDirectories } from '../../../lib/initialize-dirs';
import logger from '../../../lib/logger';
import pdfHandler from '../../../lib/pdf-handler.js';

// Initialize directories on module load
initializeDirectories();

const documentAnalyzer = new DocumentAnalyzer();

// Initialize VLM manager for PaliGemma2
const vlmManager = new VLMModelManager({
    modelId: 'NSTiwari/paligemma2-3b-mix-224-onnx',
    useLocalFiles: true,
    modelPaths: [
        path.join(process.cwd(), 'models', 'paligemma2', 'google')
    ],
    timeout: 30000
});

/**
 * Select the appropriate default OCR engine based on file type and PaliGemma2 analysis
 */
async function selectDefaultEngineForFile(inputPath, outputDir, documentType = 'general', useVlmEnhancement = true) {
  const isPdf = inputPath.toLowerCase().endsWith('.pdf');
  
  // Try to get PaliGemma2 document analysis for engine recommendation
  if (useVlmEnhancement) {
    try {
      const analysis = await vlmManager.processImage(inputPath, '<image>analyze this document and suggest the best OCR approach');
      if (analysis && analysis.text) {
        logger.info(`PaliGemma2 analysis: ${analysis.text}`);
        const analysisText = analysis.text.toLowerCase();
        if (analysisText.includes('handwrit') || analysisText.includes('handdrawn') || analysisText.includes('manuscript')) {
          logger.info('PaliGemma2 detected handwriting, using ensemble with VLM priority');
          documentType = 'handwriting';
        } else if (analysisText.includes('table') || analysisText.includes('form') || analysisText.includes('structured')) {
          logger.info('PaliGemma2 detected structured content, using ensemble with OCRmyPDF priority');
          documentType = 'form';
        }
      }
    } catch (error) {
      logger.warn(`PaliGemma2 analysis failed, using file type heuristics: ${error.message}`);
    }
  }
  
  if (isPdf) {
    logger.info('PDF file detected, using OCRmyPDF engine');
    documentType = 'form';
  }
  
  logger.info(`Using multi-engine ensemble for optimal results (document type: ${documentType})`);
  // Only run the ensemble, do not fallback if it fails
  return await multiEngineOCR.processDocument(inputPath, outputDir, {
    documentType,
    useVlmEnhancement,
    confidenceThreshold: 0.75,
    useAllEngines: true
  });
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
  const response = {
    success: result.success,
    engine: result.engine,
    outputFile: outputFilename, // Send only filename, not full path
    confidence: result.confidence || 0,
    text: truncatedText,
    processingTime: result.processingTime,
    error: result.error,
    // Add VLM-related fields if available
    vlmEnhanced: result.vlmEnhanced || false,
    vlmProcessingTime: result.vlmProcessingTimeMs
  };
  
  // Add confidence assessment if available
  if (result.confidenceAssessment) {
    response['confidenceAssessment'] = {
      overall: result.confidenceAssessment.overall,
      lowConfidenceCount: result.confidenceAssessment.potentialErrors?.length || 0
    };
  }
  
  return response;
}

export async function POST(request) {
  let inputPath = "";
  
  try {
    const formData = await request.formData();
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
    // Only run the selected engine, do not fallback
    let result;
    try {
      result = await selectDefaultEngineForFile(inputPath, outputDir);
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

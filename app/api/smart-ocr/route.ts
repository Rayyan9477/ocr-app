import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { MultiEngineOCR } from '../../../lib/multi-engine-ocr';
import { DocumentAnalyzer } from '../../../lib/document-analyzer';
import { initializeDirectories } from '../../../lib/initialize-dirs';
import logger from '../../../lib/logger';

// Initialize directories on module load
initializeDirectories();

const multiEngineOCR = new MultiEngineOCR();
const documentAnalyzer = new DocumentAnalyzer();

/**
 * Select the appropriate default OCR engine based on file type
 */
async function selectDefaultEngineForFile(inputPath: string, outputDir: string) {
  const isPdf = inputPath.toLowerCase().endsWith('.pdf');
  
  if (isPdf) {
    // For PDF files, prefer OCRmyPDF over Tesseract
    logger.info('PDF file detected, using OCRmyPDF engine');
    try {
      return await multiEngineOCR.processWithEngine('ocrmypdf', inputPath, outputDir);
    } catch (error) {
      logger.error(`OCRmyPDF failed, trying nanoVLM: ${error}`);
      // If OCRmyPDF fails, try nanoVLM as it can handle PDFs
      try {
        return await multiEngineOCR.processWithEngine('nanovlm', inputPath, outputDir);
      } catch (nanoError) {
        logger.error(`NanoVLM also failed: ${nanoError}`);
        throw new Error('No suitable PDF OCR engine available');
      }
    }
  } else {
    // For non-PDF files (images), Tesseract is appropriate
    logger.info('Image file detected, using Tesseract engine');
    return await multiEngineOCR.processWithEngine('tesseract', inputPath, outputDir);
  }
}

async function createOCRResponse(result: any) {
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

  return {
    success: result.success,
    engine: result.engine,
    outputFile: outputFilename, // Send only filename, not full path
    confidence: result.confidence || 0,
    text: truncatedText,
    processingTime: result.processingTime,
    error: result.error
  };
}

export async function POST(request: NextRequest) {
  let inputPath = "";
  
  try {
    // Extract document type and engine preference from the request
    const formData = await request.formData();
    
    // Log all form data keys for debugging
    const formKeys = Array.from(formData.keys());
    logger.info(`Form data keys received: ${formKeys.join(', ')}`);
    
    const file = formData.get('image') as File || formData.get('file') as File;
    const documentType = formData.get('documentType') as string || 'general';
    const preferredEngine = formData.get('engine') as string;
    
    logger.info(`Processing document of type: ${documentType}, preferred engine: ${preferredEngine || 'auto'}`);
    
    if (!file) {
      logger.error('No file provided in form data');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    logger.info(`File received: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
    
    // Save the uploaded file
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const fileName = `${Date.now()}_${file.name}`;
    inputPath = path.join(uploadsDir, fileName);
    
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(inputPath, fileBuffer);
    logger.info(`File saved to ${inputPath}`);
    
    // Output directory
    const outputDir = path.join(process.cwd(), 'processed');
    
    let result;
    if (preferredEngine === 'nanovlm') {
      logger.info('Using nanoVLM engine as requested');
      try {
        result = await multiEngineOCR.processWithEngine('nanovlm', inputPath, outputDir, documentType);
      } catch (error) {
        logger.error(`Error processing with nanoVLM: ${error}`);
        return NextResponse.json(
          { error: 'Failed to process with nanoVLM. The engine may not be available.' },
          { status: 500 }
        );
      }
    } else {
      // Analyze document to select best engine
      logger.info('Analyzing document to select best engine');
      const analysis = await documentAnalyzer.analyzeDocument(inputPath);
      logger.info(`Document analysis: ${JSON.stringify(analysis)}`);
      
      // For certain document types, prioritize nanoVLM
      if (analysis.hasHandwriting || analysis.poorQuality || analysis.hasTables) {
        logger.info('Document characteristics suggest using nanoVLM');
        try {
          result = await multiEngineOCR.processWithEngine('nanovlm', inputPath, outputDir, 
            analysis.hasHandwriting ? 'handwriting' : 
            analysis.hasTables ? 'table' : 'poor_quality');
        } catch (error) {
          logger.error(`Failed to use nanoVLM, falling back to file-type appropriate engine: ${error}`);
          // Fall back to file-type appropriate engine
          result = await selectDefaultEngineForFile(inputPath, outputDir);
        }
      } else {
        // Use file-type appropriate engine for standard documents
        result = await selectDefaultEngineForFile(inputPath, outputDir);
      }
    }
    
    // Create sanitized response
    const response = await createOCRResponse(result);
    return NextResponse.json(response);
    
  } catch (error) {
    logger.error(`Error in smart-ocr: ${error}`);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  } finally {
    // Cleanup uploaded file
    if (inputPath && fs.existsSync(inputPath)) {
      try {
        fs.unlinkSync(inputPath);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup uploaded file: ${cleanupError}`);
      }
    }
  }
}

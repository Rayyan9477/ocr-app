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

export async function POST(request: NextRequest) {
  let inputPath = "";
  
  try {
    // Extract document type and engine preference from the request
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const documentType = formData.get('documentType') as string || 'general';
    const preferredEngine = formData.get('engine') as string;
    
    logger.info(`Processing document of type: ${documentType}, preferred engine: ${preferredEngine || 'auto'}`);
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
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
    
    // If user explicitly requested nanoVLM, use it
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
          logger.error(`Failed to use nanoVLM, falling back to default engine: ${error}`);
          // Fall back to default engine
          result = await multiEngineOCR.processWithEngine('tesseract', inputPath, outputDir);
        }
      } else {
        // Use default engine for standard documents
        result = await multiEngineOCR.processWithEngine('tesseract', inputPath, outputDir);
      }
    }
    
    return NextResponse.json(result);
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

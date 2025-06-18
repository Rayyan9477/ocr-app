import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { MultiEngineOCR } from '../../../lib/multi-engine-ocr';
import { DocumentAnalyzer } from '../../../lib/document-analyzer';
import { EnhancedDocumentAnalyzer, enhancedDocumentAnalyzer } from '../../../lib/enhanced-document-analyzer';
import { vlmOcrEnhancer } from '../../../lib/vlm-ocr-enhancer';
import { initializeDirectories } from '../../../lib/initialize-dirs';
import logger from '../../../lib/logger';
import { VLMHealthMonitor } from '../../../lib/vlm/core/vlm-health-monitor';
import { vlmManager } from '../../../lib/vlm/core/vlm-manager';
import { vlmRegistry } from '../../../lib/vlm/core/vlm-registry';

// Ensure VLM models are registered
import '../../../lib/vlm-bootstrap';

// Initialize directories on module load
initializeDirectories();

const multiEngineOCR = new MultiEngineOCR();
const documentAnalyzer = new DocumentAnalyzer();

// Initialize VLM health monitor
const vlmHealthMonitor = new VLMHealthMonitor(
  vlmManager,
  vlmRegistry,
  60000 // Check health every minute
);
vlmHealthMonitor.startMonitoring();

/**
 * Select the appropriate default OCR engine based on file type and VLM recommendation
 */
async function selectDefaultEngineForFile(inputPath: string, outputDir: string) {
  const isPdf = inputPath.toLowerCase().endsWith('.pdf');
  
  // Try to get VLM engine recommendation first
  try {
    const recommendation = await vlmOcrEnhancer.getEngineRecommendation(inputPath);
    
    if (recommendation && recommendation.confidence > 0.7) {
      logger.info(`Using VLM-recommended engine: ${recommendation.recommendedEngine} (confidence: ${recommendation.confidence})`);
      logger.debug(`Recommendation reasoning: ${recommendation.reasoning}`);
      
      // Map VLM recommendation to available engines
      const recommendedEngine = recommendation.recommendedEngine.toLowerCase();
      
      if (recommendedEngine.includes('paddle') || recommendedEngine.includes('handwriting')) {
        try {
          return await multiEngineOCR.processWithEngine('paddleocr', inputPath, outputDir);
        } catch (error) {
          logger.error(`PaddleOCR failed despite recommendation: ${error}`);
        }
      } else if (recommendedEngine.includes('ocrmypdf') || recommendedEngine.includes('pdf')) {
        try {
          return await multiEngineOCR.processWithEngine('ocrmypdf', inputPath, outputDir);
        } catch (error) {
          logger.error(`OCRmyPDF failed despite recommendation: ${error}`);
        }
      } else if (recommendedEngine.includes('tesseract')) {
        try {
          return await multiEngineOCR.processWithEngine('tesseract', inputPath, outputDir);
        } catch (error) {
          logger.error(`Tesseract failed despite recommendation: ${error}`);
        }
      }
    }
  } catch (error) {
    logger.warn(`VLM engine recommendation failed, using file type heuristics: ${error}`);
  }
  
  // Fall back to file type heuristics
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
    const useVlm = formData.get('useVlm') !== 'false'; // Default to true if not specified
    
    // VLM-specific parameters
    const enableVLMEnhancement = formData.get('enableVLMEnhancement') === 'true' || useVlm;
    const vlmModel = formData.get('vlmModel') as string || 'paligemma2-3b-mix-224';
    const vlmDeploymentStrategy = formData.get('vlmDeploymentStrategy') as string || 'local';
    
    logger.info(`Processing document of type: ${documentType}, preferred engine: ${preferredEngine || 'auto'}, useVlm: ${enableVLMEnhancement}, vlmModel: ${vlmModel}`);
    
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
    
    // Check VLM health if using VLM
    let vlmHealthy = false;
    if (enableVLMEnhancement) {
      vlmHealthy = vlmHealthMonitor.isHealthy;
      logger.info(`VLM health status: ${vlmHealthy ? 'healthy' : 'unhealthy'}`);
      
      // If a specific VLM model is requested, verify it's available
      if (vlmModel && vlmModel !== 'auto') {
        const modelAvailable = vlmRegistry.getImplementation(vlmModel, vlmDeploymentStrategy as any);
        if (!modelAvailable) {
          logger.warn(`Requested VLM model '${vlmModel}' with strategy '${vlmDeploymentStrategy}' not available`);
          vlmHealthy = false;
        } else {
          logger.info(`Using specific VLM model: ${vlmModel} with deployment strategy: ${vlmDeploymentStrategy}`);
        }
      }
    }
    
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
      // Document analysis with VLM if enabled and healthy
      let analysis;
      if (enableVLMEnhancement && vlmHealthy) {
        logger.info(`Using enhanced document analyzer with VLM (model: ${vlmModel})`);
        analysis = await enhancedDocumentAnalyzer.analyzeDocument(inputPath);
        logger.info(`Enhanced document analysis: ${JSON.stringify(analysis)}`);
      } else {
        logger.info('Using standard document analyzer');
        analysis = await documentAnalyzer.analyzeDocument(inputPath);
        logger.info(`Document analysis: ${JSON.stringify(analysis)}`);
      }
      
      // Get preprocessing recommendations if VLM is enabled and healthy
      let preprocessingRecommendations = null;
      if (enableVLMEnhancement && vlmHealthy) {
        try {
          preprocessingRecommendations = await vlmOcrEnhancer.getPreprocessingRecommendation(inputPath);
          if (preprocessingRecommendations) {
            logger.info(`VLM preprocessing recommendations: ${JSON.stringify(preprocessingRecommendations)}`);
            
            // Apply preprocessing based on VLM recommendations if high priority techniques are found
            const highPriorityTechniques = preprocessingRecommendations.recommendations
              .filter(r => r.priority === 'high')
              .map(r => r.technique);
              
            if (highPriorityTechniques.length > 0) {
              logger.info(`Applying VLM-recommended preprocessing techniques: ${highPriorityTechniques.join(', ')}`);
              // Note: Preprocessing would be applied by multiEngineOCR based on these recommendations
            }
          }
        } catch (error) {
          logger.warn(`Failed to get VLM preprocessing recommendations: ${error}`);
        }
      }
      
      // For certain document types, prioritize specialized engines based on analysis
      if (analysis.hasHandwriting || analysis.poorQuality || analysis.hasTables) {
        const documentFeature = analysis.hasHandwriting ? 'handwriting' : 
                              analysis.hasTables ? 'table' : 'poor_quality';
        
        logger.info(`Document characteristics suggest specialized processing for: ${documentFeature}`);
        
        try {
          // Try appropriate engine for detected features
          if (analysis.hasHandwriting) {
            result = await multiEngineOCR.processWithEngine('paddleocr', inputPath, outputDir, 'handwriting');
          } else if (analysis.hasTables) {
            result = await multiEngineOCR.processWithEngine('ocrmypdf', inputPath, outputDir, 'table');
          } else if (analysis.poorQuality) {
            result = await multiEngineOCR.processWithEngine('tesseract', inputPath, outputDir, 'poor_quality');
          }
        } catch (error) {
          logger.error(`Failed to use specialized engine, falling back to VLM-recommended or default engine: ${error}`);
          // Fall back to VLM-recommended or file-type appropriate engine
          result = await selectDefaultEngineForFile(inputPath, outputDir);
        }
      } else {
        // Use VLM-recommended or file-type appropriate engine for standard documents
        result = await selectDefaultEngineForFile(inputPath, outputDir);
      }
    }
    
    // Apply VLM enhancement to OCR result if enabled and healthy
    if (enableVLMEnhancement && vlmHealthy && result && result.success) {
      try {
        logger.info(`Enhancing OCR result with VLM (model: ${vlmModel})`);
        result = await vlmOcrEnhancer.enhanceOCRResult(inputPath, result);
        logger.info(`VLM enhancement ${result.vlmEnhanced ? 'applied' : 'skipped'}`);
      } catch (error) {
        logger.warn(`Failed to enhance OCR result with VLM: ${error}`);
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

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import logger from './logger';
import config from './config';
import { ConfidenceData, DocumentConfidence as DCType, normalizeConfidenceData } from './types/ocr-types';

const execAsync = promisify(exec);

// Generate a unique document ID
function generateDocumentId(inputPath: string): string {
  const timestamp = Date.now();
  const basename = inputPath.split('/').pop() || 'unknown';
  return `${basename}_${timestamp}`;
}

// Helper function to provide fallback confidence data when extraction fails
async function getFallbackConfidenceData(
  inputPath: string, 
  outputPath: string
): Promise<DocumentConfidence | null> {
  try {
    // Try to get basic page count if possible
    let pageCount = 1;
    if (inputPath.toLowerCase().endsWith('.pdf')) {
      try {
        const { stdout } = await execAsync(`pdfinfo "${inputPath}" | grep -E "^Pages:" | awk '{print $2}'`);
        const parsedCount = parseInt(stdout.trim());
        if (!isNaN(parsedCount) && parsedCount > 0) {
          pageCount = parsedCount;
        }
      } catch (pageCountError) {
        logger.warn(`Could not determine page count: ${pageCountError}`);
      }
    }

    // Return minimal confidence data with reasonable defaults
    const fallbackConfidence: DocumentConfidence = {
      documentId: generateDocumentId(inputPath),
      inputFile: inputPath,
      outputFile: outputPath,
      averageConfidence: 50, // Neutral confidence when analysis fails
      pageConfidences: Array.from({ length: pageCount }, (_, i) => ({
        pageNumber: i + 1,
        averageConfidence: 50, // Neutral confidence per page
        wordCount: 0,
        lowConfidenceWords: []
      })),
      hasLowConfidencePages: false, // Conservative default
      warningPages: [],
      errorPages: [],
      processedAt: new Date(),
      metadata: {
        analysisMethod: 'fallback',
        fallbackReason: 'confidence_extraction_failed',
        timestamp: Date.now()
      }
    };

    logger.info(`Using fallback confidence data for ${inputPath} with ${pageCount} pages`);
    return fallbackConfidence;
    
  } catch (fallbackError) {
    logger.error(`Even fallback confidence analysis failed: ${fallbackError}`);
    return null;
  }
}

// Interface for internal processing
export interface PageConfidenceData {
  pageNumber: number;
  averageConfidence: number;
  wordCount: number;
  lowConfidenceWords: Array<{
    word: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
  metadata?: {
    analysisMethod: string;
    timestamp: number;
  };
}

// Main interface for confidence data returned by the service
export interface DocumentConfidence {
  documentId: string;
  inputFile: string;
  outputFile: string;
  averageConfidence: number;
  pageConfidences: PageConfidenceData[];
  hasLowConfidencePages: boolean;
  warningPages: number[];
  errorPages: number[];
  processedAt: Date;
  metadata?: {
    analysisMethod: string;
    fallbackReason?: string;
    timestamp: number;
    totalProcessingTime?: number;
  };
}

/**
 * Extract confidence scores from a PDF using Tesseract's hOCR output
 * Enhanced to handle both original files and processed OCR outputs
 */
export async function extractConfidenceScores(
  inputPath: string,
  outputPath: string,
  useProcessedFile: boolean = false
): Promise<DocumentConfidence | null> {
  if (!config.confidence.enableConfidenceTracking) {
    return null;
  }

  try {
    logger.info(`Extracting confidence scores for ${inputPath}`);

    // Create a temporary directory for processing
    const tempDir = join(process.cwd(), 'tmp', 'confidence_' + Date.now());
    await execAsync(`mkdir -p "${tempDir}"`);

    // Determine which file to analyze for confidence
    const analysisTarget = useProcessedFile && existsSync(outputPath) ? outputPath : inputPath;
    logger.info(`Using ${analysisTarget} for confidence analysis`);

    let hocrPath = join(tempDir, 'output.hocr');
    
    try {
      // For PDFs, we need to convert to images first, then run Tesseract
      if (analysisTarget.toLowerCase().endsWith('.pdf')) {
        logger.info('Converting PDF to images for confidence analysis');
        
        // Check if the PDF has extractable text first
        let hasExistingText = false;
        try {
          const { stdout: textCheck } = await execAsync(`pdftotext "${analysisTarget}" - | head -c 100`);
          hasExistingText = textCheck.trim().length > 10;
        } catch (textCheckError) {
          logger.warn(`Could not check for existing text in PDF: ${textCheckError}`);
        }

        // Convert PDF to images for Tesseract analysis
        const imagesDir = join(tempDir, 'images');
        await execAsync(`mkdir -p "${imagesDir}"`);
        
        // Use pdftoppm to convert PDF to images
        await execAsync(`pdftoppm -png -r 300 "${analysisTarget}" "${imagesDir}/page"`);
        
        // Get list of generated images
        const { stdout: imagesList } = await execAsync(`ls "${imagesDir}"/*.png 2>/dev/null || true`);
        const imageFiles = imagesList.trim().split('\n').filter(f => f.length > 0);
        
        if (imageFiles.length === 0) {
          logger.warn('No images were generated from PDF, falling back to text extraction');
          return await getFallbackConfidenceData(inputPath, outputPath);
        }

        // Process each image with Tesseract to get hOCR output
        const pageConfidences: PageConfidenceData[] = [];
        let totalConfidence = 0;
        let totalWords = 0;

        for (let i = 0; i < imageFiles.length; i++) {
          const imagePath = imageFiles[i];
          const pageHocrPath = join(tempDir, `page_${i + 1}.hocr`);
          
          try {
            // Run Tesseract with hOCR output to get confidence scores
            await execAsync(`tesseract "${imagePath}" "${pageHocrPath.replace('.hocr', '')}" -l eng hocr`);
            
            // Parse hOCR to extract confidence scores
            const pageConfidence = await parseHocrConfidence(pageHocrPath, i + 1);
            pageConfidences.push(pageConfidence);
            
            totalConfidence += pageConfidence.averageConfidence * pageConfidence.wordCount;
            totalWords += pageConfidence.wordCount;
            
          } catch (pageError) {
            logger.warn(`Failed to process page ${i + 1}: ${pageError}`);
            // Add a default confidence for failed pages
            pageConfidences.push({
              pageNumber: i + 1,
              averageConfidence: 0,
              wordCount: 0,
              lowConfidenceWords: [],
              metadata: {
                analysisMethod: 'failed',
                timestamp: Date.now()
              }
            });
          }
        }

        // Calculate overall confidence
        const averageConfidence = totalWords > 0 ? totalConfidence / totalWords : 0;
        
        // Identify problematic pages
        const warningPages = pageConfidences
          .filter(p => p.averageConfidence < config.confidence.warningThreshold && p.averageConfidence > 0)
          .map(p => p.pageNumber);
        
        const errorPages = pageConfidences
          .filter(p => p.averageConfidence === 0)
          .map(p => p.pageNumber);

        const result: DocumentConfidence = {
          documentId: generateDocumentId(inputPath),
          inputFile: inputPath,
          outputFile: outputPath,
          averageConfidence,
          pageConfidences,
          hasLowConfidencePages: warningPages.length > 0 || errorPages.length > 0,
          warningPages,
          errorPages,
          processedAt: new Date(),
          metadata: {
            analysisMethod: 'tesseract_hocr',
            timestamp: Date.now()
          }
        };

        // Cleanup temporary directory
        await execAsync(`rm -rf "${tempDir}"`);
        
        return result;

      } else {
        // For image files, process directly with Tesseract
        await execAsync(`tesseract "${analysisTarget}" "${hocrPath.replace('.hocr', '')}" -l eng hocr`);
        
        const pageConfidence = await parseHocrConfidence(hocrPath, 1);
        
        const result: DocumentConfidence = {
          documentId: generateDocumentId(inputPath),
          inputFile: inputPath,
          outputFile: outputPath,
          averageConfidence: pageConfidence.averageConfidence,
          pageConfidences: [pageConfidence],
          hasLowConfidencePages: pageConfidence.averageConfidence < config.confidence.warningThreshold,
          warningPages: pageConfidence.averageConfidence < config.confidence.warningThreshold ? [1] : [],
          errorPages: [],
          processedAt: new Date(),
          metadata: {
            analysisMethod: 'tesseract_hocr_single',
            timestamp: Date.now()
          }
        };

        // Cleanup temporary directory
        await execAsync(`rm -rf "${tempDir}"`);
        
        return result;
      }
      
    } catch (processingError) {
      logger.error(`Error during confidence processing: ${processingError}`);
      // Cleanup and return fallback
      await execAsync(`rm -rf "${tempDir}"`).catch(() => {});
      return await getFallbackConfidenceData(inputPath, outputPath);
    }

  } catch (error) {
    logger.error(`Failed to extract confidence scores from ${inputPath}:`, error);
    return await getFallbackConfidenceData(inputPath, outputPath);
  }
}

/**
 * Parse hOCR file to extract confidence scores
 */
async function parseHocrConfidence(hocrPath: string, pageNumber: number): Promise<PageConfidenceData> {
  try {
    const fs = await import('fs/promises');
    const hocrContent = await fs.readFile(hocrPath, 'utf8');
    
    // Parse hOCR XML to extract confidence scores
    const words = [];
    const wordRegex = /<span class='ocrx_word'[^>]*bbox (\d+) (\d+) (\d+) (\d+)[^>]*title="[^"]*x_wconf (\d+)"[^>]*>([^<]*)<\/span>/g;
    
    let match;
    let totalConfidence = 0;
    let wordCount = 0;
    
    while ((match = wordRegex.exec(hocrContent)) !== null) {
      const [, x0, y0, x1, y1, confidence, word] = match;
      const confidenceValue = parseInt(confidence);
      
      if (!isNaN(confidenceValue) && word.trim().length > 0) {
        words.push({
          word: word.trim(),
          confidence: confidenceValue,
          bbox: { x0: parseInt(x0), y0: parseInt(y0), x1: parseInt(x1), y1: parseInt(y1) }
        });
        
        totalConfidence += confidenceValue;
        wordCount++;
      }
    }
    
    const averageConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;
    const lowConfidenceWords = words.filter(w => w.confidence < config.confidence.warningThreshold);
    
    return {
      pageNumber,
      averageConfidence,
      wordCount,
      lowConfidenceWords,
      metadata: {
        analysisMethod: 'hocr_parsing',
        timestamp: Date.now()
      }
    };
    
  } catch (parseError) {
    logger.error(`Failed to parse hOCR file ${hocrPath}:`, parseError);
    return {
      pageNumber,
      averageConfidence: 0,
      wordCount: 0,
      lowConfidenceWords: [],
      metadata: {
        analysisMethod: 'parsing_failed',
        timestamp: Date.now()
      }
    };
  }
}

/**
 * Save confidence data to a JSON file
 */
export async function saveConfidenceData(
  confidenceData: DocumentConfidence,
  outputPath: string
): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const confidenceFilePath = outputPath.replace('.pdf', '_confidence.json');
    
    await fs.writeFile(
      confidenceFilePath,
      JSON.stringify(confidenceData, null, 2),
      'utf8'
    );
    
    logger.info(`Confidence data saved to ${confidenceFilePath}`);
  } catch (error) {
    logger.error(`Failed to save confidence data: ${error}`);
  }
}

/**
 * Load confidence data from a JSON file
 */
export async function loadConfidenceData(outputPath: string): Promise<DocumentConfidence | null> {
  try {
    const fs = await import('fs/promises');
    const confidenceFilePath = outputPath.replace('.pdf', '_confidence.json');
    
    if (!existsSync(confidenceFilePath)) {
      return null;
    }
    
    const fileContent = await fs.readFile(confidenceFilePath, 'utf8');
    const confidenceData = JSON.parse(fileContent) as DocumentConfidence;
    
    // Ensure the processedAt field is a Date object
    if (typeof confidenceData.processedAt === 'string') {
      confidenceData.processedAt = new Date(confidenceData.processedAt);
    }
    
    return confidenceData;
  } catch (error) {
    logger.error(`Failed to load confidence data: ${error}`);
    return null;
  }
}

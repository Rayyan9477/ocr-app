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
}

// Main type definition for document confidence data
export interface DocumentConfidence {
  documentId: string;
  inputFile: string;
  outputFile: string;
  averageConfidence: number;
  pageConfidences: PageConfidenceData[];
  processedAt: Date;
  hasLowConfidencePages: boolean;
  warningPages: number[];
  errorPages: number[];
  metadata?: {
    analysisMethod: string;
    fallbackReason?: string;
    timestamp: number;
    [key: string]: any;
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
          const { stdout: textCheck } = await execAsync(`pdftotext "${analysisTarget}" - | wc -c`);
          const charCount = parseInt(textCheck.trim());
          hasExistingText = charCount > 100; // Assume text exists if more than 100 characters
        } catch (textCheckError) {
          logger.warn('Could not check for existing text in PDF');
        }

        // Convert PDF to images
        const imageDir = join(tempDir, 'images');
        await execAsync(`mkdir -p "${imageDir}"`);
        
        // Use pdftoppm to convert PDF to images
        await execAsync(`pdftoppm -png "${analysisTarget}" "${imageDir}/page"`);
        
        // Get list of generated images
        const { stdout: imageList } = await execAsync(`ls "${imageDir}/"*.png`);
        const imageFiles = imageList.trim().split('\n').filter(f => f.length > 0);
        
        if (imageFiles.length === 0) {
          throw new Error('No images generated from PDF');
        }

        // Process each page with Tesseract to get hOCR
        const hocrFiles: string[] = [];
        for (let i = 0; i < imageFiles.length; i++) {
          const imageFile = imageFiles[i];
          const pageHocrPath = join(tempDir, `page_${i + 1}.hocr`);
          
          try {
            await execAsync(`tesseract "${imageFile}" "${pageHocrPath.replace('.hocr', '')}" -l eng hocr`);
            if (existsSync(pageHocrPath)) {
              hocrFiles.push(pageHocrPath);
            }
          } catch (tesseractError) {
            logger.warn(`Failed to process page ${i + 1} with Tesseract: ${tesseractError}`);
          }
        }

        if (hocrFiles.length === 0) {
          throw new Error('No hOCR files generated');
        }

        // Combine all hOCR files
        const combinedHocr = await combineHocrFiles(hocrFiles);
        await execAsync(`echo '${combinedHocr.replace(/'/g, "'\\''")}' > "${hocrPath}"`);

      } else {
        // For image files, process directly with Tesseract
        await execAsync(`tesseract "${analysisTarget}" "${hocrPath.replace('.hocr', '')}" -l eng hocr`);
      }

      // Parse hOCR and extract confidence data
      const confidenceData = await parseHocrForConfidence(hocrPath, inputPath, outputPath);
      
      // Clean up temporary files
      await execAsync(`rm -rf "${tempDir}"`).catch(() => {
        logger.warn(`Failed to clean up temp directory: ${tempDir}`);
      });

      return confidenceData;

    } catch (processingError) {
      logger.error(`Error during confidence processing: ${processingError}`);
      
      // Clean up temporary files
      await execAsync(`rm -rf "${tempDir}"`).catch(() => {
        logger.warn(`Failed to clean up temp directory after error: ${tempDir}`);
      });
      
      // Return fallback data instead of null
      return await getFallbackConfidenceData(inputPath, outputPath);
    }

  } catch (error) {
    logger.error(`Failed to extract confidence scores from ${inputPath}:`, error);
    
    // Return fallback confidence data instead of null
    return await getFallbackConfidenceData(inputPath, outputPath);
  }
}

/**
 * Combine multiple hOCR files into a single document
 */
async function combineHocrFiles(hocrFiles: string[]): Promise<string> {
  const fs = require('fs').promises;
  
  let combinedContent = '';
  combinedContent += '<?xml version="1.0" encoding="UTF-8"?>\n';
  combinedContent += '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n';
  combinedContent += '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">\n';
  combinedContent += '<head>\n<title></title>\n</head>\n<body>\n';

  for (let i = 0; i < hocrFiles.length; i++) {
    try {
      const content = await fs.readFile(hocrFiles[i], 'utf8');
      
      // Extract the page content (div class="ocr_page")
      const pageMatch = content.match(/<div class="ocr_page"[^>]*>[\s\S]*?<\/div>/);
      if (pageMatch) {
        // Update page number in the content
        const updatedPageContent = pageMatch[0].replace(
          /id="page_\d+"/,
          `id="page_${i + 1}"`
        );
        combinedContent += updatedPageContent + '\n';
      }
    } catch (readError) {
      logger.warn(`Failed to read hOCR file ${hocrFiles[i]}: ${readError}`);
    }
  }

  combinedContent += '</body>\n</html>';
  return combinedContent;
}

/**
 * Parse hOCR content and extract confidence information
 */
async function parseHocrForConfidence(
  hocrPath: string, 
  inputPath: string, 
  outputPath: string
): Promise<DocumentConfidence> {
  const fs = require('fs').promises;
  
  try {
    const hocrContent = await fs.readFile(hocrPath, 'utf8');
    
    // Parse the hOCR content to extract confidence scores
    const pages = parseHocrPages(hocrContent);
    
    // Calculate overall statistics
    let totalConfidence = 0;
    let totalWords = 0;
    const warningPages: number[] = [];
    const errorPages: number[] = [];
    
    const pageConfidences: PageConfidenceData[] = pages.map((page, index) => {
      const pageNumber = index + 1;
      const pageAvg = page.words.length > 0 
        ? page.words.reduce((sum, word) => sum + word.confidence, 0) / page.words.length 
        : 0;
      
      totalConfidence += pageAvg * page.words.length;
      totalWords += page.words.length;
      
      // Determine page status
      if (pageAvg < config.confidence.errorThreshold) {
        errorPages.push(pageNumber);
      } else if (pageAvg < config.confidence.warningThreshold) {
        warningPages.push(pageNumber);
      }
      
      return {
        pageNumber,
        averageConfidence: Math.round(pageAvg * 100) / 100,
        wordCount: page.words.length,
        lowConfidenceWords: page.words
          .filter(word => word.confidence < config.confidence.warningThreshold)
          .map(word => ({
            word: word.text,
            confidence: Math.round(word.confidence * 100) / 100,
            bbox: word.bbox
          }))
      };
    });
    
    const averageConfidence = totalWords > 0 ? totalConfidence / totalWords : 0;
    
    return {
      documentId: generateDocumentId(inputPath),
      inputFile: inputPath,
      outputFile: outputPath,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      pageConfidences,
      hasLowConfidencePages: warningPages.length > 0 || errorPages.length > 0,
      warningPages,
      errorPages,
      processedAt: new Date(),
      metadata: {
        analysisMethod: 'hocr_tesseract',
        timestamp: Date.now(),
        totalWords,
        totalPages: pages.length
      }
    };
    
  } catch (parseError) {
    logger.error(`Failed to parse hOCR content: ${parseError}`);
    throw parseError;
  }
}

/**
 * Parse hOCR content into structured page data
 */
function parseHocrPages(hocrContent: string) {
  const pages: Array<{
    pageNumber: number;
    words: Array<{
      text: string;
      confidence: number;
      bbox: { x0: number; y0: number; x1: number; y1: number };
    }>;
  }> = [];
  
  // Extract all word elements with confidence scores
  const wordMatches = hocrContent.matchAll(/<span class="ocrx_word"[^>]*>([^<]*)<\/span>/g);
  
  let currentPage = { pageNumber: 1, words: [] as any[] };
  
  for (const match of wordMatches) {
    const wordElement = match[0];
    const wordText = match[1].trim();
    
    if (!wordText) continue;
    
    // Extract confidence and bounding box from title attribute
    const titleMatch = wordElement.match(/title="([^"]*)"/);
    if (titleMatch) {
      const title = titleMatch[1];
      
      // Extract confidence (x_wconf value)
      const confMatch = title.match(/x_wconf (\d+)/);
      const confidence = confMatch ? parseInt(confMatch[1]) : 0;
      
      // Extract bounding box
      const bboxMatch = title.match(/bbox (\d+) (\d+) (\d+) (\d+)/);
      const bbox = bboxMatch ? {
        x0: parseInt(bboxMatch[1]),
        y0: parseInt(bboxMatch[2]),
        x1: parseInt(bboxMatch[3]),
        y1: parseInt(bboxMatch[4])
      } : { x0: 0, y0: 0, x1: 0, y1: 0 };
      
      currentPage.words.push({
        text: wordText,
        confidence,
        bbox
      });
    }
  }
  
  // For now, assume all words are on page 1
  // In a more sophisticated implementation, we would parse page boundaries
  if (currentPage.words.length > 0) {
    pages.push(currentPage);
  }
  
  return pages;
}

/**
 * Save confidence data to a JSON file
 */
export async function saveConfidenceData(
  confidenceData: DocumentConfidence,
  outputPath: string
): Promise<void> {
  try {
    const fs = require('fs').promises;
    const confidenceFilePath = outputPath.replace(/\.pdf$/, '_confidence.json');
    
    await fs.writeFile(
      confidenceFilePath, 
      JSON.stringify(confidenceData, null, 2),
      'utf8'
    );
    
    logger.info(`Confidence data saved to ${confidenceFilePath}`);
  } catch (error) {
    logger.error(`Failed to save confidence data: ${error}`);
    throw error;
  }
}

/**
 * Load confidence data from a JSON file
 */
export async function loadConfidenceData(outputPath: string): Promise<DocumentConfidence | null> {
  try {
    const fs = require('fs').promises;
    const confidenceFilePath = outputPath.replace(/\.pdf$/, '_confidence.json');
    
    if (!existsSync(confidenceFilePath)) {
      return null;
    }
    
    const content = await fs.readFile(confidenceFilePath, 'utf8');
    const data = JSON.parse(content);
    
    // Convert processedAt back to Date object
    if (data.processedAt) {
      data.processedAt = new Date(data.processedAt);
    }
    
    return data as DocumentConfidence;
  } catch (error) {
    logger.error(`Failed to load confidence data: ${error}`);
    return null;
  }
}

export type { DocumentConfidence };

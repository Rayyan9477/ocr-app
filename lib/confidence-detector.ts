import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import logger from './logger';
import config from './config';

const execAsync = promisify(exec);

export interface ConfidenceData {
  pageNumber: number;
  averageConfidence: number;
  wordCount: number;
  lowConfidenceWords: Array<{
    word: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

export interface DocumentConfidence {
  documentId: string;
  inputFile: string;
  outputFile: string;
  averageConfidence: number;
  pageConfidences: ConfidenceData[];
  processedAt: Date;
  hasLowConfidencePages: boolean;
  warningPages: number[];
  errorPages: number[];
}

/**
 * Extract confidence scores from a PDF using Tesseract's hOCR output
 */
export async function extractConfidenceScores(
  inputPath: string,
  outputPath: string
): Promise<DocumentConfidence | null> {
  if (!config.confidence.enableConfidenceTracking) {
    return null;
  }

  try {
    logger.info(`Extracting confidence scores for ${inputPath}`);

    // Create a temporary directory for hOCR files
    const tempDir = join(process.cwd(), 'tmp', 'confidence_' + Date.now());
    await execAsync(`mkdir -p "${tempDir}"`);

    // Use ocrmypdf to generate hOCR output alongside the PDF
    const hocrPath = join(tempDir, 'output.hocr');
    
    // Run tesseract directly on the input PDF to get hOCR with confidence scores
    const tesseractCommand = `tesseract "${inputPath}" "${join(tempDir, 'output')}" -l eng --psm 1 hocr`;
    
    try {
      await execAsync(tesseractCommand);
    } catch (error) {
      // Try with a more permissive page segmentation mode if the first attempt fails
      const fallbackCommand = `tesseract "${inputPath}" "${join(tempDir, 'output')}" -l eng --psm 3 hocr`;
      await execAsync(fallbackCommand);
    }

    if (!existsSync(hocrPath)) {
      logger.warn(`hOCR file not generated for ${inputPath}`);
      // Cleanup
      await execAsync(`rm -rf "${tempDir}"`).catch(() => {});
      return null;
    }

    // Parse the hOCR file to extract confidence data
    const { readFile } = await import('fs/promises');
    const hocrContent = await readFile(hocrPath, 'utf-8');
    
    const confidenceData = parseHocrConfidence(hocrContent);
    
    // Cleanup temporary files
    await execAsync(`rm -rf "${tempDir}"`).catch(() => {});

    // Calculate document-level statistics
    const averageConfidence = calculateAverageConfidence(confidenceData);
    const { warningPages, errorPages } = categorizePages(confidenceData);

    const documentConfidence: DocumentConfidence = {
      documentId: generateDocumentId(inputPath),
      inputFile: inputPath,
      outputFile: outputPath,
      averageConfidence,
      pageConfidences: confidenceData,
      processedAt: new Date(),
      hasLowConfidencePages: warningPages.length > 0 || errorPages.length > 0,
      warningPages,
      errorPages,
    };

    // Log confidence information
    logger.info(`Confidence analysis for ${inputPath}: Average=${averageConfidence.toFixed(2)}%, Warning pages=${warningPages.length}, Error pages=${errorPages.length}`);

    return documentConfidence;

  } catch (error) {
    logger.error(`Error extracting confidence scores for ${inputPath}:`, error);
    return null;
  }
}

/**
 * Parse hOCR content to extract confidence scores
 */
function parseHocrConfidence(hocrContent: string): ConfidenceData[] {
  const pages: ConfidenceData[] = [];
  
  // Split by pages
  const pageMatches = hocrContent.match(/<div class='ocr_page'[^>]*>[\s\S]*?<\/div>/g);
  
  if (!pageMatches) {
    return pages;
  }

  pageMatches.forEach((pageContent, pageIndex) => {
    // Extract words with confidence scores
    const wordMatches = pageContent.match(/<span class='ocrx_word'[^>]*>([^<]*)<\/span>/g) || [];
    
    const words: ConfidenceData['lowConfidenceWords'] = [];
    let totalConfidence = 0;
    let wordCount = 0;

    wordMatches.forEach(wordMatch => {
      // Extract confidence score from title attribute
      const titleMatch = wordMatch.match(/title="[^"]*x_wconf\s+(\d+)[^"]*"/);
      const textMatch = wordMatch.match(/>([^<]*)</);
      const bboxMatch = wordMatch.match(/bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
      
      if (titleMatch && textMatch && bboxMatch) {
        const confidence = parseInt(titleMatch[1], 10);
        const word = textMatch[1].trim();
        const bbox = {
          x0: parseInt(bboxMatch[1], 10),
          y0: parseInt(bboxMatch[2], 10),
          x1: parseInt(bboxMatch[3], 10),
          y1: parseInt(bboxMatch[4], 10),
        };

        if (word && confidence >= 0) {
          totalConfidence += confidence;
          wordCount++;

          // Store low confidence words (below warning threshold)
          if (confidence < config.confidence.pageWarningThreshold) {
            words.push({ word, confidence, bbox });
          }
        }
      }
    });

    const averageConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;

    pages.push({
      pageNumber: pageIndex + 1,
      averageConfidence,
      wordCount,
      lowConfidenceWords: words,
    });
  });

  return pages;
}

/**
 * Calculate overall document confidence
 */
function calculateAverageConfidence(pages: ConfidenceData[]): number {
  if (pages.length === 0) return 0;
  
  let totalConfidence = 0;
  let totalWords = 0;

  pages.forEach(page => {
    totalConfidence += page.averageConfidence * page.wordCount;
    totalWords += page.wordCount;
  });

  return totalWords > 0 ? totalConfidence / totalWords : 0;
}

/**
 * Categorize pages by confidence levels
 */
function categorizePages(pages: ConfidenceData[]): { warningPages: number[]; errorPages: number[] } {
  const warningPages: number[] = [];
  const errorPages: number[] = [];

  pages.forEach(page => {
    if (page.averageConfidence < config.confidence.pageErrorThreshold) {
      errorPages.push(page.pageNumber);
    } else if (page.averageConfidence < config.confidence.pageWarningThreshold) {
      warningPages.push(page.pageNumber);
    }
  });

  return { warningPages, errorPages };
}

/**
 * Generate a unique document ID
 */
function generateDocumentId(inputPath: string): string {
  const filename = inputPath.split('/').pop() || 'unknown';
  const timestamp = Date.now();
  return `${filename}_${timestamp}`;
}

/**
 * Save confidence data to a JSON file alongside the processed PDF
 */
export async function saveConfidenceData(
  confidenceData: DocumentConfidence,
  outputPath: string
): Promise<void> {
  try {
    const { writeFile } = await import('fs/promises');
    const confidenceFilePath = outputPath.replace('.pdf', '_confidence.json');
    
    await writeFile(confidenceFilePath, JSON.stringify(confidenceData, null, 2), 'utf-8');
    logger.info(`Confidence data saved to ${confidenceFilePath}`);
  } catch (error) {
    logger.error('Error saving confidence data:', error);
  }
}

/**
 * Load confidence data from a JSON file
 */
export async function loadConfidenceData(outputPath: string): Promise<DocumentConfidence | null> {
  try {
    const { readFile } = await import('fs/promises');
    const confidenceFilePath = outputPath.replace('.pdf', '_confidence.json');
    
    if (!existsSync(confidenceFilePath)) {
      return null;
    }

    const content = await readFile(confidenceFilePath, 'utf-8');
    return JSON.parse(content) as DocumentConfidence;
  } catch (error) {
    logger.error('Error loading confidence data:', error);
    return null;
  }
}

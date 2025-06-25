import { execAsync } from './utils/exec-async';
import { createResponse, logger, OperationResult } from './vlm/error-handling';
import { config } from './config';
import { join } from 'path';
import { existsSync } from 'fs';

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

export async function extractConfidenceScores(
  inputPath: string,
  outputPath: string,
  useProcessedFile: boolean = false
): Promise<OperationResult<DocumentConfidence>> {
  if (!config.confidence.enableConfidenceTracking) {
    return createResponse('SUCCESS', null);
  }

  if (!existsSync(inputPath)) {
    return createResponse('FILE_UNAVAILABLE', null, `Input file not found: ${inputPath}`);
  }

  // Create temporary directory
  const tempDir = join(process.cwd(), 'tmp', 'confidence_' + Date.now());
  await execAsync(`mkdir -p "${tempDir}"`);

  const analysisTarget = useProcessedFile && existsSync(outputPath) ? outputPath : inputPath;
  const hocrPath = join(tempDir, 'output.hocr');

  // Process file
  const processResult = await processFileForConfidence(analysisTarget, tempDir, hocrPath);
  if (processResult.status !== 'SUCCESS') {
    await execAsync(`rm -rf "${tempDir}"`).catch(() => {});
    return processResult;
  }

  // Parse confidence data
  const confidenceData = parseHocrConfidence(processResult.data || '');
  
  // Calculate statistics
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

  await execAsync(`rm -rf "${tempDir}"`).catch(() => {});
  return createResponse('SUCCESS', documentConfidence);
}

async function processFileForConfidence(
  filePath: string,
  tempDir: string,
  hocrPath: string
): Promise<OperationResult<string>> {
  const imageDir = join(tempDir, 'pages');
  await execAsync(`mkdir -p "${imageDir}"`);

  if (filePath.toLowerCase().endsWith('.pdf')) {
    // Convert PDF to images
    await execAsync(`pdftoppm -png -r 300 "${filePath}" "${imageDir}/page"`);
    
    // Process images with Tesseract
    const { readdir } = await import('fs/promises');
    const imageFiles = (await readdir(imageDir))
      .filter(f => f.endsWith('.png'))
      .sort();

    if (imageFiles.length === 0) {
      return createResponse('PROCESS_INCOMPLETE', '', 'No images generated from PDF');
    }

    // Process each page
    const hocrContents: string[] = [];
    for (const imageFile of imageFiles) {
      const imagePath = join(imageDir, imageFile);
      const pageResult = await processImageWithTesseract(imagePath);
      if (pageResult.data) {
        hocrContents.push(pageResult.data);
      }
    }

    // Combine results
    const combinedHocr = combineHocrPages(hocrContents);
    return createResponse('SUCCESS', combinedHocr);
  } else {
    // Direct processing for images
    return processImageWithTesseract(filePath);
  }
}

/**
 * Parse hOCR content to extract confidence scores
 */
function parseHocrConfidence(hocrContent: string): ConfidenceData[] {
  const pages: ConfidenceData[] = [];
  
  // Use a more robust method to extract pages by finding page divs and matching closing tags
  const pageRegex = /<div class='ocr_page'[^>]*>/g;
  let pageMatch;
  const pageStarts: number[] = [];
  
  // Find all page start positions
  while ((pageMatch = pageRegex.exec(hocrContent)) !== null) {
    pageStarts.push(pageMatch.index);
  }
  
  if (pageStarts.length === 0) {
    return pages;
  }
  
  // Process each page
  pageStarts.forEach((pageStart, pageIndex) => {
    // Find the content for this page
    let pageContent: string;
    
    if (pageIndex < pageStarts.length - 1) {
      // Not the last page - content goes until the next page starts
      pageContent = hocrContent.substring(pageStart, pageStarts[pageIndex + 1]);
    } else {
      // Last page - content goes until </body>
      const bodyEndIndex = hocrContent.indexOf('</body>');
      pageContent = hocrContent.substring(pageStart, bodyEndIndex > -1 ? bodyEndIndex : hocrContent.length);
    }
    
    // Extract words with confidence scores from this page
    const wordMatches = pageContent.match(/<span class='ocrx_word'[^>]*>([^<]*)<\/span>/g) || [];
    
    const words: ConfidenceData['lowConfidenceWords'] = [];
    let totalConfidence = 0;
    let wordCount = 0;

    wordMatches.forEach(wordMatch => {
      // Extract confidence score from title attribute (handle both single and double quotes)
      const titleMatch = wordMatch.match(/title=['"][^'"]*x_wconf\s+(\d+)[^'"]*['"]/) || 
                        wordMatch.match(/x_wconf\s+(\d+)/);
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
 * Estimate confidence from extracted text characteristics
 * This is used for PDFs that already have text layers
 */
export function estimateConfidenceFromText(text: string): number {
  if (!text || text.length === 0) return 0;
  
  let confidenceScore = 85; // Start with a reasonable baseline for extracted text
  
  // Check for text characteristics that indicate good or poor quality
  const totalCharacters = text.length;
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const totalWords = words.length;
  
  if (totalWords === 0) return 0;
  
  // Check for common OCR errors that might indicate poor quality
  const substitutionErrors = (text.match(/[0O][0O]/g) || []).length; // Common O/0 substitutions
  const fragmentedWords = words.filter(word => word.length === 1 && word.match(/[a-zA-Z]/)).length;
  const specialCharacters = (text.match(/[^a-zA-Z0-9\s.,!?;:()\-'"]/g) || []).length;
  const upperCaseSequences = (text.match(/[A-Z]{4,}/g) || []).length;
  
  // Penalize for OCR quality indicators
  if (substitutionErrors > totalWords * 0.05) confidenceScore -= 15; // Too many O/0 errors
  if (fragmentedWords > totalWords * 0.1) confidenceScore -= 20; // Too many single letters
  if (specialCharacters > totalCharacters * 0.05) confidenceScore -= 10; // Too many weird characters
  if (upperCaseSequences > totalWords * 0.1) confidenceScore -= 10; // Too many caps sequences
  
  // Bonus for good characteristics
  const properSentences = (text.match(/[.!?]\s+[A-Z]/g) || []).length;
  const commonWords = words.filter(word => 
    ['the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(word.toLowerCase())
  ).length;
  
  if (properSentences > 0) confidenceScore += 5; // Good sentence structure
  if (commonWords > totalWords * 0.1) confidenceScore += 10; // Reasonable common word ratio
  
  // Average word length check (too short or too long might indicate errors)
  const averageWordLength = words.reduce((sum, word) => sum + word.length, 0) / totalWords;
  if (averageWordLength >= 3 && averageWordLength <= 8) confidenceScore += 5;
  
  // Ensure score is within valid range
  return Math.max(0, Math.min(100, confidenceScore));
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

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
          const { stdout: textContent } = await execAsync(`pdftotext "${analysisTarget}" -`);
          hasExistingText = textContent.trim().length > 0;
          logger.info(`PDF has existing text: ${hasExistingText}`);
        } catch (error) {
          logger.warn(`Could not extract text from PDF: ${error}`);
        }

        // Convert PDF to images using pdftoppm with higher quality for better OCR
        const imageDir = join(tempDir, 'pages');
        await execAsync(`mkdir -p "${imageDir}"`);
        
        // Use higher DPI for better OCR accuracy
        const dpi = hasExistingText ? 150 : 300; // Lower DPI if text exists, higher for image-only PDFs
        await execAsync(`pdftoppm -png -r ${dpi} "${analysisTarget}" "${imageDir}/page"`);
        
        // Find all generated image files
        const { readdir } = await import('fs/promises');
        const imageFiles = (await readdir(imageDir))
          .filter(f => f.endsWith('.png'))
          .sort((a, b) => {
            // Ensure proper numerical sorting (page-1.png, page-2.png, etc.)
            const aNum = parseInt(a.match(/(\d+)\.png$/)?.[1] || '0');
            const bNum = parseInt(b.match(/(\d+)\.png$/)?.[1] || '0');
            return aNum - bNum;
          });
        
        if (imageFiles.length === 0) {
          logger.warn(`No images generated from PDF ${analysisTarget}`);
          await execAsync(`rm -rf "${tempDir}"`).catch(() => {});
          return null;
        }
        
        logger.info(`Generated ${imageFiles.length} page images for analysis`);
        
        // Process each page image with Tesseract to get hOCR
        const pageHocrFiles: string[] = [];
        
        for (let i = 0; i < imageFiles.length; i++) {
          const imagePath = join(imageDir, imageFiles[i]);
          const pageHocrPath = join(tempDir, `page_${i + 1}.hocr`);
          
          try {
            // Enhanced Tesseract parameters for better confidence detection
            const tesseractOptions = [
              '-l eng',
              '--psm 1', // Automatic page segmentation with OSD
              '--oem 3', // Use both legacy and LSTM engines
              '-c tessedit_create_hocr=1',
              '-c hocr_font_info=1'
            ].join(' ');
            
            await execAsync(`tesseract "${imagePath}" "${pageHocrPath.replace('.hocr', '')}" ${tesseractOptions} hocr`);
            
            if (existsSync(pageHocrPath)) {
              pageHocrFiles.push(pageHocrPath);
              logger.info(`Successfully processed page ${i + 1}`);
            }
          } catch (pageError) {
            logger.warn(`Failed to process page ${i + 1} with PSM 1: ${pageError}`);
            // Try with more permissive PSM modes
            const fallbackModes = [3, 6, 4]; // Try different page segmentation modes
            
            for (const psm of fallbackModes) {
              try {
                const fallbackOptions = `-l eng --psm ${psm} --oem 3`;
                await execAsync(`tesseract "${imagePath}" "${pageHocrPath.replace('.hocr', '')}" ${fallbackOptions} hocr`);
                
                if (existsSync(pageHocrPath)) {
                  pageHocrFiles.push(pageHocrPath);
                  logger.info(`Successfully processed page ${i + 1} with PSM ${psm}`);
                  break;
                }
              } catch (fallbackError) {
                logger.warn(`PSM ${psm} also failed for page ${i + 1}: ${fallbackError}`);
              }
            }
          }
        }
        
        if (pageHocrFiles.length === 0) {
          logger.warn(`No hOCR files generated for ${inputPath}`);
          await execAsync(`rm -rf "${tempDir}"`).catch(() => {});
          return null;
        }
        
        // Combine all page hOCR files into one
        const { readFile, writeFile } = await import('fs/promises');
        let combinedHocr = '';
        
        for (let i = 0; i < pageHocrFiles.length; i++) {
          const pageContent = await readFile(pageHocrFiles[i], 'utf-8');
          
          if (i === 0) {
            // For the first page, include the full hOCR structure
            combinedHocr = pageContent;
          } else {
            // For subsequent pages, extract only the page content and append
            const pageMatch = pageContent.match(/<div class='ocr_page'[^>]*>[\s\S]*?<\/div>/);
            if (pageMatch) {
              // Replace the closing body and html tags with the new page content
              combinedHocr = combinedHocr.replace(
                /<\/body>\s*<\/html>\s*$/,
                pageMatch[0] + '\n</body>\n</html>'
              );
            }
          }
        }
        
        // Write the combined hOCR content
        await writeFile(hocrPath, combinedHocr, 'utf-8');
        
      } else {
        // For image files, run Tesseract directly
        const tesseractCommand = `tesseract "${inputPath}" "${join(tempDir, 'output')}" -l eng --psm 1 hocr`;
        
        try {
          await execAsync(tesseractCommand);
        } catch (error) {
          // Try with a more permissive page segmentation mode if the first attempt fails
          const fallbackCommand = `tesseract "${inputPath}" "${join(tempDir, 'output')}" -l eng --psm 3 hocr`;
          await execAsync(fallbackCommand);
        }
      }
    } catch (conversionError) {
      logger.error(`Error during PDF conversion or Tesseract processing: ${conversionError}`);
      await execAsync(`rm -rf "${tempDir}"`).catch(() => {});
      return null;
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

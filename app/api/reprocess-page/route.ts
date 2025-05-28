import { NextRequest } from 'next/server';
import { join } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { createJsonResponse } from '@/lib/utils';
import logger from '@/lib/logger';
import { DocumentConfidence, saveConfidenceData } from '@/lib/confidence-detector';
import config from '@/lib/config';

interface PaddleOCRResponse {
  success: boolean;
  page_number: number;
  enhancement_mode: string;
  language: string;
  results: {
    page_number: number;
    text_blocks: Array<{
      text: string;
      confidence: number;
      bbox: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      };
    }>;
    full_text: string;
    word_count: number;
    avg_confidence: number;
  };
  engine: string;
  confidence_stats: {
    total_blocks: number;
    avg_confidence: number;
    min_confidence: number;
    max_confidence: number;
    low_confidence_blocks: number;
    confidence_distribution: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
  };
}

interface ReprocessRequest {
  originalFilePath: string;
  outputFilePath: string;
  pageNumbers: number[];
  enhancementMode: 'standard' | 'enhanced' | 'medical' | 'handwritten' | 'aggressive';
  reason: string;
}

// PaddleOCR Service URL (from docker-compose)
const PADDLEOCR_SERVICE_URL = process.env.PADDLEOCR_SERVICE_URL || 'http://localhost:8000';

/**
 * POST /api/reprocess-page
 * Reprocess low-confidence pages using PaddleOCR specialized engine
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const originalFilePath = formData.get('originalFilePath') as string;
    const outputFilePath = formData.get('outputFilePath') as string;
    const pageNumbersStr = formData.get('pageNumbers') as string;
    const enhancementMode = (formData.get('enhancementMode') as string) || 'enhanced';
    const reason = formData.get('reason') as string;

    if (!originalFilePath || !outputFilePath || !pageNumbersStr) {
      return createJsonResponse({
        success: false,
        error: 'Missing required parameters: originalFilePath, outputFilePath, pageNumbers'
      }, 400);
    }

    const pageNumbers = JSON.parse(pageNumbersStr) as number[];
    
    if (!Array.isArray(pageNumbers) || pageNumbers.length === 0) {
      return createJsonResponse({
        success: false,
        error: 'Invalid pageNumbers: must be a non-empty array'
      }, 400);
    }

    // Validate files exist
    if (!existsSync(originalFilePath)) {
      return createJsonResponse({
        success: false,
        error: `Original file not found: ${originalFilePath}`
      }, 404);
    }

    if (!existsSync(outputFilePath)) {
      return createJsonResponse({
        success: false,
        error: `Processed file not found: ${outputFilePath}`
      }, 404);
    }

    logger.info(`Starting specialized OCR reprocessing for ${pageNumbers.length} pages from ${originalFilePath}`);

    // Check if PaddleOCR service is available
    const healthCheck = await checkPaddleOCRHealth();
    if (!healthCheck.success) {
      return createJsonResponse({
        success: false,
        error: 'PaddleOCR service unavailable',
        details: healthCheck.error
      }, 503);
    }

    // Extract pages from PDF and send to PaddleOCR
    const reprocessResults = await reprocessPages(
      originalFilePath,
      outputFilePath,
      pageNumbers,
      enhancementMode,
      reason
    );

    // Update confidence data with new results
    const updatedConfidence = await updateConfidenceWithReprocessedPages(
      outputFilePath,
      reprocessResults
    );

    return createJsonResponse({
      success: true,
      message: `Successfully reprocessed ${pageNumbers.length} pages using PaddleOCR`,
      originalFile: originalFilePath,
      outputFile: outputFilePath,
      reprocessedPages: pageNumbers,
      enhancementMode,
      engine: 'PaddleOCR',
      results: reprocessResults,
      updatedConfidence: updatedConfidence ? {
        averageConfidence: updatedConfidence.averageConfidence,
        hasLowConfidencePages: updatedConfidence.hasLowConfidencePages,
        warningPages: updatedConfidence.warningPages,
        errorPages: updatedConfidence.errorPages,
        pageCount: updatedConfidence.pageConfidences.length
      } : undefined
    });

  } catch (error) {
    logger.error('Error in reprocess-page API:', error);
    return createJsonResponse({
      success: false,
      error: 'Failed to reprocess pages',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

/**
 * GET /api/reprocess-page/status
 * Get reprocessing capabilities and status
 */
export async function GET(request: NextRequest) {
  try {
    const healthCheck = await checkPaddleOCRHealth();
    
    return createJsonResponse({
      success: true,
      paddleOcrAvailable: healthCheck.success,
      serviceUrl: PADDLEOCR_SERVICE_URL,
      capabilities: healthCheck.success ? await getPaddleOCRCapabilities() : null,
      configuration: {
        enhancementModes: ['handwritten', 'aggressive', 'medical', 'enhanced', 'standard'],
        supportedFormats: ['PDF', 'PNG', 'JPG', 'JPEG'],
        maxPagesPerRequest: 10
      }
    });
  } catch (error) {
    logger.error('Error checking reprocess status:', error);
    return createJsonResponse({
      success: false,
      error: 'Failed to check reprocessing status',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

async function checkPaddleOCRHealth(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${PADDLEOCR_SERVICE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (response.ok) {
      return { success: true };
    } else {
      return { 
        success: false, 
        error: `Health check failed with status ${response.status}` 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function getPaddleOCRCapabilities() {
  try {
    const response = await fetch(`${PADDLEOCR_SERVICE_URL}/ocr/capabilities`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    logger.warn('Could not fetch PaddleOCR capabilities:', error);
    return null;
  }
}

async function reprocessPages(
  originalFilePath: string,
  outputFilePath: string,
  pageNumbers: number[],
  enhancementMode: string,
  reason: string
): Promise<PaddleOCRResponse[]> {
  const results: PaddleOCRResponse[] = [];
  
  // Extract pages as images using pdftoppm
  const tempDir = join(process.cwd(), 'tmp', `reprocess_${Date.now()}`);
  const { promisify } = await import('util');
  const { exec } = await import('child_process');
  const execAsync = promisify(exec);
  
  try {
    // Create temp directory
    await execAsync(`mkdir -p "${tempDir}"`);
    
    for (const pageNumber of pageNumbers) {
      try {
        logger.info(`Extracting and reprocessing page ${pageNumber}...`);
        
        // Extract specific page as PNG
        const pageImagePath = join(tempDir, `page_${pageNumber}.png`);
        await execAsync(
          `pdftoppm -png -f ${pageNumber} -l ${pageNumber} -r 300 "${originalFilePath}" "${tempDir}/page_${pageNumber}"`
        );
        
        // Check if page image was created
        if (!existsSync(`${pageImagePath}`)) {
          // pdftoppm creates files with suffix, try to find the actual file
          const { readdir } = await import('fs/promises');
          const files = await readdir(tempDir);
          const pageFile = files.find(f => f.startsWith(`page_${pageNumber}`) && f.endsWith('.png'));
          
          if (!pageFile) {
            throw new Error(`Failed to extract page ${pageNumber} as image`);
          }
          
          // Rename to expected name
          await execAsync(`mv "${join(tempDir, pageFile)}" "${pageImagePath}"`);
        }
        
        // Send to PaddleOCR service
        const paddleResult = await sendPageToPaddleOCR(
          pageImagePath,
          pageNumber,
          enhancementMode
        );
        
        results.push(paddleResult);
        
        // Log reprocessing activity
        logger.info(`Page ${pageNumber} reprocessed with PaddleOCR: avg confidence ${paddleResult.results.avg_confidence.toFixed(2)}%`);
        
      } catch (pageError) {
        logger.error(`Failed to reprocess page ${pageNumber}:`, pageError);
        // Continue with other pages even if one fails
      }
    }
    
    // Create reprocessing log
    const logEntry = {
      timestamp: new Date().toISOString(),
      originalFile: originalFilePath,
      outputFile: outputFilePath,
      reprocessedPages: pageNumbers,
      enhancementMode,
      reason,
      engine: 'PaddleOCR',
      results: results.map(r => ({
        page: r.page_number,
        avgConfidence: r.results.avg_confidence,
        wordCount: r.results.word_count
      }))
    };
    
    await logReprocessingActivity(outputFilePath, logEntry);
    
  } finally {
    // Cleanup temp directory
    await execAsync(`rm -rf "${tempDir}"`).catch(() => {});
  }
  
  return results;
}

async function sendPageToPaddleOCR(
  pageImagePath: string,
  pageNumber: number,
  enhancementMode: string
): Promise<PaddleOCRResponse> {
  const { readFileSync } = await import('fs');
  
  // Read image file
  const imageBuffer = readFileSync(pageImagePath);
  
  // Create FormData for the request
  const formData = new FormData();
  formData.append('file', new Blob([imageBuffer]), `page_${pageNumber}.png`);
  formData.append('page_number', pageNumber.toString());
  formData.append('enhancement_mode', enhancementMode);
  formData.append('language', 'en');
  
  const response = await fetch(`${PADDLEOCR_SERVICE_URL}/ocr/process-page`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000) // 30 second timeout per page
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PaddleOCR request failed: ${response.status} - ${errorText}`);
  }
  
  return await response.json() as PaddleOCRResponse;
}

async function updateConfidenceWithReprocessedPages(
  outputFilePath: string,
  reprocessResults: PaddleOCRResponse[]
): Promise<DocumentConfidence | null> {
  try {
    // Load existing confidence data
    const confidenceFilePath = outputFilePath.replace('.pdf', '_confidence.json');
    
    if (!existsSync(confidenceFilePath)) {
      logger.warn(`No existing confidence file found at ${confidenceFilePath}`);
      return null;
    }
    
    const { readFileSync } = await import('fs');
    const existingData = JSON.parse(readFileSync(confidenceFilePath, 'utf-8')) as DocumentConfidence;
    
    // Update page confidences with reprocessed results
    for (const result of reprocessResults) {
      const pageIndex = result.page_number - 1;
      
      if (pageIndex >= 0 && pageIndex < existingData.pageConfidences.length) {
        // Update the confidence data for this page
        existingData.pageConfidences[pageIndex] = {
          pageNumber: result.page_number,
          averageConfidence: result.results.avg_confidence / 100, // Convert percentage to decimal
          wordCount: result.results.word_count,
          lowConfidenceWords: result.results.text_blocks
            .filter(block => block.confidence < 0.85)
            .map(block => ({
              word: block.text,
              confidence: block.confidence,
              bbox: {
                x0: block.bbox.x1,
                y0: block.bbox.y1,
                x1: block.bbox.x2,
                y1: block.bbox.y2
              }
            }))
        };
      }
    }
    
    // Recalculate document-level statistics
    const totalConfidence = existingData.pageConfidences.reduce(
      (sum, page) => sum + page.averageConfidence, 0
    );
    existingData.averageConfidence = totalConfidence / existingData.pageConfidences.length;
    
    // Recategorize pages
    const warningPages: number[] = [];
    const errorPages: number[] = [];
    
    existingData.pageConfidences.forEach(page => {
      const confidencePercent = page.averageConfidence * 100;
      if (confidencePercent < config.confidence.pageErrorThreshold) {
        errorPages.push(page.pageNumber);
      } else if (confidencePercent < config.confidence.pageWarningThreshold) {
        warningPages.push(page.pageNumber);
      }
    });
    
    existingData.warningPages = warningPages;
    existingData.errorPages = errorPages;
    existingData.hasLowConfidencePages = warningPages.length > 0 || errorPages.length > 0;
    
    // Add reprocessing metadata (extend the data with additional fields)
    (existingData as any).reprocessingHistory = (existingData as any).reprocessingHistory || [];
    (existingData as any).reprocessingHistory.push({
      timestamp: new Date(),
      engine: 'PaddleOCR',
      pagesReprocessed: reprocessResults.map(r => r.page_number),
      improvementAchieved: reprocessResults.some(r => r.results.avg_confidence > 85)
    });
    
    // Save updated confidence data
    await saveConfidenceData(existingData, outputFilePath);
    
    logger.info(`Updated confidence data for ${outputFilePath} after PaddleOCR reprocessing`);
    
    return existingData;
    
  } catch (error) {
    logger.error('Failed to update confidence data after reprocessing:', error);
    return null;
  }
}

async function logReprocessingActivity(outputFilePath: string, logEntry: any) {
  try {
    const logFilePath = outputFilePath.replace('.pdf', '_reprocessing_log.json');
    const { readFileSync, writeFileSync } = await import('fs');
    
    let existingLog: any[] = [];
    if (existsSync(logFilePath)) {
      try {
        existingLog = JSON.parse(readFileSync(logFilePath, 'utf-8'));
      } catch (e) {
        // If log file is corrupted, start fresh
        existingLog = [];
      }
    }
    
    existingLog.push(logEntry);
    
    writeFileSync(logFilePath, JSON.stringify(existingLog, null, 2));
    
    logger.info(`Logged reprocessing activity to ${logFilePath}`);
    
  } catch (error) {
    logger.warn('Failed to log reprocessing activity:', error);
  }
}

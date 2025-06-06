import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import appConfig from './config';

const exec = promisify(require('child_process').exec);

/**
 * Interface for OCR processing result
 */
export interface OcrResult {
  success: boolean;
  inputFile?: string;
  outputFile?: string;
  error?: string;
  fallback?: boolean;
}

/**
 * Generate a consistent output file path based on input name
 */
export function inferOutputFilePath(inputFile: string): string {
  // Remove .pdf extension if present
  const baseName = inputFile.replace(/\.pdf$/i, '');
  
  // Create sanitized filename with timestamp
  const timestamp = Date.now();
  const sanitized = baseName
    .replace(/[^a-z0-9]/gi, '_')
    .substring(0, 100);
  
  return `${sanitized}_${timestamp}_ocr.pdf`;
}

/**
 * Create a fallback PDF file when OCR fails
 */
export async function createFallbackPdf(inputPath: string, errorMessage: string): Promise<string> {
  const baseName = path.basename(inputPath);
  const fallbackPath = path.join(
    appConfig.processedDir,
    `${baseName.replace(/\.pdf$/i, '')}_fallback_${Date.now()}.pdf`
  );
  
  try {
    await exec(
      `/home/rayyan9477/ocr-app/lib/create-minimal-pdf.sh "${fallbackPath}" "${errorMessage.replace(/"/g, '\\"')}"`
    );
    return fallbackPath;
  } catch (error) {
    console.error('Failed to create fallback PDF:', error);
    return fallbackPath;
  }
}

/**
 * Try to find an existing output file that might match the input
 */
export async function findMatchingOutputFile(inputPath: string): Promise<string | null> {
  try {
    const baseName = path.basename(inputPath, '.pdf');
    const files = await fs.promises.readdir(appConfig.processedDir);
    
    // Look for files matching the input name pattern
    const potentialMatches = files.filter(file => 
      file.startsWith(baseName) && 
      (file.includes('_ocr') || file.includes('_fallback'))
    );
    
    if (potentialMatches.length > 0) {
      // Return the most recently created file
      const fullPaths = potentialMatches.map(f => path.join(appConfig.processedDir, f));
      const stats = await Promise.all(fullPaths.map(f => fs.promises.stat(f)));
      
      let newest = { path: fullPaths[0], time: stats[0].mtimeMs };
      for (let i = 1; i < fullPaths.length; i++) {
        if (stats[i].mtimeMs > newest.time) {
          newest = { path: fullPaths[i], time: stats[i].mtimeMs };
        }
      }
      
      return newest.path;
    }
  } catch (error) {
    console.error('Error finding matching output file:', error);
  }
  
  return null;
}

/**
 * Handle OCR processing errors by providing fallback files
 */
export async function handleOcrError(inputPath: string, errorMessage: string): Promise<OcrResult> {
  try {
    // First check for an existing output file
    const matchingFile = await findMatchingOutputFile(inputPath);
    if (matchingFile) {
      return {
        success: false,
        inputFile: inputPath,
        outputFile: path.basename(matchingFile),
        error: `${errorMessage} (Using existing output file)`,
        fallback: true
      };
    }
    
    // If no matching file, create a fallback
    const fallbackPath = await createFallbackPdf(inputPath, errorMessage);
    return {
      success: false,
      inputFile: inputPath,
      outputFile: path.basename(fallbackPath),
      error: `${errorMessage} (Created fallback file)`,
      fallback: true
    };
  } catch (error) {
    console.error('Error in handleOcrError:', error);
    
    // Last resort - return path even if we couldn't create the file
    const inferredPath = inferOutputFilePath(path.basename(inputPath));
    return {
      success: false,
      inputFile: inputPath,
      outputFile: inferredPath,
      error: `${errorMessage} (Failed to create fallback: ${error})`,
      fallback: true
    };
  }
}

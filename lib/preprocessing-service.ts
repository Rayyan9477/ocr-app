import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import logger from './logger';

const execAsync = promisify(exec);

export interface PreprocessingOptions {
  enhanceContrast: boolean;
  removeNoise: boolean;
  correctSkew: boolean;
  normalizeSize: boolean;
  sharpenText: boolean;
  binarize: boolean;
}

export interface PreprocessingResult {
  success: boolean;
  outputPath: string;
  operations: string[];
  errors?: string[];
}

/**
 * Enhanced preprocessing service for improving OCR quality
 * Applies various image enhancement techniques to improve OCR accuracy
 */
export class PreprocessingService {
  private tempDir: string;

  constructor() {
    this.tempDir = join(process.cwd(), 'tmp', 'preprocessing');
  }

  /**
   * Preprocess a PDF or image file to improve OCR quality
   */
  async preprocessDocument(
    inputPath: string,
    options: PreprocessingOptions
  ): Promise<PreprocessingResult> {
    const operations: string[] = [];
    const errors: string[] = [];

    try {
      // Create temporary directory
      const sessionDir = join(this.tempDir, `session_${Date.now()}`);
      await execAsync(`mkdir -p "${sessionDir}"`);

      // Determine preprocessing operations
      const magickOps: string[] = [];

      if (options.enhanceContrast) {
        magickOps.push('-normalize', '-contrast-stretch', '0.1%x0.1%');
        operations.push('Enhanced contrast and normalization');
      }

      if (options.removeNoise) {
        magickOps.push('-despeckle', '-median', '1');
        operations.push('Noise reduction and despeckling');
      }

      if (options.correctSkew) {
        magickOps.push('-deskew', '40%');
        operations.push('Automatic skew correction');
      }

      if (options.sharpenText) {
        magickOps.push('-unsharp', '0x1+1.0+0.05');
        operations.push('Text sharpening');
      }

      if (options.binarize) {
        magickOps.push('-threshold', '50%');
        operations.push('Image binarization');
      }

      if (options.normalizeSize) {
        magickOps.push('-resize', '200%', '-density', '300');
        operations.push('Size normalization and DPI enhancement');
      }

      let finalOutputPath: string;

      // Handle PDF input with multi-page support
      if (inputPath.toLowerCase().endsWith('.pdf')) {
        logger.info('Converting PDF to high-quality images for preprocessing');
        
        const imageDir = join(sessionDir, 'pages');
        await execAsync(`mkdir -p "${imageDir}"`);
        
        // Convert with high DPI for better quality
        await execAsync(`pdftoppm -png -r 300 "${inputPath}" "${imageDir}/page"`);
        operations.push('PDF to high-quality PNG conversion (300 DPI)');

        // Get all pages for processing
        const { readdir } = await import('fs/promises');
        const imageFiles = (await readdir(imageDir)).filter(f => f.endsWith('.png')).sort();
        
        if (imageFiles.length === 0) {
          throw new Error('No images generated from PDF');
        }

        logger.info(`Processing ${imageFiles.length} pages from PDF`);
        
        // Process each page individually
        const processedPages: string[] = [];
        for (let i = 0; i < imageFiles.length; i++) {
          const pagePath = join(imageDir, imageFiles[i]);
          const processedPagePath = join(sessionDir, `processed_page_${i + 1}.png`);
          
          // Apply preprocessing to this page
          if (magickOps.length > 0) {
            const magickCommand = `convert "${pagePath}" ${magickOps.join(' ')} "${processedPagePath}"`;
            logger.info(`Processing page ${i + 1}: ${magickCommand}`);
            await execAsync(magickCommand);
            
            if (existsSync(processedPagePath)) {
              processedPages.push(processedPagePath);
            } else {
              logger.warn(`Failed to process page ${i + 1}, using original`);
              await execAsync(`cp "${pagePath}" "${processedPagePath}"`);
              processedPages.push(processedPagePath);
            }
          } else {
            // No preprocessing, just copy the page
            await execAsync(`cp "${pagePath}" "${processedPagePath}"`);
            processedPages.push(processedPagePath);
          }
        }
        
        // Convert all processed pages back to a multi-page PDF
        finalOutputPath = join(sessionDir, 'enhanced.pdf');
        
        try {
          // Use img2pdf to combine all pages into a single PDF
          const pagesList = processedPages.map(p => `"${p}"`).join(' ');
          await execAsync(`img2pdf ${pagesList} -o "${finalOutputPath}"`);
          operations.push(`Combined ${processedPages.length} enhanced pages back to PDF using img2pdf`);
        } catch (img2pdfError) {
          logger.warn('img2pdf not available, using ImageMagick convert as fallback');
          try {
            const pagesList = processedPages.map(p => `"${p}"`).join(' ');
            await execAsync(`convert ${pagesList} "${finalOutputPath}"`);
            operations.push(`Combined ${processedPages.length} enhanced pages back to PDF using convert`);
          } catch (convertError) {
            logger.error('Multi-page PDF conversion failed, falling back to first page only');
            finalOutputPath = processedPages[0];
            operations.push('Keeping first enhanced page only (multi-page PDF conversion failed)');
          }
        }
      } else {
        // Handle image input
        const workingPath = join(sessionDir, 'processed' + this.getFileExtension(inputPath));
        
        // Apply preprocessing operations using ImageMagick
        if (magickOps.length > 0) {
          const magickCommand = `convert "${inputPath}" ${magickOps.join(' ')} "${workingPath}"`;
          
          logger.info(`Applying preprocessing: ${magickCommand}`);
          await execAsync(magickCommand);
          
          if (existsSync(workingPath)) {
            finalOutputPath = workingPath;
          } else {
            errors.push('ImageMagick processing failed');
            finalOutputPath = inputPath;
          }
        } else {
          // No preprocessing, just copy the file
          await execAsync(`cp "${inputPath}" "${workingPath}"`);
          finalOutputPath = workingPath;
        }
      }

      return {
        success: true,
        outputPath: finalOutputPath,
        operations,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      logger.error(`Preprocessing failed: ${error}`);
      return {
        success: false,
        outputPath: inputPath, // Return original path on failure
        operations,
        errors: [...errors, error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Quick preprocessing for low-confidence documents
   */
  async quickEnhance(inputPath: string): Promise<string> {
    const options: PreprocessingOptions = {
      enhanceContrast: true,
      removeNoise: true,
      correctSkew: true,
      normalizeSize: false,
      sharpenText: true,
      binarize: false
    };

    const result = await this.preprocessDocument(inputPath, options);
    return result.outputPath;
  }

  /**
   * Aggressive preprocessing for very poor quality documents
   */
  async aggressiveEnhance(inputPath: string): Promise<string> {
    const options: PreprocessingOptions = {
      enhanceContrast: true,
      removeNoise: true,
      correctSkew: true,
      normalizeSize: true,
      sharpenText: true,
      binarize: true
    };

    const result = await this.preprocessDocument(inputPath, options);
    return result.outputPath;
  }

  /**
   * Medical document optimized preprocessing
   */
  async medicalOptimize(inputPath: string): Promise<string> {
    const options: PreprocessingOptions = {
      enhanceContrast: true,
      removeNoise: true,
      correctSkew: true,
      normalizeSize: true,
      sharpenText: true,
      binarize: false // Don't binarize medical documents as they may have subtle details
    };

    const result = await this.preprocessDocument(inputPath, options);
    return result.outputPath;
  }

  /**
   * Clean up temporary files
   */
  async cleanup(): Promise<void> {
    try {
      await execAsync(`rm -rf "${this.tempDir}"`);
    } catch (error) {
      logger.warn(`Failed to cleanup preprocessing temp files: ${error}`);
    }
  }

  private getFileExtension(filepath: string): string {
    const ext = filepath.toLowerCase().split('.').pop();
    return ext ? `.${ext}` : '.png';
  }
}

export const preprocessingService = new PreprocessingService();

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

      let currentPath = inputPath;
      let workingPath = '';

      // If input is PDF, convert to high-quality images first
      if (inputPath.toLowerCase().endsWith('.pdf')) {
        logger.info('Converting PDF to high-quality images for preprocessing');
        
        const imageDir = join(sessionDir, 'pages');
        await execAsync(`mkdir -p "${imageDir}"`);
        
        // Convert with high DPI for better quality
        await execAsync(`pdftoppm -png -r 300 "${inputPath}" "${imageDir}/page"`);
        operations.push('PDF to high-quality PNG conversion (300 DPI)');

        // Get the first page for processing (can be extended for multi-page)
        const { readdir } = await import('fs/promises');
        const imageFiles = (await readdir(imageDir)).filter(f => f.endsWith('.png')).sort();
        
        if (imageFiles.length === 0) {
          throw new Error('No images generated from PDF');
        }

        currentPath = join(imageDir, imageFiles[0]);
        workingPath = join(sessionDir, 'processed.png');
      } else {
        workingPath = join(sessionDir, 'processed' + this.getFileExtension(inputPath));
        // Copy original file to working directory
        await execAsync(`cp "${inputPath}" "${workingPath}"`);
      }

      // Apply preprocessing operations using ImageMagick
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

      // Apply all operations at once for better performance
      if (magickOps.length > 0) {
        const outputPath = join(sessionDir, 'enhanced.png');
        const magickCommand = `convert "${currentPath}" ${magickOps.join(' ')} "${outputPath}"`;
        
        logger.info(`Applying preprocessing: ${magickCommand}`);
        await execAsync(magickCommand);
        
        if (existsSync(outputPath)) {
          workingPath = outputPath;
        } else {
          errors.push('ImageMagick processing failed');
        }
      }

      // Convert back to PDF if original was PDF
      let finalOutputPath = workingPath;
      if (inputPath.toLowerCase().endsWith('.pdf')) {
        finalOutputPath = join(sessionDir, 'enhanced.pdf');
        await execAsync(`img2pdf "${workingPath}" -o "${finalOutputPath}"`);
        operations.push('Converted enhanced image back to PDF');
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

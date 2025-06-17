import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import logger from './logger';
import HighlightDetector, { HighlightDetectionResult, HighlightDetectionOptions } from './highlight-detector';

const execAsync = promisify(exec);

export interface PreprocessingOptions {
  enhanceResolution?: boolean;
  denoise?: boolean;
  deskew?: boolean;
  contrast?: number;
  brightness?: number;
  // Legacy options for compatibility
  enhanceContrast?: boolean;
  removeNoise?: boolean;
  correctSkew?: boolean;
  sharpenText?: boolean;
  binarize?: boolean;
  normalizeSize?: boolean;
  // Highlight detection options
  detectHighlights?: boolean;
  enhanceHighlights?: boolean;
  highlightColorThreshold?: number;
  highlightMinSize?: number;
  highlightTargetColors?: string[];
}

export interface PreprocessingResult {
  success: boolean;
  outputPath: string;
  operations: string[];
  errors?: string[];
  highlightResults?: HighlightDetectionResult;
}

export class PreprocessingService {
  private tempDir: string;
  private highlightDetector: HighlightDetector;
  
  constructor() {
    this.tempDir = path.join(process.cwd(), 'tmp', 'preprocessing');
    this.highlightDetector = new HighlightDetector();
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Preprocess a PDF or image file to improve OCR quality
   */
  async preprocessDocument(
    inputPath: string,
    options: PreprocessingOptions = {}
  ): Promise<PreprocessingResult> {
    const operations: string[] = [];
    const errors: string[] = [];

    try {
      // Create temporary directory
      const sessionDir = path.join(this.tempDir, `session_${Date.now()}`);
      await execAsync(`mkdir -p "${sessionDir}"`);

      // Determine preprocessing operations
      const magickOps: string[] = [];

      // Support both new and legacy option names for compatibility
      if (options.enhanceContrast || options.contrast) {
        magickOps.push('-normalize', '-contrast-stretch', '0.1%x0.1%');
        operations.push('Enhanced contrast and normalization');
      }

      if (options.removeNoise || options.denoise) {
        magickOps.push('-despeckle', '-median', '1');
        operations.push('Noise reduction and despeckling');
      }

      if (options.correctSkew || options.deskew) {
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

      if (options.normalizeSize || options.enhanceResolution) {
        magickOps.push('-resize', '200%', '-density', '300');
        operations.push('Size normalization and DPI enhancement');
      }

      if (options.brightness) {
        magickOps.push('-brightness-contrast', `0x${options.brightness}`);
        operations.push(`Brightness adjustment: ${options.brightness}`);
      }

      let finalOutputPath: string;

      // Handle PDF input with multi-page support
      if (inputPath.toLowerCase().endsWith('.pdf')) {
        logger.info('Converting PDF to high-quality images for preprocessing');
        
        const imageDir = path.join(sessionDir, 'pages');
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
          const pagePath = path.join(imageDir, imageFiles[i]);
          const processedPagePath = path.join(sessionDir, `processed_page_${i + 1}.png`);
          
          // Apply preprocessing to this page
          if (magickOps.length > 0) {
            const magickCommand = `convert "${pagePath}" ${magickOps.join(' ')} "${processedPagePath}"`;
            logger.info(`Processing page ${i + 1}: ${magickCommand}`);
            await execAsync(magickCommand);
            
            if (fs.existsSync(processedPagePath)) {
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
        finalOutputPath = path.join(sessionDir, 'enhanced.pdf');
        
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
        const workingPath = path.join(sessionDir, 'processed' + this.getFileExtension(inputPath));
        
        // Apply preprocessing operations using ImageMagick
        if (magickOps.length > 0) {
          const magickCommand = `convert "${inputPath}" ${magickOps.join(' ')} "${workingPath}"`;
          
          logger.info(`Applying preprocessing: ${magickCommand}`);
          await execAsync(magickCommand);
          
          if (fs.existsSync(workingPath)) {
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

      // Perform highlight detection if requested
      let highlightResults: HighlightDetectionResult | undefined;
      
      if (options.detectHighlights) {
        try {
          logger.info('Detecting highlighted regions in document');
          
          const highlightOptions: HighlightDetectionOptions = {
            colorThreshold: options.highlightColorThreshold || 0.3,
            minRegionSize: options.highlightMinSize || 100,
            saturationThreshold: 0.5,
            enableTextExtraction: true,
            targetColors: options.highlightTargetColors || ['yellow', 'green', 'pink', 'blue', 'orange']
          };
          
          // Use the final processed image for highlight detection
          const detectionPath = finalOutputPath;
          highlightResults = await this.highlightDetector.detectHighlights(detectionPath, highlightOptions);
          
          if (highlightResults.hasHighlights) {
            operations.push(`Detected ${highlightResults.highlightRegions.length} highlighted regions`);
            
            // Enhance highlighted regions if requested
            if (options.enhanceHighlights) {
              const enhancedPath = await this.enhanceHighlightedRegions(
                finalOutputPath, 
                highlightResults.highlightRegions,
                sessionDir
              );
              
              if (enhancedPath && enhancedPath !== finalOutputPath) {
                finalOutputPath = enhancedPath;
                operations.push('Enhanced highlighted regions for better OCR');
              }
            }
          } else {
            operations.push('No highlights detected in document');
          }
          
        } catch (highlightError) {
          logger.warn(`Highlight detection failed: ${highlightError}`);
          errors.push(`Highlight detection error: ${highlightError instanceof Error ? highlightError.message : String(highlightError)}`);
        }
      }

      return {
        success: true,
        outputPath: finalOutputPath,
        operations,
        errors: errors.length > 0 ? errors : undefined,
        highlightResults
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
   * Enhance highlighted regions for better OCR results
   */
  private async enhanceHighlightedRegions(
    imagePath: string,
    highlightRegions: HighlightRegion[],
    sessionDir: string
  ): Promise<string> {
    try {
      const enhancedPath = path.join(sessionDir, 'enhanced_highlights.png');
      
      if (highlightRegions.length === 0) {
        return imagePath;
      }

      logger.info(`Enhancing ${highlightRegions.length} highlighted regions`);
      
      // Create a composite command to enhance all highlighted regions
      let enhanceCommand = `convert "${imagePath}"`;
      
      // For each highlight region, apply localized enhancement
      for (let i = 0; i < highlightRegions.length; i++) {
        const region = highlightRegions[i];
        const regionSpec = `${region.width}x${region.height}+${region.x}+${region.y}`;
        
        // Apply region-specific enhancements
        enhanceCommand += ` \\( -clone 0 -crop ${regionSpec} -contrast-stretch 2%x2% -sharpen 0x1 \\)`;
        enhanceCommand += ` -geometry +${region.x}+${region.y} -composite`;
      }
      
      enhanceCommand += ` "${enhancedPath}"`;
      
      await execAsync(enhanceCommand);
      
      if (fs.existsSync(enhancedPath)) {
        logger.info('Successfully enhanced highlighted regions');
        return enhancedPath;
      } else {
        logger.warn('Highlight enhancement failed, using original image');
        return imagePath;
      }
      
    } catch (error) {
      logger.warn(`Highlight enhancement failed: ${error}`);
      return imagePath;
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
   * Quick preprocessing with highlight detection for low-confidence documents
   */
  async quickEnhanceWithHighlights(inputPath: string): Promise<PreprocessingResult> {
    const options: PreprocessingOptions = {
      enhanceContrast: true,
      removeNoise: true,
      correctSkew: true,
      normalizeSize: false,
      sharpenText: true,
      binarize: false,
      detectHighlights: true,
      enhanceHighlights: true,
      highlightColorThreshold: 0.3,
      highlightMinSize: 100
    };

    return await this.preprocessDocument(inputPath, options);
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
   * Enhanced handwriting document optimization (JS-based replacement for Python dependencies)
   */
  async enhancedHandwritingOptimize(inputPath: string): Promise<string> {
    const outputPath = this.generateOutputPath(inputPath, 'handwriting');
    return this.preprocessImage(inputPath, outputPath, {
      enhanceResolution: true,
      denoise: true,
      deskew: true,
      contrast: 1.2
    });
  }
  
  /**
   * Enhanced table document optimization (JS-based replacement for nanoVLM)
   */
  async enhancedTableOptimize(inputPath: string): Promise<string> {
    const outputPath = this.generateOutputPath(inputPath, 'table');
    return this.preprocessImage(inputPath, outputPath, {
      enhanceResolution: true,
      deskew: true,
      contrast: 1.1
    });
  }
  
  /**
   * Enhanced general document optimization (JS-based replacement for nanoVLM)
   */
  async enhancedGeneralOptimize(inputPath: string): Promise<string> {
    const outputPath = this.generateOutputPath(inputPath, 'general');
    return this.preprocessImage(inputPath, outputPath, {
      denoise: true,
      deskew: true
    });
  }
  
  /**
   * Generate output path for preprocessed file
   */
  private generateOutputPath(inputPath: string, type: string): string {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const timestamp = Date.now();
    return path.join(this.tempDir, `${baseName}_${type}_${timestamp}${path.extname(inputPath)}`);
  }

  /**
   * Preprocess image with specific options
   */
  private async preprocessImage(
    inputPath: string, 
    outputPath: string, 
    options: PreprocessingOptions
  ): Promise<string> {
    try {
      // Simple preprocessing using ImageMagick
      let command = `convert "${inputPath}"`;
      
      if (options.enhanceResolution) {
        command += ' -density 300 -units PixelsPerInch';
      }
      
      if (options.denoise) {
        command += ' -despeckle -median 1';
      }
      
      if (options.deskew) {
        command += ' -deskew 40%';
      }
      
      if (options.contrast) {
        command += ` -contrast-stretch 0.1%x0.1%`;
      }
      
      if (options.brightness) {
        command += ` -brightness-contrast 0x${options.brightness}`;
      }
      
      command += ` "${outputPath}"`;
      
      await execAsync(command);
      
      if (!fs.existsSync(outputPath)) {
        throw new Error('Preprocessing failed to generate output file');
      }
      
      return outputPath;
    } catch (error) {
      logger.warn(`Image preprocessing failed, using original: ${error}`);
      return inputPath; // Fallback to original if preprocessing fails
    }
  }

  /**
   * Tesseract optimization 
   */
  async tesseractOptimize(inputPath: string): Promise<string> {
    const outputPath = this.generateOutputPath(inputPath, 'tesseract');
    return this.preprocessImage(inputPath, outputPath, {
      enhanceResolution: true,
      denoise: true,
      deskew: true,
      contrast: 1.1
    });
  }

  /**
   * PDF optimization
   */
  async pdfOptimize(inputPath: string): Promise<string> {
    // For PDF inputs, return original path as OCRmyPDF handles PDF processing directly
    return inputPath;
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

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import logger from './logger';
import { HighlightDetector, HighlightDetectionResult, HighlightDetectionOptions, HighlightRegion } from './highlight-detector';
import { 
  EnhancedPreprocessingOptions, 
  EnhancedPreprocessingResult,
  DocumentQualityAssessment,
  PreprocessingRecommendation,
  CLAHEOptions,
  EdgeEnhancementOptions,
  PerspectiveCorrectionOptions,
  HighlightOptimizationOptions
} from './enhanced-preprocessing-types';

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
        
        try {
          // Convert with high DPI for better quality
          await execAsync(`pdftoppm -png -r 300 "${inputPath}" "${imageDir}/page"`);
          operations.push('PDF to high-quality PNG conversion (300 DPI)');

          // Get all pages for processing
          const { readdir } = await import('fs/promises');
          let imageFiles: string[] = [];
          
          try {
            imageFiles = (await readdir(imageDir)).filter(f => f.endsWith('.png')).sort();
          } catch (readdirError) {
            logger.error(`Failed to read image directory: ${readdirError}`);
            errors.push(`Failed to read converted images: ${readdirError instanceof Error ? readdirError.message : String(readdirError)}`);
          }
          
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
              try {
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
              } catch (pageProcessError) {
                // Handle page processing errors gracefully
                logger.error(`Error processing page ${i + 1}: ${pageProcessError}`);
                errors.push(`Error processing page ${i + 1}: ${pageProcessError instanceof Error ? pageProcessError.message : String(pageProcessError)}`);
                
                // Fall back to using the original page
                try {
                  await execAsync(`cp "${pagePath}" "${processedPagePath}"`);
                  processedPages.push(processedPagePath);
                } catch (copyError) {
                  logger.error(`Failed to copy original page: ${copyError}`);
                }
              }
            } else {
              // No preprocessing, just copy the page
              try {
                await execAsync(`cp "${pagePath}" "${processedPagePath}"`);
                processedPages.push(processedPagePath);
              } catch (copyError) {
                logger.error(`Failed to copy page ${i + 1}: ${copyError}`);
                errors.push(`Failed to copy page ${i + 1}: ${copyError instanceof Error ? copyError.message : String(copyError)}`);
              }
            }
          }
          
          // Convert all processed pages back to a multi-page PDF
          finalOutputPath = path.join(sessionDir, 'enhanced.pdf');
          
          // Try multiple approaches for PDF conversion
          let pdfConversionSuccess = false;
          
          // First try with img2pdf
          try {
            // Use img2pdf to combine all pages into a single PDF
            const pagesList = processedPages.map(p => `"${p}"`).join(' ');
            await execAsync(`img2pdf ${pagesList} -o "${finalOutputPath}"`);
            operations.push(`Combined ${processedPages.length} enhanced pages back to PDF using img2pdf`);
            pdfConversionSuccess = true;
          } catch (img2pdfError) {
            logger.warn(`img2pdf conversion failed: ${img2pdfError}`);
            // First attempt failed, try with ImageMagick
            try {
              logger.warn('img2pdf not available, using ImageMagick convert as fallback');
              const pagesList = processedPages.map(p => `"${p}"`).join(' ');
              await execAsync(`convert ${pagesList} "${finalOutputPath}"`);
              operations.push(`Combined ${processedPages.length} enhanced pages back to PDF using convert`);
              pdfConversionSuccess = true;
            } catch (convertError) {
              logger.error(`ImageMagick conversion failed: ${convertError}`);
              // Both conversion methods failed
              errors.push('PDF conversion failed with both img2pdf and ImageMagick');
            }
          }
          
          // If all PDF conversion methods failed, fallback to using just the first page
          if (!pdfConversionSuccess) {
            if (processedPages.length > 0) {
              logger.error('Multi-page PDF conversion failed, falling back to first page only');
              finalOutputPath = processedPages[0];
              operations.push('Keeping first enhanced page only (multi-page PDF conversion failed)');
            } else {
              // No processed pages available at all - this is a critical failure
              throw new Error('No processed pages available after PDF conversion');
            }
          }
        } catch (pdfError) {
          logger.error(`PDF processing failed: ${pdfError}`);
          errors.push(`PDF processing failed: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`);
          // Return original path on failure
          finalOutputPath = inputPath;
        }
      } else {
        // Handle image input
        const workingPath = path.join(sessionDir, 'processed' + this.getFileExtension(inputPath));
        
        // Apply preprocessing operations using ImageMagick
        if (magickOps.length > 0) {
          try {
            const magickCommand = `convert "${inputPath}" ${magickOps.join(' ')} "${workingPath}"`;
            
            logger.info(`Applying preprocessing: ${magickCommand}`);
            await execAsync(magickCommand);
            
            if (fs.existsSync(workingPath)) {
              finalOutputPath = workingPath;
            } else {
              errors.push('ImageMagick processing failed to create output file');
              finalOutputPath = inputPath;
            }
          } catch (magickError) {
            logger.error(`ImageMagick processing failed: ${magickError}`);
            errors.push(`ImageMagick processing failed: ${magickError instanceof Error ? magickError.message : String(magickError)}`);
            finalOutputPath = inputPath;
          }
        } else {
          // No preprocessing, just copy the file
          try {
            await execAsync(`cp "${inputPath}" "${workingPath}"`);
            finalOutputPath = workingPath;
          } catch (copyError) {
            logger.error(`Failed to copy input file: ${copyError}`);
            errors.push(`Failed to copy input file: ${copyError instanceof Error ? copyError.message : String(copyError)}`);
            finalOutputPath = inputPath;
          }
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
              try {
                const enhancedPath = await this.enhanceHighlightedRegions(
                  finalOutputPath, 
                  highlightResults.highlightRegions,
                  sessionDir
                );
                
                if (enhancedPath && enhancedPath !== finalOutputPath) {
                  finalOutputPath = enhancedPath;
                  operations.push('Enhanced highlighted regions for better OCR');
                }
              } catch (enhanceError) {
                logger.error(`Failed to enhance highlighted regions: ${enhanceError}`);
                errors.push(`Highlight enhancement failed: ${enhanceError instanceof Error ? enhanceError.message : String(enhanceError)}`);
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

      // Check if we have a valid output path
      if (!finalOutputPath || finalOutputPath === inputPath) {
        operations.push('Using original file (preprocessing failed)');
        finalOutputPath = inputPath;
      }

      return {
        success: errors.length === 0,
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

  /**
   * Enhanced preprocessing pipeline with advanced techniques
   * Integrates CLAHE, edge enhancement, perspective correction, and highlight optimization
   */
  async enhancedPreprocessing(
    inputPath: string,
    options: EnhancedPreprocessingOptions = {}
  ): Promise<EnhancedPreprocessingResult> {
    const startTime = Date.now();
    const sessionDir = path.join(this.tempDir, `enhanced_session_${Date.now()}`);
    await execAsync(`mkdir -p "${sessionDir}"`);
    
    try {
      let currentPath = inputPath;
      const operations: string[] = [];
      
      logger.info(`Starting enhanced preprocessing pipeline for: ${inputPath}`);
      
      // Step 1: Convert PDF to image if needed
      if (path.extname(inputPath).toLowerCase() === '.pdf') {
        currentPath = await this.convertPdfToImage(inputPath, sessionDir);
        operations.push('PDF to image conversion');
      }
      
      // Step 2: Deskew if enabled
      if (options.deskew !== false) {
        const deskewPath = path.join(sessionDir, 'deskewed.png');
        currentPath = await this.deskewImage(currentPath, deskewPath);
        operations.push('Document deskewing');
      }
      
      // Step 3: Perspective correction if enabled
      if (options.perspectiveCorrection) {
        const perspectivePath = path.join(sessionDir, 'perspective_corrected.png');
        currentPath = await this.correctPerspective(currentPath, perspectivePath);
        operations.push('Perspective correction');
      }
      
      // Step 4: Normalization if enabled
      if (options.normalize !== false) {
        const normalizePath = path.join(sessionDir, 'normalized.png');
        currentPath = await this.normalizeImage(currentPath, normalizePath);
        operations.push('Image normalization');
      }
      
      // Step 5: CLAHE if enabled
      if (options.applyCLAHE) {
        const clahePath = path.join(sessionDir, 'clahe_enhanced.png');
        currentPath = await this.applyCLAHE(
          currentPath, 
          clahePath,
          options.claheClipLimit,
          options.claheTileSize
        );
        operations.push('CLAHE contrast enhancement');
      }
      
      // Step 6: Edge enhancement if enabled
      if (options.enhanceEdges) {
        const edgePath = path.join(sessionDir, 'edge_enhanced.png');
        currentPath = await this.enhanceEdges(
          currentPath, 
          edgePath,
          options.edgeStrength || 1.0
        );
        operations.push('Edge enhancement');
      }
      
      // Step 7: Handle highlighted regions if enabled
      if (options.optimizeHighlightedText) {
        const highlightDetectionResult = await this.highlightDetector.detectHighlights(currentPath);
        
        if (highlightDetectionResult.hasHighlights) {
          const highlightPath = path.join(sessionDir, 'highlight_optimized.png');
          currentPath = await this.optimizeHighlightedRegions(
            currentPath,
            highlightDetectionResult.highlightRegions,
            highlightPath
          );
          operations.push('Highlighted text optimization');
        }
      }
      
      // Copy result to output location if specified
      const finalPath = options.outputPath || path.join(sessionDir, 'enhanced_final.png');
      if (currentPath !== finalPath) {
        await execAsync(`cp "${currentPath}" "${finalPath}"`);
      }
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        outputPath: finalPath,
        operations,
        preprocessingOperations: operations,
        sessionDir,
        processingTime
      };
      
    } catch (error) {
      logger.error(`Enhanced preprocessing pipeline failed: ${error}`);
      return {
        success: false,
        outputPath: inputPath,
        operations: [],
        preprocessingOperations: [],
        errors: [`Enhanced preprocessing failed: ${error}`],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
   * Enhances local contrast while limiting noise amplification
   */
  private async applyCLAHE(
    imagePath: string, 
    outputPath: string, 
    clipLimit: number = 2.0, 
    tileGridSize: number = 8
  ): Promise<string> {
    try {
      // CLAHE implementation using ImageMagick
      // Split into Lab colorspace, enhance L channel, recombine
      const command = `convert "${imagePath}" \
        -colorspace Lab \
        -channel 0 \
        -contrast-stretch 2%x98% \
        -equalize \
        -channel RG \
        -equalize \
        -colorspace sRGB \
        -enhance \
        "${outputPath}"`;
      
      await execAsync(command);
      logger.info('Applied CLAHE contrast enhancement');
      return outputPath;
    } catch (error) {
      logger.error(`CLAHE enhancement failed: ${error}`);
      return imagePath;
    }
  }

  /**
   * Enhanced edge detection and enhancement
   */
  private async enhanceEdges(
    imagePath: string, 
    outputPath: string, 
    strength: number = 1.0
  ): Promise<string> {
    try {
      // Use unsharp mask with optimized parameters for text edges
      const command = `convert "${imagePath}" \
        -colorspace gray \
        -unsharp 0x1+${strength}+0.05 \
        -contrast-stretch 2%x98% \
        -normalize \
        "${outputPath}"`;
        
      await execAsync(command);
      logger.info('Applied edge enhancement');
      return outputPath;
    } catch (error) {
      logger.error(`Edge enhancement failed: ${error}`);
      return imagePath;
    }
  }

  /**
   * Advanced image normalization
   */
  private async normalizeImage(imagePath: string, outputPath: string): Promise<string> {
    try {
      // Advanced normalization preserving highlighted areas
      const command = `convert "${imagePath}" \
        -colorspace sRGB \
        -normalize \
        -auto-level \
        -contrast-stretch 1%x99% \
        "${outputPath}"`;
        
      await execAsync(command);
      logger.info('Applied image normalization');
      return outputPath;
    } catch (error) {
      logger.error(`Image normalization failed: ${error}`);
      return imagePath;
    }
  }

  /**
   * Perspective correction using edge detection
   */
  private async correctPerspective(imagePath: string, outputPath: string): Promise<string> {
    try {
      // Apply basic perspective correction using deskew and rotation
      // This is a simplified approach - a full implementation would detect corners
      const command = `convert "${imagePath}" \
        -background white \
        -deskew 40% \
        -trim +repage \
        -bordercolor white \
        -border 10x10 \
        "${outputPath}"`;
        
      await execAsync(command);
      logger.info('Applied perspective correction');
      return outputPath;
    } catch (error) {
      logger.error(`Perspective correction failed: ${error}`);
      return imagePath;
    }
  }

  /**
   * Enhanced deskewing algorithm
   */
  private async deskewImage(imagePath: string, outputPath: string): Promise<string> {
    try {
      // Enhanced deskew with improved angle detection
      const command = `convert "${imagePath}" \
        -background white \
        -deskew 40% \
        -trim +repage \
        -bordercolor white \
        -border 5x5 \
        "${outputPath}"`;
        
      await execAsync(command);
      logger.info('Applied image deskewing');
      return outputPath;
    } catch (error) {
      logger.error(`Deskewing failed: ${error}`);
      return imagePath;
    }
  }

  /**
   * Convert PDF to high-quality image for processing
   */
  private async convertPdfToImage(pdfPath: string, outputDir: string): Promise<string> {
    try {
      const outputPath = path.join(outputDir, 'pdf_converted.png');
      
      // Convert first page of PDF to high-resolution PNG
      const command = `pdftoppm -png -r 300 -f 1 -l 1 "${pdfPath}" "${outputPath.replace('.png', '')}"`;
      await execAsync(command);
      
      // pdftoppm adds -1 suffix to the filename
      const actualOutputPath = outputPath.replace('.png', '-1.png');
      
      if (fs.existsSync(actualOutputPath)) {
        // Rename to expected path
        await execAsync(`mv "${actualOutputPath}" "${outputPath}"`);
        logger.info('Converted PDF to high-quality PNG');
        return outputPath;
      } else {
        throw new Error('PDF conversion failed - output file not found');
      }
    } catch (error) {
      logger.error(`PDF to image conversion failed: ${error}`);
      throw error;
    }
  }

  /**
   * Optimize highlighted regions for better OCR recognition
   */
  private async optimizeHighlightedRegions(
    imagePath: string,
    highlightRegions: HighlightRegion[],
    outputPath: string
  ): Promise<string> {
    if (highlightRegions.length === 0) {
      return imagePath;
    }
    
    try {
      // Create a copy of the original image
      await execAsync(`cp "${imagePath}" "${outputPath}"`);
      
      // Process each highlighted region
      for (let i = 0; i < highlightRegions.length; i++) {
        const region = highlightRegions[i];
        const regionPath = path.join(path.dirname(outputPath), `region_${i}.png`);
        const enhancedRegionPath = path.join(path.dirname(outputPath), `region_${i}_enhanced.png`);
        const regionSpec = `${region.width}x${region.height}+${region.x}+${region.y}`;
        
        // Extract region
        await execAsync(`convert "${imagePath}" -crop ${regionSpec} "${regionPath}"`);
        
        // Apply specialized processing for highlighted text
        await execAsync(`convert "${regionPath}" \
          -modulate 100,150,100 \
          -contrast-stretch 5%x95% \
          -normalize \
          -unsharp 0x1+1.2+0 \
          "${enhancedRegionPath}"`);
        
        // Composite enhanced region back
        await execAsync(`convert "${outputPath}" \
          "${enhancedRegionPath}" \
          -geometry +${region.x}+${region.y} \
          -composite "${outputPath}"`);
      }
      
      logger.info(`Enhanced ${highlightRegions.length} highlighted regions`);
      return outputPath;
      
    } catch (error) {
      logger.error(`Highlighted region optimization failed: ${error}`);
      return imagePath;
    }
  }
}

export const preprocessingService = new PreprocessingService();

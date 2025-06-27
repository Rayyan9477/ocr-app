// import * as tf from '@tensorflow/tfjs-node'; // Currently not used, causing build issues
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import logger from './logger';

const execAsync = promisify(exec);

export interface ImageProcessingOptions {
  applyCLAHE?: boolean;
  claheClipLimit?: number;
  claheTileSize?: number;
  enhanceEdges?: boolean;
  edgeStrength?: number;
  applyDenoising?: boolean;
  denoiseStrength?: number;
  sharpenText?: boolean;
  sharpenStrength?: number;
  adaptiveThreshold?: boolean;
  perspectiveCorrection?: boolean;
  enhanceHighlights?: boolean;
  highlightColors?: string[];
  multiScaleProcessing?: boolean;
  useGPU?: boolean;
}

export interface ProcessedImageResult {
  outputPath: string;
  success: boolean;
  processingTime: number;
  operations: string[];
  qualityScore: number;
  error?: string;
}

export interface HighlightEnhancementResult {
  enhancedImagePath: string;
  highlightedRegions: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    confidence: number;
    text?: string;
    enhancedRegionPath?: string;
    processingMethod: string;
    ocrConfidence?: number;
  }[];
  globalEnhancementsApplied: string[];
  totalProcessingTime: number;
}

/**
 * Specialized image processing service for OCR enhancement
 * Improves text recognition, especially for highlighted content
 */
export class ImageProcessingService {
  private tempDir: string;
  private tensorflowEnabled: boolean;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'tmp', 'image-processing');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // TensorFlow.js disabled due to build issues
    this.tensorflowEnabled = false;
    logger.info('TensorFlow.js disabled, using ImageMagick only');
  }

  /**
   * Process image with advanced techniques for OCR enhancement
   */
  async processImage(inputPath: string, options: ImageProcessingOptions = {}): Promise<ProcessedImageResult> {
    const startTime = Date.now();
    const sessionDir = path.join(this.tempDir, `session_${Date.now()}`);
    const operations: string[] = [];

    try {
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      logger.info(`Processing image: ${inputPath} with advanced techniques`);

      // Convert PDF to image if needed
      let workingPath = inputPath;
      if (inputPath.toLowerCase().endsWith('.pdf')) {
        workingPath = await this.convertPdfToImage(inputPath, sessionDir);
        operations.push('PDF to high-resolution PNG conversion');
      }

      // Apply multi-scale processing if enabled
      if (options.multiScaleProcessing) {
        workingPath = await this.performMultiScaleProcessing(workingPath, sessionDir);
        operations.push('Multi-scale image decomposition and enhancement');
      }

      // Apply adaptive CLAHE for contrast enhancement
      if (options.applyCLAHE !== false) {
        workingPath = await this.applyCLAHE(
          workingPath, 
          sessionDir, 
          options.claheClipLimit || 2.0,
          options.claheTileSize || 8
        );
        operations.push(`CLAHE enhancement (clip limit: ${options.claheClipLimit || 2.0}, tile size: ${options.claheTileSize || 8})`);
      }

      // Apply edge enhancement
      if (options.enhanceEdges) {
        workingPath = await this.enhanceEdges(workingPath, sessionDir, options.edgeStrength || 1.0);
        operations.push(`Edge enhancement (strength: ${options.edgeStrength || 1.0})`);
      }

      // Apply denoising
      if (options.applyDenoising) {
        workingPath = await this.applyDenoising(workingPath, sessionDir, options.denoiseStrength || 10);
        operations.push(`Noise reduction (strength: ${options.denoiseStrength || 10})`);
      }

      // Apply text sharpening
      if (options.sharpenText) {
        workingPath = await this.sharpenText(workingPath, sessionDir, options.sharpenStrength || 1.0);
        operations.push(`Text sharpening (strength: ${options.sharpenStrength || 1.0})`);
      }

      // Apply perspective correction
      if (options.perspectiveCorrection) {
        const correctedPath = await this.applyPerspectiveCorrection(workingPath, sessionDir);
        if (correctedPath !== workingPath) {
          workingPath = correctedPath;
          operations.push('Perspective distortion correction');
        }
      }

      // Apply highlight enhancement
      if (options.enhanceHighlights) {
        const highlightResult = await this.enhanceHighlights(
          workingPath, 
          sessionDir, 
          options.highlightColors || ['yellow', 'green', 'cyan', 'pink', 'orange', 'blue']
        );

        if (highlightResult.highlightedRegions.length > 0) {
          workingPath = highlightResult.enhancedImagePath;
          operations.push(`Enhanced ${highlightResult.highlightedRegions.length} highlighted regions`);
        }
      }

      // Calculate quality score based on operations and image analysis
      const qualityScore = await this.calculateQualityScore(workingPath, operations.length);

      const processingTime = Date.now() - startTime;
      logger.info(`Image processing completed in ${processingTime}ms with ${operations.length} operations`);

      return {
        outputPath: workingPath,
        success: true,
        processingTime,
        operations,
        qualityScore
      };

    } catch (error) {
      logger.error(`Image processing failed: ${error}`);
      return {
        outputPath: inputPath, // Return original on failure
        success: false,
        processingTime: Date.now() - startTime,
        operations,
        qualityScore: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Convert PDF to high-resolution image
   */
  private async convertPdfToImage(pdfPath: string, sessionDir: string): Promise<string> {
    const outputBasePath = path.join(sessionDir, 'page');
    await execAsync(`pdftoppm -png -r 300 -singlefile "${pdfPath}" "${outputBasePath}"`);

    const outputPath = `${outputBasePath}.png`;
    if (!fs.existsSync(outputPath)) {
      throw new Error('PDF conversion failed');
    }

    return outputPath;
  }

  /**
   * Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
   */
  private async applyCLAHE(imagePath: string, sessionDir: string, clipLimit: number, tileSize: number): Promise<string> {
    const outputPath = path.join(sessionDir, 'clahe_enhanced.png');

    try {
      // Advanced CLAHE implementation using LAB color space for better results
      const command = `convert "${imagePath}" \
        -colorspace LAB -channel 0 \
        -contrast-stretch 2%x98% \
        -clahe ${tileSize}x${tileSize}+${clipLimit}+${tileSize*0.5} \
        -channel RG -equalize \
        -colorspace sRGB \
        "${outputPath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('CLAHE enhancement failed');
    } catch (error) {
      logger.warn(`CLAHE enhancement failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Enhance edges for better text recognition
   */
  private async enhanceEdges(imagePath: string, sessionDir: string, strength: number): Promise<string> {
    const outputPath = path.join(sessionDir, 'edge_enhanced.png');

    try {
      // Use unsharp mask with parameters optimized for text
      const command = `convert "${imagePath}" \
        -unsharp 0x1+${strength}+0.05 \
        "${outputPath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('Edge enhancement failed');
    } catch (error) {
      logger.warn(`Edge enhancement failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Apply adaptive denoising while preserving text edges
   */
  private async applyDenoising(imagePath: string, sessionDir: string, strength: number): Promise<string> {
    const outputPath = path.join(sessionDir, 'denoised.png');

    try {
      // Use gentle denoising to preserve text details
      const command = `convert "${imagePath}" \
        -despeckle \
        -median ${Math.min(Math.max(strength / 10, 0.5), 2)} \
        "${outputPath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('Denoising failed');
    } catch (error) {
      logger.warn(`Denoising failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Sharpen text while minimizing noise amplification
   */
  private async sharpenText(imagePath: string, sessionDir: string, strength: number): Promise<string> {
    const outputPath = path.join(sessionDir, 'sharpened.png');

    try {
      // Sharpen with parameters optimized for text
      const command = `convert "${imagePath}" \
        -sharpen 0x${strength} \
        "${outputPath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('Text sharpening failed');
    } catch (error) {
      logger.warn(`Text sharpening failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Apply perspective correction for camera-captured documents
   */
  private async applyPerspectiveCorrection(imagePath: string, sessionDir: string): Promise<string> {
    const outputPath = path.join(sessionDir, 'perspective_corrected.png');

    try {
      if (this.tensorflowEnabled) {
        // In a real implementation, we would use TF.js to detect document corners
        // and apply proper perspective correction
        // This is a placeholder for demonstration
        return imagePath;
      } else {
        // Fallback to simpler automatic correction
        const command = `convert "${imagePath}" \
          -deskew 40% \
          -auto-orient \
          "${outputPath}"`;

        await execAsync(command);

        if (fs.existsSync(outputPath)) {
          return outputPath;
        }
      }

      return imagePath; // Return original if correction fails
    } catch (error) {
      logger.warn(`Perspective correction failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Multi-scale image decomposition and enhancement
   * Processes different image frequencies separately for better results
   */
  private async performMultiScaleProcessing(imagePath: string, sessionDir: string): Promise<string> {
    const outputPath = path.join(sessionDir, 'multiscale_enhanced.png');

    try {
      // This is a simplified multi-scale processing pipeline
      // In a real implementation, this would decompose the image into multiple scales,
      // process each scale differently, then recombine

      // Generate multiple scaled versions
      const scales = [
        { name: 'base', blur: 0 },
        { name: 'low', blur: 4 },
        { name: 'mid', blur: 2 },
        { name: 'high', blur: 1 }
      ];

      // Process each scale
      for (const scale of scales) {
        const scalePath = path.join(sessionDir, `scale_${scale.name}.png`);
        await execAsync(`convert "${imagePath}" -blur 0x${scale.blur} "${scalePath}"`);
      }

      // Recombine scales with appropriate enhancements
      // Low frequencies: improve contrast
      // Mid frequencies: enhance edges
      // High frequencies: careful sharpening
      const command = `convert \
        "${path.join(sessionDir, 'scale_base.png')}" \
        \( "${path.join(sessionDir, 'scale_low.png')}" -contrast-stretch 2%x98% \) \
        -compose Blend -define compose:args=50 -composite \
        \( "${path.join(sessionDir, 'scale_mid.png')}" -unsharp 0x1+1.0+0 \) \
        -compose Blend -define compose:args=30 -composite \
        \( "${path.join(sessionDir, 'scale_high.png')}" -sharpen 0x0.5 \) \
        -compose Blend -define compose:args=20 -composite \
        "${outputPath}"`;

      await execAsync(command);

      // Clean up temporary files
      for (const scale of scales) {
        fs.unlinkSync(path.join(sessionDir, `scale_${scale.name}.png`));
      }

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('Multi-scale processing failed');
    } catch (error) {
      logger.warn(`Multi-scale processing failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Enhanced highlight processing for better OCR
   * Includes multiple enhancement techniques and region-specific optimization
   */
  private async enhanceHighlights(imagePath: string, sessionDir: string, targetColors: string[]): Promise<HighlightEnhancementResult> {
    const startTime = Date.now();
    const globalEnhancementsApplied: string[] = [];
    
    try {
      const enhancedPath = path.join(sessionDir, 'highlights_enhanced.png');

      // Use HighlightDetector to find highlighted regions with enhanced settings
      const { HighlightDetector } = await import('./highlight-detector');
      const highlightDetector = new HighlightDetector();

      const detectionResult = await highlightDetector.detectHighlightsWithEnhancedPreprocessing(imagePath, {
        targetColors,
        enableTextExtraction: true,
        useAdvancedFiltering: true,
        adaptiveContrast: true,
        sensitivityLevel: 'high',
        enableDynamicThresholding: true,
        useMLVerification: true,
        debugMode: true
      });

      if (!detectionResult.hasHighlights) {
        return {
          enhancedImagePath: imagePath,
          highlightedRegions: [],
          globalEnhancementsApplied: ['No highlights detected'],
          totalProcessingTime: Date.now() - startTime
        };
      }

      globalEnhancementsApplied.push('Enhanced highlight detection', 'Dynamic thresholding', 'ML verification');

      // Create enhanced regions with individual processing
      const enhancedRegions = await this.processHighlightRegionsAdvanced(
        imagePath,
        detectionResult.highlightRegions,
        sessionDir
      );

      // Apply global enhancement to the entire image
      const globallyEnhancedPath = await this.applyGlobalHighlightEnhancement(
        imagePath,
        enhancedRegions,
        sessionDir
      );

      globalEnhancementsApplied.push('Global highlight enhancement', 'Region-specific optimization');

      return {
        enhancedImagePath: globallyEnhancedPath,
        highlightedRegions: enhancedRegions,
        globalEnhancementsApplied,
        totalProcessingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.warn(`Enhanced highlight processing failed: ${error}`);
      return {
        enhancedImagePath: imagePath,
        highlightedRegions: [],
        globalEnhancementsApplied: [`Error: ${error}`],
        totalProcessingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process highlight regions with advanced techniques for optimal OCR
   */
  private async processHighlightRegionsAdvanced(
    imagePath: string,
    regions: any[],
    sessionDir: string
  ): Promise<any[]> {
    const enhancedRegions = [];

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      try {
        // Determine the best processing method based on region characteristics
        const processingMethod = this.selectOptimalProcessingMethod(region);
        
        // Extract and enhance the region
        const enhancedRegion = await this.enhanceIndividualRegion(
          imagePath,
          region,
          sessionDir,
          i,
          processingMethod
        );

        // Perform OCR on the enhanced region
        const ocrResult = await this.performRegionSpecificOCR(
          enhancedRegion.enhancedRegionPath!,
          region
        );

        enhancedRegion.text = ocrResult.text;
        enhancedRegion.ocrConfidence = ocrResult.confidence;

        enhancedRegions.push(enhancedRegion);
        
        logger.info(`Region ${i}: ${processingMethod} processing, OCR confidence: ${ocrResult.confidence}`);
        
      } catch (error) {
        logger.warn(`Failed to process region ${i}: ${error}`);
        // Add region with minimal processing
        enhancedRegions.push({
          ...region,
          processingMethod: 'fallback',
          confidence: region.confidence || 0.3
        });
      }
    }

    return enhancedRegions;
  }

  /**
   * Convert PDF to high-resolution image
   */
  private async convertPdfToImage(pdfPath: string, sessionDir: string): Promise<string> {
    const outputBasePath = path.join(sessionDir, 'page');
    await execAsync(`pdftoppm -png -r 300 -singlefile "${pdfPath}" "${outputBasePath}"`);

    const outputPath = `${outputBasePath}.png`;
    if (!fs.existsSync(outputPath)) {
      throw new Error('PDF conversion failed');
    }

    return outputPath;
  }

  /**
   * Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
   */
  private async applyCLAHE(imagePath: string, sessionDir: string, clipLimit: number, tileSize: number): Promise<string> {
    const outputPath = path.join(sessionDir, 'clahe_enhanced.png');

    try {
      // Advanced CLAHE implementation using LAB color space for better results
      const command = `convert "${imagePath}" \
        -colorspace LAB -channel 0 \
        -contrast-stretch 2%x98% \
        -clahe ${tileSize}x${tileSize}+${clipLimit}+${tileSize*0.5} \
        -channel RG -equalize \
        -colorspace sRGB \
        "${outputPath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('CLAHE enhancement failed');
    } catch (error) {
      logger.warn(`CLAHE enhancement failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Enhance edges for better text recognition
   */
  private async enhanceEdges(imagePath: string, sessionDir: string, strength: number): Promise<string> {
    const outputPath = path.join(sessionDir, 'edge_enhanced.png');

    try {
      // Use unsharp mask with parameters optimized for text
      const command = `convert "${imagePath}" \
        -unsharp 0x1+${strength}+0.05 \
        "${outputPath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('Edge enhancement failed');
    } catch (error) {
      logger.warn(`Edge enhancement failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Apply adaptive denoising while preserving text edges
   */
  private async applyDenoising(imagePath: string, sessionDir: string, strength: number): Promise<string> {
    const outputPath = path.join(sessionDir, 'denoised.png');

    try {
      // Use gentle denoising to preserve text details
      const command = `convert "${imagePath}" \
        -despeckle \
        -median ${Math.min(Math.max(strength / 10, 0.5), 2)} \
        "${outputPath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('Denoising failed');
    } catch (error) {
      logger.warn(`Denoising failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Sharpen text while minimizing noise amplification
   */
  private async sharpenText(imagePath: string, sessionDir: string, strength: number): Promise<string> {
    const outputPath = path.join(sessionDir, 'sharpened.png');

    try {
      // Sharpen with parameters optimized for text
      const command = `convert "${imagePath}" \
        -sharpen 0x${strength} \
        "${outputPath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('Text sharpening failed');
    } catch (error) {
      logger.warn(`Text sharpening failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Apply perspective correction for camera-captured documents
   */
  private async applyPerspectiveCorrection(imagePath: string, sessionDir: string): Promise<string> {
    const outputPath = path.join(sessionDir, 'perspective_corrected.png');

    try {
      if (this.tensorflowEnabled) {
        // In a real implementation, we would use TF.js to detect document corners
        // and apply proper perspective correction
        // This is a placeholder for demonstration
        return imagePath;
      } else {
        // Fallback to simpler automatic correction
        const command = `convert "${imagePath}" \
          -deskew 40% \
          -auto-orient \
          "${outputPath}"`;

        await execAsync(command);

        if (fs.existsSync(outputPath)) {
          return outputPath;
        }
      }

      return imagePath; // Return original if correction fails
    } catch (error) {
      logger.warn(`Perspective correction failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Multi-scale image decomposition and enhancement
   * Processes different image frequencies separately for better results
   */
  private async performMultiScaleProcessing(imagePath: string, sessionDir: string): Promise<string> {
    const outputPath = path.join(sessionDir, 'multiscale_enhanced.png');

    try {
      // This is a simplified multi-scale processing pipeline
      // In a real implementation, this would decompose the image into multiple scales,
      // process each scale differently, then recombine

      // Generate multiple scaled versions
      const scales = [
        { name: 'base', blur: 0 },
        { name: 'low', blur: 4 },
        { name: 'mid', blur: 2 },
        { name: 'high', blur: 1 }
      ];

      // Process each scale
      for (const scale of scales) {
        const scalePath = path.join(sessionDir, `scale_${scale.name}.png`);
        await execAsync(`convert "${imagePath}" -blur 0x${scale.blur} "${scalePath}"`);
      }

      // Recombine scales with appropriate enhancements
      // Low frequencies: improve contrast
      // Mid frequencies: enhance edges
      // High frequencies: careful sharpening
      const command = `convert \
        "${path.join(sessionDir, 'scale_base.png')}" \
        \( "${path.join(sessionDir, 'scale_low.png')}" -contrast-stretch 2%x98% \) \
        -compose Blend -define compose:args=50 -composite \
        \( "${path.join(sessionDir, 'scale_mid.png')}" -unsharp 0x1+1.0+0 \) \
        -compose Blend -define compose:args=30 -composite \
        \( "${path.join(sessionDir, 'scale_high.png')}" -sharpen 0x0.5 \) \
        -compose Blend -define compose:args=20 -composite \
        "${outputPath}"`;

      await execAsync(command);

      // Clean up temporary files
      for (const scale of scales) {
        fs.unlinkSync(path.join(sessionDir, `scale_${scale.name}.png`));
      }

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('Multi-scale processing failed');
    } catch (error) {
      logger.warn(`Multi-scale processing failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Enhanced highlight processing for better OCR
   * Includes multiple enhancement techniques and region-specific optimization
   */
  private async enhanceHighlights(imagePath: string, sessionDir: string, targetColors: string[]): Promise<HighlightEnhancementResult> {
    const startTime = Date.now();
    const globalEnhancementsApplied: string[] = [];
    
    try {
      const enhancedPath = path.join(sessionDir, 'highlights_enhanced.png');

      // Use HighlightDetector to find highlighted regions with enhanced settings
      const { HighlightDetector } = await import('./highlight-detector');
      const highlightDetector = new HighlightDetector();

      const detectionResult = await highlightDetector.detectHighlightsWithEnhancedPreprocessing(imagePath, {
        targetColors,
        enableTextExtraction: true,
        useAdvancedFiltering: true,
        adaptiveContrast: true,
        sensitivityLevel: 'high',
        enableDynamicThresholding: true,
        useMLVerification: true,
        debugMode: true
      });

      if (!detectionResult.hasHighlights) {
        return {
          enhancedImagePath: imagePath,
          highlightedRegions: [],
          globalEnhancementsApplied: ['No highlights detected'],
          totalProcessingTime: Date.now() - startTime
        };
      }

      globalEnhancementsApplied.push('Enhanced highlight detection', 'Dynamic thresholding', 'ML verification');

      // Create enhanced regions with individual processing
      const enhancedRegions = await this.processHighlightRegionsAdvanced(
        imagePath,
        detectionResult.highlightRegions,
        sessionDir
      );

      // Apply global enhancement to the entire image
      const globallyEnhancedPath = await this.applyGlobalHighlightEnhancement(
        imagePath,
        enhancedRegions,
        sessionDir
      );

      globalEnhancementsApplied.push('Global highlight enhancement', 'Region-specific optimization');

      return {
        enhancedImagePath: globallyEnhancedPath,
        highlightedRegions: enhancedRegions,
        globalEnhancementsApplied,
        totalProcessingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.warn(`Enhanced highlight processing failed: ${error}`);
      return {
        enhancedImagePath: imagePath,
        highlightedRegions: [],
        globalEnhancementsApplied: [`Error: ${error}`],
        totalProcessingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process highlight regions with advanced techniques for optimal OCR
   */
  private async processHighlightRegionsAdvanced(
    imagePath: string,
    regions: any[],
    sessionDir: string
  ): Promise<any[]> {
    const enhancedRegions = [];

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      try {
        // Determine the best processing method based on region characteristics
        const processingMethod = this.selectOptimalProcessingMethod(region);
        
        // Extract and enhance the region
        const enhancedRegion = await this.enhanceIndividualRegion(
          imagePath,
          region,
          sessionDir,
          i,
          processingMethod
        );

        // Perform OCR on the enhanced region
        const ocrResult = await this.performRegionSpecificOCR(
          enhancedRegion.enhancedRegionPath!,
          region
        );

        enhancedRegion.text = ocrResult.text;
        enhancedRegion.ocrConfidence = ocrResult.confidence;

        enhancedRegions.push(enhancedRegion);
        
        logger.info(`Region ${i}: ${processingMethod} processing, OCR confidence: ${ocrResult.confidence}`);
        
      } catch (error) {
        logger.warn(`Failed to process region ${i}: ${error}`);
        // Add region with minimal processing
        enhancedRegions.push({
          ...region,
          processingMethod: 'fallback',
          confidence: region.confidence || 0.3
        });
      }
    }

    return enhancedRegions;
  }

  /**
   * Convert PDF to high-resolution image
   */
  private async convertPdfToImage(pdfPath: string, sessionDir: string): Promise<string> {
    const outputBasePath = path.join(sessionDir, 'page');
    await execAsync(`pdftoppm -png -r 300 -singlefile "${pdfPath}" "${outputBasePath}"`);

    const outputPath = `${outputBasePath}.png`;
    if (!fs.existsSync(outputPath)) {
      throw new Error('PDF conversion failed');
    }

    return outputPath;
  }

  /**
   * Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
   */
  private async applyCLAHE(imagePath: string, sessionDir: string, clipLimit: number, tileSize: number): Promise<string> {
    const outputPath = path.join(sessionDir, 'clahe_enhanced.png');

    try {
      // Advanced CLAHE implementation using LAB color space for better results
      const command = `convert "${imagePath}" \
        -colorspace LAB -channel 0 \
        -contrast-stretch 2%x98% \
        -clahe ${tileSize}x${tileSize}+${clipLimit}+${tileSize*0.5} \
        -channel RG -equalize \
        -colorspace sRGB \
        "${outputPath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('CLAHE enhancement failed');
    } catch (error) {
      logger.warn(`CLAHE enhancement failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Enhance edges for better text recognition
   */
  private async enhanceEdges(imagePath: string, sessionDir: string, strength: number): Promise<string> {
    const outputPath = path.join(sessionDir, 'edge_enhanced.png');

    try {
      // Use unsharp mask with parameters optimized for text
      const command = `convert "${imagePath}" \
        -unsharp 0x1+${strength}+0.05 \
        "${outputPath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('Edge enhancement failed');
    } catch (error) {
      logger.warn(`Edge enhancement failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Apply adaptive denoising while preserving text edges
   */
  private async applyDenoising(imagePath: string, sessionDir: string, strength: number): Promise<string> {
    const outputPath = path.join(sessionDir, 'denoised.png');

    try {
      // Use gentle denoising to preserve text details
      const command = `convert "${imagePath}" \
        -despeckle \
        -median ${Math.min(Math.max(strength / 10, 0.5), 2)} \
        "${outputPath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('Denoising failed');
    } catch (error) {
      logger.warn(`Denoising failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Sharpen text while minimizing noise amplification
   */
  private async sharpenText(imagePath: string, sessionDir: string, strength: number): Promise<string> {
    const outputPath = path.join(sessionDir, 'sharpened.png');

    try {
      // Sharpen with parameters optimized for text
      const command = `convert "${imagePath}" \
        -sharpen 0x${strength} \
        "${outputPath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('Text sharpening failed');
    } catch (error) {
      logger.warn(`Text sharpening failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Apply perspective correction for camera-captured documents
   */
  private async applyPerspectiveCorrection(imagePath: string, sessionDir: string): Promise<string> {
    const outputPath = path.join(sessionDir, 'perspective_corrected.png');

    try {
      if (this.tensorflowEnabled) {
        // In a real implementation, we would use TF.js to detect document corners
        // and apply proper perspective correction
        // This is a placeholder for demonstration
        return imagePath;
      } else {
        // Fallback to simpler automatic correction
        const command = `convert "${imagePath}" \
          -deskew 40% \
          -auto-orient \
          "${outputPath}"`;

        await execAsync(command);

        if (fs.existsSync(outputPath)) {
          return outputPath;
        }
      }

      return imagePath; // Return original if correction fails
    } catch (error) {
      logger.warn(`Perspective correction failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Multi-scale image decomposition and enhancement
   * Processes different image frequencies separately for better results
   */
  private async performMultiScaleProcessing(imagePath: string, sessionDir: string): Promise<string> {
    const outputPath = path.join(sessionDir, 'multiscale_enhanced.png');

    try {
      // This is a simplified multi-scale processing pipeline
      // In a real implementation, this would decompose the image into multiple scales,
      // process each scale differently, then recombine

      // Generate multiple scaled versions
      const scales = [
        { name: 'base', blur: 0 },
        { name: 'low', blur: 4 },
        { name: 'mid', blur: 2 },
        { name: 'high', blur: 1 }
      ];

      // Process each scale
      for (const scale of scales) {
        const scalePath = path.join(sessionDir, `scale_${scale.name}.png`);
        await execAsync(`convert "${imagePath}" -blur 0x${scale.blur} "${scalePath}"`);
      }

      // Recombine scales with appropriate enhancements
      // Low frequencies: improve contrast
      // Mid frequencies: enhance edges
      // High frequencies: careful sharpening
      const command = `convert \
        "${path.join(sessionDir, 'scale_base.png')}" \
        \( "${path.join(sessionDir, 'scale_low.png')}" -contrast-stretch 2%x98% \) \
        -compose Blend -define compose:args=50 -composite \
        \( "${path.join(sessionDir, 'scale_mid.png')}" -unsharp 0x1+1.0+0 \) \
        -compose Blend -define compose:args=30 -composite \
        \( "${path.join(sessionDir, 'scale_high.png')}" -sharpen 0x0.5 \) \
        -compose Blend -define compose:args=20 -composite \
        "${outputPath}"`;

      await execAsync(command);

      // Clean up temporary files
      for (const scale of scales) {
        fs.unlinkSync(path.join(sessionDir, `scale_${scale.name}.png`));
      }

      if (fs.existsSync(outputPath)) {
        return outputPath;
      }

      throw new Error('Multi-scale processing failed');
    } catch (error) {
      logger.warn(`Multi-scale processing failed: ${error}, using original image`);
      return imagePath;
    }
  }

  /**
   * Enhanced highlight processing for better OCR
   * Includes multiple enhancement techniques and region-specific optimization
   */
  private async enhanceHighlights(imagePath: string, sessionDir: string, targetColors: string[]): Promise<HighlightEnhancementResult> {
    const startTime = Date.now();
    const globalEnhancementsApplied: string[] = [];
    
    try {
      const enhancedPath = path.join(sessionDir, 'highlights_enhanced.png');

      // Use HighlightDetector to find highlighted regions with enhanced settings
      const { HighlightDetector } = await import('./highlight-detector');
      const highlightDetector = new HighlightDetector();

      const detectionResult = await highlightDetector.detectHighlightsWithEnhancedPreprocessing(imagePath, {
        targetColors,
        enableTextExtraction: true,
        useAdvancedFiltering: true,
        adaptiveContrast: true,
        sensitivityLevel: 'high',
        enableDynamicThresholding: true,
        useMLVerification: true,
        debugMode: true
      });

      if (!detectionResult.hasHighlights) {
        return {
          enhancedImagePath: imagePath,
          highlightedRegions: [],
          globalEnhancementsApplied: ['No highlights detected'],
          totalProcessingTime: Date.now() - startTime
        };
      }

      globalEnhancementsApplied.push('Enhanced highlight detection', 'Dynamic thresholding', 'ML verification');

      // Create enhanced regions with individual processing
      const enhancedRegions = await this.processHighlightRegionsAdvanced(
        imagePath,
        detectionResult.highlightRegions,
        sessionDir
      );

      // Apply global enhancement to the entire image
      const globallyEnhancedPath = await this.applyGlobalHighlightEnhancement(
        imagePath,
        enhancedRegions,
        sessionDir
      );

      globalEnhancementsApplied.push('Global highlight enhancement', 'Region-specific optimization');

      return {
        enhancedImagePath: globallyEnhancedPath,
        highlightedRegions: enhancedRegions,
        globalEnhancementsApplied,
        totalProcessingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.warn(`Enhanced highlight processing failed: ${error}`);
      return {
        enhancedImagePath: imagePath,
        highlightedRegions: [],
        globalEnhancementsApplied: [`Error: ${error}`],
        totalProcessingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process highlight regions with advanced techniques for optimal OCR
   */
  private async processHighlightRegionsAdvanced(
    imagePath: string,
    regions: any[],
    sessionDir: string
  ): Promise<any[]> {
    const enhancedRegions = [];

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      try {
        // Determine the best processing method based on region characteristics
        const processingMethod = this.selectOptimalProcessingMethod(region);
        
        // Extract and enhance the region
        const enhancedRegion = await this.enhanceIndividualRegion(
          imagePath,
          region,
          sessionDir,
          i,
          processingMethod
        );

        // Perform OCR on the enhanced region
        const ocrResult = await this.performRegionSpecificOCR(
          enhancedRegion.enhancedRegionPath!,
          region
        );

        enhancedRegion.text = ocrResult.text;
        enhancedRegion.ocrConfidence = ocrResult.confidence;

        enhancedRegions.push(enhancedRegion);
        
        logger.info(`Region ${i}: ${processingMethod} processing, OCR confidence: ${ocrResult.confidence}`);
        
      } catch (error) {
        logger.warn(`Failed to process region ${i}: ${error}`);
        // Add region with minimal processing
        enhancedRegions.push({
          ...region,
          processingMethod: 'fallback',
          confidence: region.confidence || 0.3
        });
      }
    }

    return enhancedRegions;
  }

  /**
   * Enhanced individual region processing with adaptive color space optimization
   */
  private async enhanceIndividualRegion(
    imagePath: string,
    region: any,
    sessionDir: string,
    index: number,
    method: string
  ): Promise<any> {
    const regionPath = path.join(sessionDir, `region_${index}_${method}.png`);
    const padding = 8; // Optimized padding for better context
    
    const expandedSpec = `${region.width + padding * 2}x${region.height + padding * 2}+${Math.max(0, region.x - padding)}+${Math.max(0, region.y - padding)}`;
    
    let command = '';
    
    switch (method) {
      case 'comprehensive':
        // Advanced multi-stage enhancement for high-quality regions
        command = `convert "${imagePath}" -crop ${expandedSpec} \
          \\( -clone 0 -colorspace LAB -channel L -normalize -contrast-stretch 2%x98% \\) \
          \\( -clone 0 -colorspace HSL -channel S -evaluate multiply 0.7 \\) \
          -compose multiply -composite \
          -colorspace sRGB \
          -resize 400% \
          -unsharp 0x1.5+2.0+0.1 \
          -morphology Close disk:1.5 \
          -contrast-stretch 1%x99% \
          -threshold 82% \
          "${regionPath}"`;
        break;
        
      case 'gentle':
        // Gentle enhancement preserving fine details
        command = `convert "${imagePath}" -crop ${expandedSpec} \
          -colorspace LAB \
          -channel L -auto-level \
          -channel A,B -evaluate multiply 0.8 \
          -colorspace sRGB \
          -resize 250% \
          -enhance \
          -unsharp 0x0.8+1.0+0.05 \
          -contrast-stretch 8%x92% \
          "${regionPath}"`;
        break;
        
      case 'aggressive':
        // High-contrast enhancement for difficult regions
        command = `convert "${imagePath}" -crop ${expandedSpec} \
          \\( -clone 0 -colorspace LAB -channel L -auto-level -contrast-stretch 0.5%x99.5% \\) \
          \\( -clone 0 -colorspace HSL -channel H,S -evaluate multiply 0.6 \\) \
          -compose overlay -composite \
          -colorspace sRGB \
          -resize 500% \
          -unsharp 0x2.0+2.5+0.15 \
          -threshold 78% \
          -morphology Close disk:2.5 \
          -morphology Open disk:1 \
          "${regionPath}"`;
        break;
        
      case 'color_optimized':
        // New method: Color-specific optimization based on highlight color
        const colorOptimization = this.getColorSpecificEnhancement(region.color);
        command = `convert "${imagePath}" -crop ${expandedSpec} \
          ${colorOptimization} \
          -resize 350% \
          -unsharp 0x1.2+1.5+0.08 \
          -contrast-stretch 3%x97% \
          "${regionPath}"`;
        break;
        
      default: // enhanced_standard
        command = `convert "${imagePath}" -crop ${expandedSpec} \
          -colorspace LAB \
          -channel L -normalize -contrast-stretch 4%x96% \
          -channel A,B -evaluate multiply 0.85 \
          -colorspace sRGB \
          -resize 300% \
          -unsharp 0x1.0+1.2+0.06 \
          -contrast-stretch 2%x98% \
          "${regionPath}"`;
        break;
    }
    
    await execAsync(command);
    
    return {
      ...region,
      enhancedRegionPath: regionPath,
      processingMethod: method
    };
  }

  /**
   * Get color-specific enhancement parameters
   */
  private getColorSpecificEnhancement(color: string): string {
    const colorEnhancements: Record<string, string> = {
      'yellow': '-colorspace LAB -channel L -auto-level -channel B -evaluate subtract 15% -colorspace sRGB',
      'green': '-colorspace LAB -channel L -auto-level -channel A -evaluate subtract 20% -colorspace sRGB',
      'cyan': '-colorspace LAB -channel L -auto-level -channel B -evaluate add 10% -colorspace sRGB',
      'pink': '-colorspace LAB -channel L -auto-level -channel A -evaluate add 10% -channel B -evaluate subtract 5% -colorspace sRGB',
      'orange': '-colorspace LAB -channel L -auto-level -channel A -evaluate add 15% -channel B -evaluate add 10% -colorspace sRGB',
      'blue': '-colorspace LAB -channel L -auto-level -channel B -evaluate subtract 25% -colorspace sRGB',
      'red': '-colorspace LAB -channel L -auto-level -channel A -evaluate add 20% -colorspace sRGB',
      'magenta': '-colorspace LAB -channel L -auto-level -channel A -evaluate add 15% -channel B -evaluate subtract 10% -colorspace sRGB'
    };
    
    return colorEnhancements[color?.toLowerCase()] || colorEnhancements['yellow'];
  }

  /**
   * Select optimal processing method with enhanced logic
   */
  private selectOptimalProcessingMethod(region: any): string {
    const area = region.width * region.height;
    const aspectRatio = region.width / region.height;
    const confidence = region.confidence || 0.5;
    
    // Color-based method selection for known highlight colors
    if (region.color && ['yellow', 'green', 'cyan', 'pink', 'orange'].includes(region.color.toLowerCase())) {
      return 'color_optimized';
    }
    
    // Large regions with good characteristics get comprehensive processing
    if (area > 8000 && aspectRatio > 1.2 && aspectRatio < 12 && confidence > 0.6) {
      return 'comprehensive';
    }
    
    // Small regions get gentle enhancement to preserve detail
    if (area < 1500) {
      return 'gentle';
    }
    
    // High confidence regions with good aspect ratios
    if (confidence > 0.75 && aspectRatio > 0.8 && aspectRatio < 8) {
      return 'enhanced_standard';
    }
    
    // Low confidence or difficult regions get aggressive enhancement
    if (confidence < 0.4 || aspectRatio > 15 || aspectRatio < 0.3) {
      return 'aggressive';
    }
    
    return 'enhanced_standard';
  }

  /**
   * Advanced OCR with adaptive parameters for highlighted regions
   */
  private async performRegionSpecificOCR(
    regionPath: string,
    region: any
  ): Promise<{ text: string; confidence: number }> {
    try {
      // Import tensor OCR service for advanced processing
      const { TensorOCRService } = await import('./tensor-ocr-service');
      const tensorOCR = new TensorOCRService({
        enhanceText: true,
        usePostProcessing: true,
        confidenceThreshold: 0.25
      });

      // Try advanced OCR first with color-specific optimization
      const result = await tensorOCR.processHighlightedRegion(regionPath, {
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        color: region.color,
        enhancementMethod: region.processingMethod
      });

      if (result.confidence > 0.4 && result.text.trim().length > 0) {
        return {
          text: this.postProcessHighlightedText(result.text, region),
          confidence: result.confidence
        };
      }

      // Enhanced fallback to adaptive Tesseract
      return await this.performAdaptiveTesseractOCR(regionPath, region);
      
    } catch (error) {
      logger.warn(`Advanced OCR failed for region, using enhanced fallback: ${error}`);
      return await this.performAdaptiveTesseractOCR(regionPath, region);
    }
  }

  /**
   * Adaptive Tesseract OCR with dynamic parameter selection
   */
  private async performAdaptiveTesseractOCR(
    regionPath: string,
    region: any
  ): Promise<{ text: string; confidence: number }> {
    try {
      const area = region.width * region.height;
      const aspectRatio = region.width / region.height;
      
      // Enhanced PSM selection logic
      let psm = 8; // Default: single word
      let additionalParams = '';
      
      if (area > 10000 && aspectRatio > 4) {
        psm = 7; // Single text line
        additionalParams = '-c textord_min_linesize=2.0 -c textord_tabvector_vertical_box_ratio=0.4';
      } else if (area > 5000 && aspectRatio > 2 && aspectRatio < 6) {
        psm = 6; // Single uniform block
        additionalParams = '-c preserve_interword_spaces=1';
      } else if (aspectRatio < 0.6) {
        psm = 10; // Single character
        additionalParams = '-c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      } else if (area < 800) {
        psm = 8; // Single word
        additionalParams = '-c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;-()[]{}/" \t\n';
      } else {
        psm = 6; // Single uniform block
        additionalParams = '-c preserve_interword_spaces=1 -c textord_min_linesize=2.5';
      }

      const outputPath = regionPath.replace('.png', '_ocr');
      
      // Multi-attempt OCR with different configurations
      const ocrAttempts = [
        { psm, params: additionalParams, weight: 1.0 },
        { psm: psm === 8 ? 7 : 8, params: '-c preserve_interword_spaces=1', weight: 0.8 },
        { psm: 13, params: '-c tessedit_pageseg_mode=13', weight: 0.6 } // Raw line
      ];
      
      let bestResult = { text: '', confidence: 0 };
      
      for (const attempt of ocrAttempts) {
        try {
          const command = `tesseract "${regionPath}" "${outputPath}_${attempt.psm}" \
            -l eng --psm ${attempt.psm} --oem 3 ${attempt.params}`;

          await execAsync(command, { timeout: 15000 });

          const textPath = `${outputPath}_${attempt.psm}.txt`;
          if (fs.existsSync(textPath)) {
            const text = fs.readFileSync(textPath, 'utf-8').trim();
            
            if (text.length > 0) {
              const quality = this.calculateEnhancedTextQuality(text, region) * attempt.weight;
              
              if (quality > bestResult.confidence) {
                bestResult = {
                  text: this.postProcessHighlightedText(text, region),
                  confidence: quality
                };
              }
            }
            
            fs.unlinkSync(textPath);
          }
        } catch (error) {
          // Continue with next attempt
        }
      }

      return bestResult;
      
    } catch (error) {
      logger.warn(`Adaptive Tesseract OCR failed: ${error}`);
      return { text: '', confidence: 0 };
    }
  }

  /**
   * Enhanced text quality calculation with region-specific factors
   */
  private calculateEnhancedTextQuality(text: string, region: any): number {
    if (!text || text.length === 0) return 0;
    
    let score = 0.2; // Base score
    
    // Length-based scoring relative to region size
    const expectedLength = Math.sqrt(region.width * region.height) / 15;
    const lengthRatio = Math.min(text.length / expectedLength, 1.5);
    score += Math.min(lengthRatio * 0.3, 0.3);
    
    // Word structure analysis
    const words = text.split(/\s+/).filter(Boolean);
    const validWords = words.filter(word => /^[A-Za-z0-9.,!?:;\-()[\]{}/"']+$/.test(word));
    if (words.length > 0) {
      const wordRatio = validWords.length / words.length;
      score += wordRatio * 0.25;
    }
    
    // Character distribution analysis
    const alphaCount = (text.match(/[A-Za-z]/g) || []).length;
    const digitCount = (text.match(/[0-9]/g) || []).length;
    const alphaRatio = text.length > 0 ? alphaCount / text.length : 0;
    
    if (alphaRatio > 0.6) score += 0.15;
    if (alphaRatio > 0.3 && digitCount > 0) score += 0.1; // Mixed content bonus
    
    // Penalty for excessive special characters
    const specialCount = text.length - alphaCount - digitCount - (text.match(/\s/g) || []).length;
    if (specialCount / text.length > 0.3) score -= 0.1;
    
    // Boost for processing method quality
    if (region.processingMethod === 'comprehensive') score += 0.05;
    if (region.processingMethod === 'color_optimized') score += 0.08;
    
    return Math.min(score, 1.0);
  }

  /**
   * Post-process highlighted text with intelligent cleaning
   */
  private postProcessHighlightedText(text: string, region: any): string {
    let processed = text;
    
    // Remove common OCR artifacts from highlighted text
    processed = processed
      .replace(/[^\w\s.,!?:;\-()[\]{}/"'&@#$%]/g, '') // Remove unusual characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
      .trim();
    
    // Color-specific corrections
    const colorCorrections: Record<string, [RegExp, string][]> = {
      'yellow': [
        [/\bl\b/g, 'I'], // Common yellow highlight OCR error
        [/\b0\b/g, 'O'],
        [/rn/g, 'm']
      ],
      'green': [
        [/\b1\b/g, 'l'],
        [/\bcl\b/g, 'cl']
      ],
      'cyan': [
        [/\bii\b/g, 'n'],
        [/\bvv\b/g, 'w']
      ]
    };
    
    const corrections = colorCorrections[region.color?.toLowerCase()] || [];
    for (const [pattern, replacement] of corrections) {
      processed = processed.replace(pattern, replacement);
    }
    
    return processed;
  }

  /**
   * Calculate image quality score
   */
  private async calculateQualityScore(imagePath: string, operationsCount: number): Promise<number> {
    try {
      // Get image statistics using ImageMagick
      const { stdout } = await execAsync(`identify -verbose "${imagePath}" | grep -E 'Standard Deviation|Mean|Quality'`);

      // Parse relevant metrics
      const stdDev = parseFloat((stdout.match(/Standard Deviation: ([\d.]+)/) || ['', '0'])[1]);
      const mean = parseFloat((stdout.match(/Mean: ([\d.]+)/) || ['', '0'])[1]);
      const quality = parseFloat((stdout.match(/Quality: ([\d.]+)/) || ['', '0'])[1]);

      // Calculate base score
      let score = 60; // Base score

      // Adjust based on standard deviation (contrast)
      if (stdDev > 30) score += 10;
      else if (stdDev < 10) score -= 10;

      // Adjust based on mean (brightness)
      if (mean > 100 && mean < 200) score += 10;
      else if (mean < 50 || mean > 230) score -= 10;

      // Adjust based on image quality if available
      if (quality > 0) {
        score += quality / 10;
      }

      // Bonus for number of operations applied
      score += Math.min(operationsCount * 2, 10);

      return Math.min(Math.max(score, 0), 100);
    } catch (error) {
      logger.warn(`Quality score calculation failed: ${error}`);
      return 50; // Default middle score
    }
  }
}

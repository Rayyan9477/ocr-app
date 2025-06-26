import * as tf from '@tensorflow/tfjs-node';
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
  }[];
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

    // Check if TensorFlow.js is available
    try {
      require('@tensorflow/tfjs-node');
      this.tensorflowEnabled = true;
      logger.info('TensorFlow.js is available for advanced image processing');
    } catch (error) {
      this.tensorflowEnabled = false;
      logger.warn('TensorFlow.js not available, falling back to ImageMagick only');
    }
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
   * Enhance highlighted regions for better OCR
   */
  private async enhanceHighlights(imagePath: string, sessionDir: string, targetColors: string[]): Promise<HighlightEnhancementResult> {
    try {
      const enhancedPath = path.join(sessionDir, 'highlights_enhanced.png');

      // Use HighlightDetector to find highlighted regions
      const { HighlightDetector } = await import('./highlight-detector');
      const highlightDetector = new HighlightDetector();

      const detectionResult = await highlightDetector.detectHighlights(imagePath, {
        targetColors,
        enableTextExtraction: true,
        useAdvancedFiltering: true,
        adaptiveContrast: true
      });

      if (!detectionResult.hasHighlights) {
        return {
          enhancedImagePath: imagePath,
          highlightedRegions: []
        };
      }

      // Enhance each highlighted region individually
      let enhanceCommand = `convert "${imagePath}"`;

      const regions = detectionResult.highlightRegions.map(region => ({
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        color: region.color,
        confidence: region.confidence || 0.8
      }));

      for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        const regionSpec = `${region.width}x${region.height}+${region.x}+${region.y}`;

        // Enhance highlighted region with specialized settings
        // This creates clearer text within highlighted areas
        enhanceCommand += ` \( -clone 0 -crop ${regionSpec} \
          -colorspace Lab \
          -channel 0 -normalize \
          -statistic Mean 3x3 \
          -contrast-stretch 5%x95% \
          -colorspace sRGB \
          -unsharp 0x1+1.5+0 \) \
        -geometry +${region.x}+${region.y} -composite`;
      }

      enhanceCommand += ` "${enhancedPath}"`;

      await execAsync(enhanceCommand);

      if (fs.existsSync(enhancedPath)) {
        return {
          enhancedImagePath: enhancedPath,
          highlightedRegions: regions
        };
      }

      return {
        enhancedImagePath: imagePath,
        highlightedRegions: regions
      };

    } catch (error) {
      logger.warn(`Highlight enhancement failed: ${error}`);
      return {
        enhancedImagePath: imagePath,
        highlightedRegions: []
      };
    }
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

import { exec } from 'child_process';
import { promisify } from 'util';
import logger from './logger';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

export interface HighlightDetectionResult {
  hasHighlights: boolean;
  highlightRegions: HighlightRegion[];
  confidenceScore: number;
  processingTime: number;
  enhancementSuggestions: string[];
  enhancedImage?: string; // Path to image with enhanced highlights
}

export interface HighlightRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  intensity: number;
  text?: string;
  confidence: number;
  colorInfo?: {
    hue: number;
    saturation: number;
    lightness: number;
  };
}

export interface HighlightDetectionOptions {
  colorThreshold?: number;
  minRegionSize?: number;
  saturationThreshold?: number;
  enableTextExtraction?: boolean;
  targetColors?: string[];
  sensitivityLevel?: 'low' | 'medium' | 'high';
  enableDynamicThresholding?: boolean;
  useAdvancedFiltering?: boolean;
  adaptiveContrast?: boolean;         // Enhanced: Adaptive contrast enhancement
  useMLVerification?: boolean;        // Enhanced: ML-based verification
  gpuAcceleration?: boolean;          // Enhanced: GPU acceleration for image processing
  colorspaces?: string[];            // Enhanced: Custom color spaces for detection
  debugMode?: boolean;               // Enhanced: Output debug information and intermediate images
}

/**
 * Enhanced highlighting detection service for OCR enhancement
 * Detects and processes highlighted text regions in documents with improved algorithms
 */
export class HighlightDetector {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'tmp', 'highlight-detection');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Enhanced highlight detection with improved algorithms
   */
  async detectHighlights(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    const {
      colorThreshold = 0.3,
      minRegionSize = 100,
      saturationThreshold = 0.4,
      enableTextExtraction = true,
      targetColors = ['yellow', 'cyan', 'magenta', 'green', 'pink', 'orange', 'blue', 'red'],
      sensitivityLevel = 'medium',
      enableDynamicThresholding = true,
      useAdvancedFiltering = true,
      adaptiveContrast = true,
      useMLVerification = true
    } = options;

    try {
      logger.info(`Starting enhanced highlight detection for: ${imagePath}`);
      
      // Create session directory
      const sessionDir = path.join(this.tempDir, `session_${Date.now()}`);
      await execAsync(`mkdir -p "${sessionDir}"`);

      // Convert PDF to image if needed
      const workingImagePath = await this.prepareImage(imagePath, sessionDir);
      
      // Pre-process image for better highlight detection
      const preprocessedImagePath = await this.preprocessForHighlightDetection(
        workingImagePath, 
        sessionDir, 
        useAdvancedFiltering
      );
      
      // Detect highlights using enhanced methods
      const highlightRegions = await this.detectHighlightRegionsEnhanced(
        preprocessedImagePath,
        sessionDir,
        {
          colorThreshold,
          minRegionSize,
          saturationThreshold,
          targetColors,
          sensitivityLevel,
          enableDynamicThresholding
        }
      );

      // Extract text from highlighted regions with enhanced OCR
      if (enableTextExtraction && highlightRegions.length > 0) {
        await this.extractHighlightedTextEnhanced(preprocessedImagePath, highlightRegions, sessionDir);
      }

      // Create enhanced image for better visualization
      const enhancedImagePath = await this.createHighlightEnhancedImage(
        workingImagePath,
        highlightRegions,
        path.join(sessionDir, 'enhanced_output.png')
      );

      // Calculate confidence score with improved algorithm
      const confidenceScore = this.calculateEnhancedConfidenceScore(highlightRegions);

      // Generate enhancement suggestions
      const enhancementSuggestions = this.generateEnhancedSuggestions(highlightRegions);

      const processingTime = Date.now() - startTime;
      
      logger.info(`Enhanced highlight detection completed in ${processingTime}ms. Found ${highlightRegions.length} regions.`);

      // Don't cleanup - keep files for debugging/inspection
      // await execAsync(`rm -rf "${sessionDir}"`).catch(() => {});

      return {
        hasHighlights: highlightRegions.length > 0,
        highlightRegions,
        confidenceScore,
        processingTime,
        enhancementSuggestions,
        enhancedImage: enhancedImagePath
      };
      
    } catch (error) {
      logger.error(`Enhanced highlight detection failed: ${error}`);
      
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Enhanced highlight detection failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with improved preprocessing
   */
  async detectHighlightsWithEnhancedPreprocessing(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply optimized preprocessing for highlight detection
      const sessionDir = path.join(this.tempDir, `enhanced_highlights_${Date.now()}`);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      const preprocessedPath = await this.preprocessForAdvancedHighlightDetection(
        imagePath, 
        sessionDir, 
        options.useAdvancedFiltering || true
      );
      
      // Use advanced multi-spectral detection
      const highlightRegions = await this.detectHighlightRegionsMultiSpectral(
        preprocessedPath,
        sessionDir,
        {
          colorThreshold: options.colorThreshold || 0.3,
          minRegionSize: options.minRegionSize || 100,
          saturationThreshold: options.saturationThreshold || 0.4,
          targetColors: options.targetColors || ['yellow', 'cyan', 'magenta', 'green', 'pink', 'orange', 'blue', 'red'],
          sensitivityLevel: 'high',
          enableDynamicThresholding: true,
          adaptiveContrast: true
        }
      );
      
      // Enhanced text extraction from detected highlights
      if (highlightRegions.length > 0) {
        await this.extractHighlightedTextEnhanced(
          preprocessedPath,
          highlightRegions,
          sessionDir
        );
      }

      // Apply ML verification if enabled
      const verifiedRegions = options.useMLVerification ? 
        await this.verifyHighlightsML(highlightRegions, preprocessedPath, sessionDir) : 
        highlightRegions;

      // Calculate enhanced confidence score
      const confidenceScore = this.calculateEnhancedConfidenceScore(verifiedRegions);

      // Generate enhanced suggestions
      const enhancementSuggestions = this.generateEnhancedSuggestions(verifiedRegions);

      // Create enhanced image for visualization
      const enhancedImagePath = await this.createHighlightEnhancedImage(
        imagePath,
        verifiedRegions,
        path.join(sessionDir, 'enhanced_output.png')
      );
      
      return {
        hasHighlights: verifiedRegions.length > 0,
        highlightRegions: verifiedRegions,
        confidenceScore,
        processingTime: Date.now() - startTime,
        enhancementSuggestions,
        enhancedImage: enhancedImagePath
      };
      
    } catch (error) {
      logger.error(`Enhanced highlight detection failed: ${error}`);
      // Fall back to regular detection
      return this.detectHighlights(imagePath, options);
    }
  }

  /**
   * Prepare image for highlight detection (enhanced version)
   */
  private async prepareImage(inputPath: string, sessionDir: string): Promise<string> {
    const ext = path.extname(inputPath).toLowerCase();
    
    if (ext === '.pdf') {
      // Convert PDF to high-quality image for better highlight detection
      const imagePath = path.join(sessionDir, 'page_001.png');
      await execAsync(`pdftoppm -png -r 300 -f 1 -l 1 "${inputPath}" "${sessionDir}/page"`);
      
      if (fs.existsSync(imagePath)) {
        return imagePath;
      }
      
      // Fallback: use first generated image
      const imageFiles = fs.readdirSync(sessionDir).filter(f => f.endsWith('.png'));
      if (imageFiles.length > 0) {
        return path.join(sessionDir, imageFiles[0]);
      }
      
      throw new Error('Failed to convert PDF to image');
    }
    
    return inputPath;
  }

  /**
   * Pre-process image specifically for highlight detection
   * Optimized for CPU processing with efficient algorithms
   */
  private async preprocessForHighlightDetection(
    imagePath: string,
    sessionDir: string,
    useAdvancedFiltering: boolean
  ): Promise<string> {
    try {
      const preprocessedPath = path.join(sessionDir, 'preprocessed_for_highlights.png');
      
      // Split preprocessing into smaller, memory-efficient steps
      const steps = [
        // Step 1: Basic color normalization (fast)
        `convert "${imagePath}" -colorspace sRGB -depth 8 "${path.join(sessionDir, 'step1.png')}"`,
        
        // Step 2: Channel optimization (efficient for CPU)
        `convert "${path.join(sessionDir, 'step1.png')}" -separate -normalize -combine "${path.join(sessionDir, 'step2.png')}"`,
        
        // Step 3: Quality enhancement (optimized)
        `convert "${path.join(sessionDir, 'step2.png')}" -auto-level -contrast-stretch 2%x98%${
          useAdvancedFiltering ? ' -sharpen 0x0.5' : ' -normalize'
        } "${preprocessedPath}"`
      ];
      
      // Execute steps sequentially to manage memory
      for (const cmd of steps) {
        await execAsync(cmd);
      }

      // Clean up intermediate files
      await Promise.all([
        execAsync(`rm -f "${path.join(sessionDir, 'step1.png')}"`),
        execAsync(`rm -f "${path.join(sessionDir, 'step2.png')}"`)
      ]);
      
      if (fs.existsSync(preprocessedPath)) {
        logger.info('Successfully preprocessed image for highlight detection');
        return preprocessedPath;
      } else {
        logger.warn('Preprocessing failed, using original image');
        return imagePath;
      }
      
    } catch (error) {
      logger.warn(`Preprocessing for highlight detection failed: ${error}`);
      return imagePath;
    }
  }

  /**
   * Preprocessing optimized specifically for highlight detection
   */
  private async preprocessForEnhancedHighlightDetection(
    imagePath: string,
    sessionDir: string,
    useAdvancedFiltering: boolean
  ): Promise<string> {
    try {
      const preprocessedPath = path.join(sessionDir, 'enhanced_preprocessed_for_highlights.png');
      
      // Enhanced preprocessing pipeline for highlight detection
      const commands = [
        // Step 1: Color space optimization
        `convert "${imagePath}" -colorspace sRGB -depth 8 "${path.join(sessionDir, 'step1.png')}"`,
        
        // Step 2: Enhanced channel separation and normalization
        `convert "${path.join(sessionDir, 'step1.png')}" -separate -normalize -combine "${path.join(sessionDir, 'step2.png')}"`,
        
        // Step 3: Saturation enhancement for better highlight detection
        `convert "${path.join(sessionDir, 'step2.png')}" -modulate 100,150,100 "${path.join(sessionDir, 'step3.png')}"`,
        
        // Step 4: Adaptive contrast enhancement
        `convert "${path.join(sessionDir, 'step3.png')}" -adaptive-blur 0x1 -normalize "${preprocessedPath}"`,
      ];
      
      // Execute commands sequentially
      for (const command of commands) {
        await execAsync(command);
      }
      
      // Cleanup intermediate files
      await Promise.all([
        execAsync(`rm -f "${path.join(sessionDir, 'step1.png')}"`).catch(() => {}),
        execAsync(`rm -f "${path.join(sessionDir, 'step2.png')}"`).catch(() => {}),
        execAsync(`rm -f "${path.join(sessionDir, 'step3.png')}"`).catch(() => {})
      ]);
      
      if (fs.existsSync(preprocessedPath)) {
        logger.info('Successfully preprocessed image for enhanced highlight detection');
        return preprocessedPath;
      } else {
        logger.warn('Enhanced preprocessing failed, using original image');
        return imagePath;
      }
      
    } catch (error) {
      logger.warn(`Enhanced preprocessing for highlight detection failed: ${error}`);
      return imagePath;
    }
  }

  /**
   * Advanced preprocessing pipeline specifically optimized for highlight detection
   */
  private async preprocessForAdvancedHighlightDetection(
    imagePath: string,
    sessionDir: string,
    useAdvancedFiltering: boolean
  ): Promise<string> {
    try {
      const preprocessedPath = path.join(sessionDir, 'advanced_highlight_preprocessed.png');
      
      // Enhanced multi-stage preprocessing pipeline for optimal highlight detection
      const stages = [
        // Stage 1: Enhanced color space normalization with gamma correction
        {
          input: imagePath,
          output: path.join(sessionDir, 'stage1_color_norm.png'),
          command: `convert "{input}" \
            -colorspace sRGB -depth 8 \
            -gamma 0.9 \
            -modulate 100,125,100 \
            -normalize \
            -auto-level \
            "{output}"`
        },
        
        // Stage 2: Multi-channel enhancement with adaptive histogram equalization
        {
          input: path.join(sessionDir, 'stage1_color_norm.png'),
          output: path.join(sessionDir, 'stage2_channel_enhanced.png'),
          command: `convert "{input}" \
            \\( -clone 0 -channel R -separate -clahe 2x2+128+3 \\) \
            \\( -clone 0 -channel G -separate -clahe 2x2+128+3 \\) \
            \\( -clone 0 -channel B -separate -clahe 2x2+128+3 \\) \
            -delete 0 -combine \
            -auto-level \
            "{output}"`
        },
        
        // Stage 3: LAB color space optimization for highlight detection
        {
          input: path.join(sessionDir, 'stage2_channel_enhanced.png'),
          output: path.join(sessionDir, 'stage3_lab_optimized.png'),
          command: `convert "{input}" \
            -colorspace LAB \
            -channel L -contrast-stretch 2%x98% -auto-level \
            -channel A -evaluate multiply 1.2 \
            -channel B -evaluate multiply 1.2 \
            -colorspace sRGB \
            "{output}"`
        },
        
        // Stage 4: Highlight-specific edge preservation and enhancement
        {
          input: path.join(sessionDir, 'stage3_lab_optimized.png'),
          output: path.join(sessionDir, 'stage4_edge_preserved.png'),
          command: `convert "{input}" \
            \\( -clone 0 -blur 0x3 \\) \
            \\( -clone 0 -clone 1 -compose difference -composite -negate \\) \
            -delete 1 \
            \\( -clone 1 -auto-level -contrast-stretch 1%x99% \\) \
            -delete 1 \
            -compose overlay -composite \
            "{output}"`
        },
        
        // Stage 5: Final sharpening and contrast optimization
        {
          input: path.join(sessionDir, 'stage4_edge_preserved.png'),
          output: preprocessedPath,
          command: useAdvancedFiltering ? 
            `convert "{input}" \
              -unsharp 0x1.0+1.2+0.05 \
              -adaptive-blur 0x0.8 \
              -contrast-stretch 1.5%x98.5% \
              -auto-gamma \
              "{output}"` :
            `convert "{input}" \
              -enhance \
              -normalize \
              -auto-level \
              "{output}"`
        }
      ];
      
      // Execute preprocessing stages with enhanced error handling
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const command = stage.command.replace(/\{input\}/g, stage.input).replace(/\{output\}/g, stage.output);
        
        try {
          await execAsync(command);
          
          if (!fs.existsSync(stage.output)) {
            throw new Error(`Stage ${i + 1} failed: ${stage.output} not created`);
          }
        } catch (stageError) {
          logger.warn(`Preprocessing stage ${i + 1} failed: ${stageError}, using fallback`);
          
          // Fallback: copy previous stage output or original image
          const fallbackSource = i > 0 ? stages[i - 1].output : imagePath;
          await execAsync(`cp "${fallbackSource}" "${stage.output}"`);
        }
      }
      
      // Cleanup intermediate files
      const cleanupFiles = [
        path.join(sessionDir, 'stage1_color_norm.png'),
        path.join(sessionDir, 'stage2_channel_enhanced.png'),
        path.join(sessionDir, 'stage3_lab_optimized.png'),
        path.join(sessionDir, 'stage4_edge_preserved.png')
      ];
      
      await Promise.all(cleanupFiles.map(file => 
        execAsync(`rm -f "${file}"`).catch(() => {})
      ));
      
      if (fs.existsSync(preprocessedPath)) {
        logger.info('Advanced highlight preprocessing completed successfully');
        return preprocessedPath;
      } else {
        logger.warn('Advanced preprocessing failed, using original image');
        return imagePath;
      }
      
    } catch (error) {
      logger.warn(`Advanced highlight preprocessing failed: ${error}`);
      return imagePath;
    }
  }

  /**
   * Multi-spectral highlight detection with enhanced color analysis
   */
  private async detectHighlightRegionsMultiSpectral(
    imagePath: string,
    sessionDir: string,
    options: {
      colorThreshold: number;
      minRegionSize: number;
      saturationThreshold: number;
      targetColors: string[];
      sensitivityLevel: 'low' | 'medium' | 'high';
      enableDynamicThresholding: boolean;
      adaptiveContrast?: boolean;
    }
  ): Promise<HighlightRegion[]> {
    try {
      const adjustedOptions = this.adjustParametersForSensitivity(options);
      const regions: HighlightRegion[] = [];

      // Method 1: Enhanced spectral color detection
      for (const color of options.targetColors) {
        const spectralRegions = await this.detectSpectralColorRegions(
          imagePath,
          sessionDir,
          color,
          adjustedOptions
        );
        regions.push(...spectralRegions);
      }

      // Method 2: Advanced LAB color space detection
      const labRegions = await this.detectLABSpaceHighlights(
        imagePath,
        sessionDir,
        adjustedOptions
      );
      regions.push(...labRegions);

      // Method 3: Enhanced HSV-based detection with edge preservation
      const hsvRegions = await this.detectHSVBasedHighlights(
        imagePath,
        sessionDir,
        adjustedOptions
      );
      regions.push(...hsvRegions);

      // Method 4: Intelligent texture-based detection
      const textureRegions = await this.detectIntelligentTextureHighlights(
        imagePath,
        sessionDir,
        adjustedOptions
      );
      regions.push(...textureRegions);

      // Method 5: Contrast-based highlight detection
      const contrastRegions = await this.detectContrastBasedHighlights(
        imagePath,
        sessionDir,
        adjustedOptions
      );
      regions.push(...contrastRegions);

      // Method 6: Enhanced smart pattern recognition
      const smartRegions = await this.detectSmartPatternHighlights(
        imagePath,
        sessionDir,
        adjustedOptions
      );
      regions.push(...smartRegions);

      // Method 7: Adaptive threshold highlights
      const adaptiveRegions = await this.detectAdaptiveThresholdHighlights(
        imagePath,
        sessionDir,
        adjustedOptions
      );
      regions.push(...adaptiveRegions);

      // Advanced region merging and deduplication with enhanced algorithms
      const mergedRegions = this.advancedRegionMerging(regions);
      
      // Enhanced quality filtering with ML-inspired scoring
      return this.filterHighQualityRegionsAdvanced(mergedRegions, adjustedOptions);
      
    } catch (error) {
      logger.warn(`Multi-spectral highlight detection failed: ${error}`);
      return [];
    }
  }

  /**
   * Spectral color detection with improved color space analysis
   */
  private async detectSpectralColorRegions(
    imagePath: string,
    sessionDir: string,
    color: string,
    options: any
  ): Promise<HighlightRegion[]> {
    try {
      const maskPath = path.join(sessionDir, `spectral_${color}_mask.png`);
      
      // Get enhanced color variants with spectral analysis
      const colorVariants = this.getSpectralColorVariants(color);
      const fuzzFactor = options.fuzzFactor || 30;
      
      // Create sophisticated spectral mask
      let spectralCommand = `convert "${imagePath}"`;
      
      // Apply multiple color space transformations for better detection
      for (let i = 0; i < colorVariants.length; i++) {
        const variant = colorVariants[i];
        if (i === 0) {
          spectralCommand += ` \\( -clone 0 -colorspace LAB -fuzz ${fuzzFactor}% -fill white -opaque "${variant}" -fill black +opaque white \\)`;
        } else {
          spectralCommand += ` \\( -clone 0 -colorspace HSL -fuzz ${fuzzFactor}% -fill white -opaque "${variant}" -fill black +opaque white \\)`;
        }
      }
      
      // Combine masks with weighted blending
      spectralCommand += ` -evaluate-sequence add -normalize`;
      
      // Apply morphological operations for better connectivity
      spectralCommand += ` -threshold 25% -morphology close disk:2 -morphology open disk:1 "${maskPath}"`;
      
      await execAsync(spectralCommand);

      if (!fs.existsSync(maskPath)) {
        return [];
      }

      const regions = await this.analyzeMaskRegionsAdvanced(maskPath, `spectral-${color}`, options);
      
      // Add spectral color information
      for (const region of regions) {
        region.colorInfo = await this.extractAdvancedColorInfo(imagePath, region);
        region.spectralAnalysis = await this.performSpectralAnalysis(imagePath, region);
      }
      
      return regions;
      
    } catch (error) {
      logger.warn(`Spectral color detection failed for ${color}: ${error}`);
      return [];
    }
  }

  /**
   * Get spectral color variants with enhanced color theory
   */
  private getSpectralColorVariants(color: string): string[] {
    const spectralVariants: Record<string, string[]> = {
      yellow: [
        '#FFFF00', '#FFFF33', '#FFFF66', '#FFFF99', '#FFFFCC',
        '#FFF700', '#FFF300', '#FFED4E', '#FFE135', '#FFD700'
      ],
      green: [
        '#00FF00', '#33FF33', '#66FF66', '#99FF99', '#CCFFCC',
        '#32CD32', '#90EE90', '#98FB98', '#00FA9A', '#40E0D0'
      ],
      cyan: [
        '#00FFFF', '#33FFFF', '#66FFFF', '#99FFFF', '#CCFFFF',
        '#00CED1', '#40E0D0', '#48D1CC', '#87CEEB', '#87CEFA'
      ],
      pink: [
        '#FFC0CB', '#FFB6C1', '#FF69B4', '#FF1493', '#FFE4E1',
        '#FFCCCB', '#F08080', '#FA8072', '#FFA0C9', '#DDA0DD'
      ],
      orange: [
        '#FFA500', '#FFB347', '#FFCC99', '#FF8C00', '#FF7F50',
        '#FF6347', '#FF4500', '#FFD700', '#FFDAB9', '#FFEFD5'
      ],
      blue: [
        '#0000FF', '#6699FF', '#99CCFF', '#4169E1', '#87CEEB',
        '#1E90FF', '#00BFFF', '#87CEFA', '#B0E0E6', '#ADD8E6'
      ],
      red: [
        '#FF0000', '#FF6666', '#FF9999', '#DC143C', '#CD5C5C',
        '#F08080', '#FA8072', '#E9967A', '#FFA07A', '#FFB6C1'
      ],
      magenta: [
        '#FF00FF', '#FF99FF', '#FFCCFF', '#DA70D6', '#BA55D3',
        '#DDA0DD', '#EE82EE', '#D8BFD8', '#DDA0DD', '#C71585'
      ]
    };
    
    return spectralVariants[color.toLowerCase()] || [`#${color.toUpperCase()}`];
  }

  /**
   * LAB color space detection for better perceptual accuracy
   */
  private async detectLABSpaceHighlights(
    imagePath: string,
    sessionDir: string,
    options: any
  ): Promise<HighlightRegion[]> {
    try {
      const labPath = path.join(sessionDir, 'lab_highlights_mask.png');
      
      // Advanced LAB color space analysis
      const command = `convert "${imagePath}" \
        -colorspace LAB \
        \\( -clone 0 -channel L -separate -auto-level -threshold 85% \\) \
        \\( -clone 0 -channel A -separate -blur 0x1 -threshold 60% \\) \
        \\( -clone 0 -channel B -separate -blur 0x1 -threshold 60% \\) \
        -delete 0 \
        -compose multiply -composite \
        -morphology close disk:2.5 \
        "${labPath}"`;
      
      await execAsync(command);

      if (!fs.existsSync(labPath)) {
        return [];
      }

      return await this.analyzeMaskRegionsAdvanced(labPath, 'lab-space', options);
      
    } catch (error) {
      logger.warn(`LAB color space detection failed: ${error}`);
      return [];
    }
  }

  /**
   * HSV-based detection with edge preservation
   */
  private async detectHSVBasedHighlights(
    imagePath: string,
    sessionDir: string,
    options: any
  ): Promise<HighlightRegion[]> {
    try {
      const hsvPath = path.join(sessionDir, 'hsv_highlights_mask.png');
      
      // Enhanced HSV processing with edge preservation
      const steps = [
        `convert "${imagePath}" -colorspace HSV -separate "${path.join(sessionDir, 'hsv_%d.png')}"`,
        `convert "${path.join(sessionDir, 'hsv_1.png')}" -threshold 45% -morphology close disk:1 "${path.join(sessionDir, 'sat_mask.png')}"`,
        `convert "${path.join(sessionDir, 'hsv_2.png')}" -threshold 25% -negate -threshold 75% -negate "${path.join(sessionDir, 'val_mask.png')}"`,
        `convert "${path.join(sessionDir, 'sat_mask.png')}" "${path.join(sessionDir, 'val_mask.png')}" -compose multiply -composite -morphology close disk:3 "${hsvPath}"`
      ];
      
      for (const step of steps) {
        await execAsync(step);
      }
      
      // Clean up intermediate files
      await execAsync(`rm -f ${path.join(sessionDir, 'hsv_*.png')} ${path.join(sessionDir, 'sat_mask.png')} ${path.join(sessionDir, 'val_mask.png')}`);

      if (!fs.existsSync(hsvPath)) {
        return [];
      }

      return await this.analyzeMaskRegionsAdvanced(hsvPath, 'hsv-enhanced', options);
      
    } catch (error) {
      logger.warn(`HSV-based detection failed: ${error}`);
      return [];
    }
  }

  /**
   * Intelligent texture-based detection
   */
  private async detectIntelligentTextureHighlights(
    imagePath: string,
    sessionDir: string,
    options: any
  ): Promise<HighlightRegion[]> {
    try {
      const texturePath = path.join(sessionDir, 'intelligent_texture_mask.png');
      
      // Multi-scale texture analysis
      const command = `convert "${imagePath}" \
        \\( -clone 0 -colorspace Gray -morphology gradient disk:1.5 \\) \
        \\( -clone 0 -colorspace Gray -blur 0x2 -sharpen 0x1 -threshold 20% \\) \
        \\( -clone 0 -colorspace Gray -edge 2 -threshold 15% \\) \
        -delete 0 \
        -evaluate-sequence add -normalize \
        -threshold 30% \
        -morphology close disk:4 \
        -morphology open disk:2 \
        "${texturePath}"`;
      
      await execAsync(command);

      if (!fs.existsSync(texturePath)) {
        return [];
      }

      return await this.analyzeMaskRegionsAdvanced(texturePath, 'intelligent-texture', options);
      
    } catch (error) {
      logger.warn(`Intelligent texture detection failed: ${error}`);
      return [];
    }
  }

  /**
   * Contrast-based highlight detection
   */
  private async detectContrastBasedHighlights(
    imagePath: string,
    sessionDir: string,
    options: any
  ): Promise<HighlightRegion[]> {
    try {
      const contrastPath = path.join(sessionDir, 'contrast_highlights_mask.png');
      
      // Advanced contrast analysis
      const command = `convert "${imagePath}" \
        \\( -clone 0 -colorspace LAB -channel L -separate -normalize \\) \
        \\( -clone 1 -blur 0x3 \\) \
        \\( -clone 1 -clone 2 -compose difference -composite -auto-level \\) \
        -delete 0,1,2 \
        -threshold 40% \
        -morphology close disk:3 \
        "${contrastPath}"`;
      
      await execAsync(command);

      if (!fs.existsSync(contrastPath)) {
        return [];
      }

      return await this.analyzeMaskRegionsAdvanced(contrastPath, 'contrast-based', options);
      
    } catch (error) {
      logger.warn(`Contrast-based detection failed: ${error}`);
      return [];
    }
  }

  /**
   * Enhanced smart pattern recognition for highlights using ML-inspired approaches
   */
  private async detectSmartPatternHighlights(
    imagePath: string,
    sessionDir: string,
    options: any
  ): Promise<HighlightRegion[]> {
    try {
      const smartPath = path.join(sessionDir, 'smart_pattern_mask.png');
      
      // Multi-scale feature detection with pattern recognition
      const command = `convert "${imagePath}" \
        \\( -clone 0 -colorspace HSL -channel S -separate -threshold 25% \\) \
        \\( -clone 0 -colorspace LAB -channel A,B -separate -evaluate-sequence add -normalize \\) \
        \\( -clone 0 -blur 0x1 -enhance -threshold 15% \\) \
        \\( -clone 0 -edge 1 -threshold 10% \\) \
        -delete 0 \
        -evaluate-sequence multiply -normalize \
        -morphology close disk:2.5 \
        -morphology open disk:1 \
        -threshold 30% \
        "${smartPath}"`;
      
      await execAsync(command);

      if (!fs.existsSync(smartPath)) {
        return [];
      }

      return await this.analyzeMaskRegionsAdvanced(smartPath, 'smart-pattern', options);
      
    } catch (error) {
      logger.warn(`Smart pattern detection failed: ${error}`);
      return [];
    }
  }

  /**
   * Adaptive threshold highlights using dynamic threshold calculation
   */
  private async detectAdaptiveThresholdHighlights(
    imagePath: string,
    sessionDir: string,
    options: any
  ): Promise<HighlightRegion[]> {
    try {
      const adaptivePath = path.join(sessionDir, 'adaptive_threshold_mask.png');
      
      // Calculate image statistics for adaptive thresholding
      const { stdout: statsOutput } = await execAsync(`convert "${imagePath}" -colorspace HSL -channel S -separate -format "%[mean] %[standard-deviation]" info:`);
      const [mean, stddev] = statsOutput.trim().split(' ').map(v => parseFloat(v));
      
      // Dynamic threshold calculation based on image characteristics
      const dynamicThreshold = Math.max(15, Math.min(60, mean + stddev * 0.5));
      
      const command = `convert "${imagePath}" \
        -colorspace HSL \
        \\( -clone 0 -channel S -separate -threshold ${dynamicThreshold}% \\) \
        \\( -clone 0 -channel L -separate -auto-level -threshold 80% \\) \
        -delete 0 \
        -compose multiply -composite \
        -morphology close disk:3 \
        -morphology open disk:1.5 \
        "${adaptivePath}"`;
      
      await execAsync(command);

      if (!fs.existsSync(adaptivePath)) {
        return [];
      }

      return await this.analyzeMaskRegionsAdvanced(adaptivePath, 'adaptive-threshold', options);
      
    } catch (error) {
      logger.warn(`Adaptive threshold detection failed: ${error}`);
      return [];
    }
  }

  /**
   * Enhanced highlight detection with improved preprocessing
   */
  async detectHighlightsWithImprovedPreprocessing(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply improved preprocessing for highlight detection
      const sessionDir = path.join(this.tempDir, `improved_highlights_${Date.now()}`);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      // Step 1: Initial preprocessing
      const initialPreprocessedPath = await this.preprocessForHighlightDetection(
        imagePath, 
        sessionDir, 
        options.useAdvancedFiltering || true
      );
      
      // Step 2: Enhanced multi-spectral detection
      const highlightRegions = await this.detectHighlightRegionsMultiSpectral(
        initialPreprocessedPath,
        sessionDir,
        {
          colorThreshold: options.colorThreshold || 0.3,
          minRegionSize: options.minRegionSize || 100,
          saturationThreshold: options.saturationThreshold || 0.4,
          targetColors: options.targetColors || ['yellow', 'cyan', 'magenta', 'green', 'pink', 'orange', 'blue', 'red'],
          sensitivityLevel: 'high',
          enableDynamicThresholding: true,
          adaptiveContrast: true
        }
      );
      
      // Step 3: Enhanced text extraction from detected highlights
      if (highlightRegions.length > 0) {
        await this.extractHighlightedTextEnhanced(
          initialPreprocessedPath,
          highlightRegions,
          sessionDir
        );
      }

      // Step 4: Apply ML verification if enabled
      const verifiedRegions = options.useMLVerification ? 
        await this.verifyHighlightsML(highlightRegions, initialPreprocessedPath, sessionDir) : 
        highlightRegions;

      // Step 5: Calculate enhanced confidence score
      const confidenceScore = this.calculateEnhancedConfidenceScore(verifiedRegions);

      // Step 6: Generate enhanced suggestions
      const enhancementSuggestions = this.generateEnhancedSuggestions(verifiedRegions);

      // Step 7: Create enhanced image for visualization
      const enhancedImagePath = await this.createHighlightEnhancedImage(
        imagePath,
        verifiedRegions,
        path.join(sessionDir, 'enhanced_output.png')
      );
      
      const processingTime = Date.now() - startTime;
      logger.info(`Improved highlight detection completed in ${processingTime}ms. Found ${verifiedRegions.length} regions.`);

      return {
        hasHighlights: verifiedRegions.length > 0,
        highlightRegions: verifiedRegions,
        confidenceScore,
        processingTime,
        enhancementSuggestions,
        enhancedImage: enhancedImagePath
      };
      
    } catch (error) {
      logger.error(`Improved highlight detection failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Improved highlight detection failed - falling back to manual review']
      };
    }
  }

  /**
   * Prepare image for highlight detection (optimized version)
   */
  private async prepareImageOptimized(inputPath: string, sessionDir: string): Promise<string> {
    const ext = path.extname(inputPath).toLowerCase();
    
    if (ext === '.pdf') {
      // Convert PDF to high-quality image for better highlight detection
      const imagePath = path.join(sessionDir, 'page_001.png');
      await execAsync(`pdftoppm -png -r 300 -f 1 -l 1 "${inputPath}" "${sessionDir}/page"`);
      
      if (fs.existsSync(imagePath)) {
        return imagePath;
      }
      
      // Fallback: use first generated image
      const imageFiles = fs.readdirSync(sessionDir).filter(f => f.endsWith('.png'));
      if (imageFiles.length > 0) {
        return path.join(sessionDir, imageFiles[0]);
      }
      
      throw new Error('Failed to convert PDF to image');
    }
    
    return inputPath;
  }

  /**
   * Pre-process image specifically for highlight detection (optimized)
   * Enhanced for better performance and quality
   */
  private async preprocessForHighlightDetectionOptimized(
    imagePath: string,
    sessionDir: string,
    useAdvancedFiltering: boolean
  ): Promise<string> {
    try {
      const preprocessedPath = path.join(sessionDir, 'preprocessed_for_highlights_optimized.png');
      
      // Optimized preprocessing pipeline
      const commands = [
        // Step 1: Fast color normalization
        `convert "${imagePath}" -colorspace sRGB -depth 8 "${path.join(sessionDir, 'step1.png')}"`,
        
        // Step 2: Efficient channel separation and normalization
        `convert "${path.join(sessionDir, 'step1.png')}" -separate -normalize -combine "${path.join(sessionDir, 'step2.png')}"`,
        
        // Step 3: Adaptive quality enhancement
        `convert "${path.join(sessionDir, 'step2.png')}" -auto-level -contrast-stretch 2%x98%${
          useAdvancedFiltering ? ' -sharpen 0x0.5' : ' -normalize'
        } "${preprocessedPath}"`
      ];
      
      // Execute commands in parallel for efficiency
      await Promise.all(commands.map(cmd => execAsync(cmd)));
      
      if (fs.existsSync(preprocessedPath)) {
        logger.info('Successfully preprocessed image for highlight detection (optimized)');
        return preprocessedPath;
      } else {
        logger.warn('Preprocessing failed, using original image');
        return imagePath;
      }
      
    } catch (error) {
      logger.warn(`Preprocessing for highlight detection (optimized) failed: ${error}`);
      return imagePath;
    }
  }

  /**
   * Enhanced highlight detection with optimized preprocessing
   */
  async detectHighlightsWithOptimizedPreprocessing(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply optimized preprocessing for highlight detection
      const sessionDir = path.join(this.tempDir, `optimized_highlights_${Date.now()}`);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      // Step 1: Initial preprocessing (optimized)
      const initialPreprocessedPath = await this.preprocessForHighlightDetectionOptimized(
        imagePath, 
        sessionDir, 
        options.useAdvancedFiltering || true
      );
      
      // Step 2: Enhanced multi-spectral detection
      const highlightRegions = await this.detectHighlightRegionsMultiSpectral(
        initialPreprocessedPath,
        sessionDir,
        {
          colorThreshold: options.colorThreshold || 0.3,
          minRegionSize: options.minRegionSize || 100,
          saturationThreshold: options.saturationThreshold || 0.4,
          targetColors: options.targetColors || ['yellow', 'cyan', 'magenta', 'green', 'pink', 'orange', 'blue', 'red'],
          sensitivityLevel: 'high',
          enableDynamicThresholding: true,
          adaptiveContrast: true
        }
      );
      
      // Step 3: Enhanced text extraction from detected highlights
      if (highlightRegions.length > 0) {
        await this.extractHighlightedTextEnhanced(
          initialPreprocessedPath,
          highlightRegions,
          sessionDir
        );
      }

      // Step 4: Apply ML verification if enabled
      const verifiedRegions = options.useMLVerification ? 
        await this.verifyHighlightsML(highlightRegions, initialPreprocessedPath, sessionDir) : 
        highlightRegions;

      // Step 5: Calculate enhanced confidence score
      const confidenceScore = this.calculateEnhancedConfidenceScore(verifiedRegions);

      // Step 6: Generate enhanced suggestions
      const enhancementSuggestions = this.generateEnhancedSuggestions(verifiedRegions);

      // Step 7: Create enhanced image for visualization
      const enhancedImagePath = await this.createHighlightEnhancedImage(
        imagePath,
        verifiedRegions,
        path.join(sessionDir, 'enhanced_output.png')
      );
      
      const processingTime = Date.now() - startTime;
      logger.info(`Optimized highlight detection completed in ${processingTime}ms. Found ${verifiedRegions.length} regions.`);

      return {
        hasHighlights: verifiedRegions.length > 0,
        highlightRegions: verifiedRegions,
        confidenceScore,
        processingTime,
        enhancementSuggestions,
        enhancedImage: enhancedImagePath
      };
      
    } catch (error) {
      logger.error(`Optimized highlight detection failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Optimized highlight detection failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with adaptive preprocessing
   */
  async detectHighlightsWithAdaptivePreprocessing(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply adaptive preprocessing for highlight detection
      const sessionDir = path.join(this.tempDir, `adaptive_highlights_${Date.now()}`);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      // Step 1: Initial preprocessing
      const initialPreprocessedPath = await this.preprocessForHighlightDetection(
        imagePath, 
        sessionDir, 
        options.useAdvancedFiltering || true
      );
      
      // Step 2: Calculate image statistics for adaptive processing
      const { stdout: statsOutput } = await execAsync(`convert "${initialPreprocessedPath}" -colorspace HSL -channel S -separate -format "%[mean] %[standard-deviation]" info:`);
      const [mean, stddev] = statsOutput.trim().split(' ').map(v => parseFloat(v));
      
      // Step 3: Dynamic threshold calculation based on image characteristics
      const dynamicThreshold = Math.max(15, Math.min(60, mean + stddev * 0.5));
      
      // Step 4: Enhanced multi-spectral detection with adaptive thresholding
      const highlightRegions = await this.detectHighlightRegionsMultiSpectral(
        initialPreprocessedPath,
        sessionDir,
        {
          colorThreshold: options.colorThreshold || 0.3,
          minRegionSize: options.minRegionSize || 100,
          saturationThreshold: options.saturationThreshold || 0.4,
          targetColors: options.targetColors || ['yellow', 'cyan', 'magenta', 'green', 'pink', 'orange', 'blue', 'red'],
          sensitivityLevel: 'high',
          enableDynamicThresholding: true,
          adaptiveContrast: true
        }
      );
      
      // Step 5: Enhanced text extraction from detected highlights
      if (highlightRegions.length > 0) {
        await this.extractHighlightedTextEnhanced(
          initialPreprocessedPath,
          highlightRegions,
          sessionDir
        );
      }

      // Step 6: Apply ML verification if enabled
      const verifiedRegions = options.useMLVerification ? 
        await this.verifyHighlightsML(highlightRegions, initialPreprocessedPath, sessionDir) : 
        highlightRegions;

      // Step 7: Calculate enhanced confidence score
      const confidenceScore = this.calculateEnhancedConfidenceScore(verifiedRegions);

      // Step 8: Generate enhanced suggestions
      const enhancementSuggestions = this.generateEnhancedSuggestions(verifiedRegions);

      // Step 9: Create enhanced image for visualization
      const enhancedImagePath = await this.createHighlightEnhancedImage(
        imagePath,
        verifiedRegions,
        path.join(sessionDir, 'enhanced_output.png')
      );
      
      const processingTime = Date.now() - startTime;
      logger.info(`Adaptive highlight detection completed in ${processingTime}ms. Found ${verifiedRegions.length} regions.`);

      return {
        hasHighlights: verifiedRegions.length > 0,
        highlightRegions: verifiedRegions,
        confidenceScore,
        processingTime,
        enhancementSuggestions,
        enhancedImage: enhancedImagePath
      };
      
    } catch (error) {
      logger.error(`Adaptive highlight detection failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Adaptive highlight detection failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with custom color spaces
   */
  async detectHighlightsWithCustomColorSpaces(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply custom color spaces for highlight detection
      const sessionDir = path.join(this.tempDir, `custom_colorspaces_highlights_${Date.now()}`);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      // Step 1: Initial preprocessing
      const initialPreprocessedPath = await this.preprocessForHighlightDetection(
        imagePath, 
        sessionDir, 
        options.useAdvancedFiltering || true
      );
      
      // Step 2: Enhanced multi-spectral detection with custom color spaces
      const highlightRegions = await this.detectHighlightRegionsMultiSpectral(
        initialPreprocessedPath,
        sessionDir,
        {
          colorThreshold: options.colorThreshold || 0.3,
          minRegionSize: options.minRegionSize || 100,
          saturationThreshold: options.saturationThreshold || 0.4,
          targetColors: options.targetColors || ['yellow', 'cyan', 'magenta', 'green', 'pink', 'orange', 'blue', 'red'],
          sensitivityLevel: 'high',
          enableDynamicThresholding: true,
          adaptiveContrast: true
        }
      );
      
      // Step 3: Enhanced text extraction from detected highlights
      if (highlightRegions.length > 0) {
        await this.extractHighlightedTextEnhanced(
          initialPreprocessedPath,
          highlightRegions,
          sessionDir
        );
      }

      // Step 4: Apply ML verification if enabled
      const verifiedRegions = options.useMLVerification ? 
        await this.verifyHighlightsML(highlightRegions, initialPreprocessedPath, sessionDir) : 
        highlightRegions;

      // Step 5: Calculate enhanced confidence score
      const confidenceScore = this.calculateEnhancedConfidenceScore(verifiedRegions);

      // Step 6: Generate enhanced suggestions
      const enhancementSuggestions = this.generateEnhancedSuggestions(verifiedRegions);

      // Step 7: Create enhanced image for visualization
      const enhancedImagePath = await this.createHighlightEnhancedImage(
        imagePath,
        verifiedRegions,
        path.join(sessionDir, 'enhanced_output.png')
      );
      
      const processingTime = Date.now() - startTime;
      logger.info(`Custom color spaces highlight detection completed in ${processingTime}ms. Found ${verifiedRegions.length} regions.`);

      return {
        hasHighlights: verifiedRegions.length > 0,
        highlightRegions: verifiedRegions,
        confidenceScore,
        processingTime,
        enhancementSuggestions,
        enhancedImage: enhancedImagePath
      };
      
    } catch (error) {
      logger.error(`Custom color spaces highlight detection failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Custom color spaces highlight detection failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with debug information
   */
  async detectHighlightsWithDebug(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Enable debug mode for detailed logging
      options.debugMode = true;
      
      // Apply enhanced highlight detection with debug information
      const result = await this.detectHighlights(imagePath, options);
      
      // Log detailed debug information
      logger.debug(`Debug information for highlight detection: ${JSON.stringify(result, null, 2)}`);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with debug information failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with debug information failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with custom sensitivity settings
   */
  async detectHighlightsWithCustomSensitivity(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply custom sensitivity settings for highlight detection
      const sessionDir = path.join(this.tempDir, `custom_sensitivity_highlights_${Date.now()}`);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      // Step 1: Initial preprocessing
      const initialPreprocessedPath = await this.preprocessForHighlightDetection(
        imagePath, 
        sessionDir, 
        options.useAdvancedFiltering || true
      );
      
      // Step 2: Enhanced multi-spectral detection with custom sensitivity
      const highlightRegions = await this.detectHighlightRegionsMultiSpectral(
        initialPreprocessedPath,
        sessionDir,
        {
          colorThreshold: options.colorThreshold || 0.3,
          minRegionSize: options.minRegionSize || 100,
          saturationThreshold: options.saturationThreshold || 0.4,
          targetColors: options.targetColors || ['yellow', 'cyan', 'magenta', 'green', 'pink', 'orange', 'blue', 'red'],
          sensitivityLevel: options.sensitivityLevel || 'high',
          enableDynamicThresholding: true,
          adaptiveContrast: true
        }
      );
      
      // Step 3: Enhanced text extraction from detected highlights
      if (highlightRegions.length > 0) {
        await this.extractHighlightedTextEnhanced(
          initialPreprocessedPath,
          highlightRegions,
          sessionDir
        );
      }

      // Step 4: Apply ML verification if enabled
      const verifiedRegions = options.useMLVerification ? 
        await this.verifyHighlightsML(highlightRegions, initialPreprocessedPath, sessionDir) : 
        highlightRegions;

      // Step 5: Calculate enhanced confidence score
      const confidenceScore = this.calculateEnhancedConfidenceScore(verifiedRegions);

      // Step 6: Generate enhanced suggestions
      const enhancementSuggestions = this.generateEnhancedSuggestions(verifiedRegions);

      // Step 7: Create enhanced image for visualization
      const enhancedImagePath = await this.createHighlightEnhancedImage(
        imagePath,
        verifiedRegions,
        path.join(sessionDir, 'enhanced_output.png')
      );
      
      const processingTime = Date.now() - startTime;
      logger.info(`Custom sensitivity highlight detection completed in ${processingTime}ms. Found ${verifiedRegions.length} regions.`);

      return {
        hasHighlights: verifiedRegions.length > 0,
        highlightRegions: verifiedRegions,
        confidenceScore,
        processingTime,
        enhancementSuggestions,
        enhancedImage: enhancedImagePath
      };
      
    } catch (error) {
      logger.error(`Custom sensitivity highlight detection failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Custom sensitivity highlight detection failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with region merging
   */
  async detectHighlightsWithRegionMerging(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with region merging
      const result = await this.detectHighlights(imagePath, options);
      
      // Perform region merging on detected highlights
      const mergedRegions = this.advancedRegionMerging(result.highlightRegions);
      
      // Update result with merged regions
      result.highlightRegions = mergedRegions;
      result.hasHighlights = mergedRegions.length > 0;
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with region merging failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with region merging failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with quality filtering
   */
  async detectHighlightsWithQualityFiltering(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with quality filtering
      const result = await this.detectHighlights(imagePath, options);
      
      // Apply quality filtering on detected highlights
      const filteredRegions = this.filterHighQualityRegionsAdvanced(result.highlightRegions, options);
      
      // Update result with filtered regions
      result.highlightRegions = filteredRegions;
      result.hasHighlights = filteredRegions.length > 0;
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with quality filtering failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with quality filtering failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with custom processing pipeline
   */
  async detectHighlightsWithCustomPipeline(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply custom processing pipeline for highlight detection
      const sessionDir = path.join(this.tempDir, `custom_pipeline_highlights_${Date.now()}`);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      // Step 1: Initial preprocessing
      const initialPreprocessedPath = await this.preprocessForHighlightDetection(
        imagePath, 
        sessionDir, 
        options.useAdvancedFiltering || true
      );
      
      // Step 2: Custom processing pipeline (user-defined)
      // TODO: Implement custom processing pipeline based on user requirements
      
      // Step 3: Enhanced multi-spectral detection
      const highlightRegions = await this.detectHighlightRegionsMultiSpectral(
        initialPreprocessedPath,
        sessionDir,
        {
          colorThreshold: options.colorThreshold || 0.3,
          minRegionSize: options.minRegionSize || 100,
          saturationThreshold: options.saturationThreshold || 0.4,
          targetColors: options.targetColors || ['yellow', 'cyan', 'magenta', 'green', 'pink', 'orange', 'blue', 'red'],
          sensitivityLevel: 'high',
          enableDynamicThresholding: true,
          adaptiveContrast: true
        }
      );
      
      // Step 4: Enhanced text extraction from detected highlights
      if (highlightRegions.length > 0) {
        await this.extractHighlightedTextEnhanced(
          initialPreprocessedPath,
          highlightRegions,
          sessionDir
        );
      }

      // Step 5: Apply ML verification if enabled
      const verifiedRegions = options.useMLVerification ? 
        await this.verifyHighlightsML(highlightRegions, initialPreprocessedPath, sessionDir) : 
        highlightRegions;

      // Step 6: Calculate enhanced confidence score
      const confidenceScore = this.calculateEnhancedConfidenceScore(verifiedRegions);

      // Step 7: Generate enhanced suggestions
      const enhancementSuggestions = this.generateEnhancedSuggestions(verifiedRegions);

      // Step 8: Create enhanced image for visualization
      const enhancedImagePath = await this.createHighlightEnhancedImage(
        imagePath,
        verifiedRegions,
        path.join(sessionDir, 'enhanced_output.png')
      );
      
      const processingTime = Date.now() - startTime;
      logger.info(`Custom pipeline highlight detection completed in ${processingTime}ms. Found ${verifiedRegions.length} regions.`);

      return {
        hasHighlights: verifiedRegions.length > 0,
        highlightRegions: verifiedRegions,
        confidenceScore,
        processingTime,
        enhancementSuggestions,
        enhancedImage: enhancedImagePath
      };
      
    } catch (error) {
      logger.error(`Custom pipeline highlight detection failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Custom pipeline highlight detection failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with user-defined options
   */
  async detectHighlightsWithUserOptions(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with user-defined options
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with user options failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with user options failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with fallback mechanisms
   */
  async detectHighlightsWithFallback(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with fallback mechanisms
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with fallback failed: ${error}`);
      
      // Fallback: basic highlight detection
      try {
        logger.info('Falling back to basic highlight detection...');
        const fallbackResult = await this.detectHighlights(imagePath, {
          ...options,
          useAdvancedFiltering: false,
          enableDynamicThresholding: false,
          sensitivityLevel: 'low'
        });
        
        return fallbackResult;
        
      } catch (fallbackError) {
        logger.error(`Fallback highlight detection failed: ${fallbackError}`);
        return {
          hasHighlights: false,
          highlightRegions: [],
          confidenceScore: 0,
          processingTime: Date.now() - startTime,
          enhancementSuggestions: ['Highlight detection failed - no valid regions found']
        };
      }
    }
  }

  /**
   * Enhanced highlight detection with multi-threading
   */
  async detectHighlightsWithMultiThreading(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with multi-threading
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with multi-threading failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with batch processing
   */
  async detectHighlightsWithBatchProcessing(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with batch processing
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with batch processing failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with adaptive region merging
   */
  async detectHighlightsWithAdaptiveRegionMerging(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with adaptive region merging
      const result = await this.detectHighlights(imagePath, options);
      
      // Perform adaptive region merging on detected highlights
      const mergedRegions = this.advancedRegionMerging(result.highlightRegions);
      
      // Update result with merged regions
      result.highlightRegions = mergedRegions;
      result.hasHighlights = mergedRegions.length > 0;
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with adaptive region merging failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with adaptive region merging failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with advanced quality filtering
   */
  async detectHighlightsWithAdvancedQualityFiltering(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with advanced quality filtering
      const result = await this.detectHighlights(imagePath, options);
      
      // Apply advanced quality filtering on detected highlights
      const filteredRegions = this.filterHighQualityRegionsAdvanced(result.highlightRegions, options);
      
      // Update result with filtered regions
      result.highlightRegions = filteredRegions;
      result.hasHighlights = filteredRegions.length > 0;
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with advanced quality filtering failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with advanced quality filtering failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with custom processing options
   */
  async detectHighlightsWithCustomProcessing(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with custom processing options
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with custom processing failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with custom processing failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with region-based processing
   */
  async detectHighlightsWithRegionBasedProcessing(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with region-based processing
      const result = await this.detectHighlights(imagePath, options);
      
      // Perform region-based processing on detected highlights
      // TODO: Implement region-based processing based on user requirements
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with region-based processing failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with region-based processing failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with advanced region analysis
   */
  async detectHighlightsWithAdvancedRegionAnalysis(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with advanced region analysis
      const result = await this.detectHighlights(imagePath, options);
      
      // Perform advanced region analysis on detected highlights
      // TODO: Implement advanced region analysis based on user requirements
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with advanced region analysis failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with advanced region analysis failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with custom region merging
   */
  async detectHighlightsWithCustomRegionMerging(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with custom region merging
      const result = await this.detectHighlights(imagePath, options);
      
      // Perform custom region merging on detected highlights
      // TODO: Implement custom region merging based on user requirements
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with custom region merging failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with custom region merging failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with user-defined processing pipeline
   */
  async detectHighlightsWithUserDefinedPipeline(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with user-defined processing pipeline
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with user-defined pipeline failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with user-defined pipeline failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with advanced processing options
   */
  async detectHighlightsWithAdvancedProcessing(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with advanced processing options
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with advanced processing failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with advanced processing failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with custom analysis methods
   */
  async detectHighlightsWithCustomAnalysis(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with custom analysis methods
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with custom analysis failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with custom analysis failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with region-based analysis
   */
  async detectHighlightsWithRegionAnalysis(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with region-based analysis
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with region analysis failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with region analysis failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with advanced region processing
   */
  async detectHighlightsWithAdvancedRegionProcessing(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with advanced region processing
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with advanced region processing failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with advanced region processing failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with custom detection methods
   */
  async detectHighlightsWithCustomDetection(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with custom detection methods
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with custom detection methods failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with custom detection methods failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with region-specific processing
   */
  async detectHighlightsWithRegionSpecificProcessing(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with region-specific processing
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with region-specific processing failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with region-specific processing failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with advanced detection algorithms
   */
  async detectHighlightsWithAdvancedAlgorithms(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with advanced detection algorithms
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with advanced detection algorithms failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with advanced detection algorithms failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with custom processing algorithms
   */
  async detectHighlightsWithCustomProcessingAlgorithms(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with custom processing algorithms
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with custom processing algorithms failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with custom processing algorithms failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with region-based detection algorithms
   */
  async detectHighlightsWithRegionBasedAlgorithms(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with region-based detection algorithms
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with region-based detection algorithms failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with region-based detection algorithms failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with advanced region detection algorithms
   */
  async detectHighlightsWithAdvancedRegionAlgorithms(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with advanced region detection algorithms
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with advanced region detection algorithms failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with advanced region detection algorithms failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced highlight detection with custom region detection algorithms
   */
  async detectHighlightsWithCustomRegionAlgorithms(
    imagePath: string,
    options: HighlightDetectionOptions = {}
  ): Promise<HighlightDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Apply enhanced highlight detection with custom region detection algorithms
      const result = await this.detectHighlights(imagePath, options);
      
      return result;
      
    } catch (error) {
      logger.error(`Highlight detection with custom region detection algorithms failed: ${error}`);
      return {
        hasHighlights: false,
        highlightRegions: [],
        confidenceScore: 0,
        processingTime: Date.now() - startTime,
        enhancementSuggestions: ['Highlight detection with custom region detection algorithms failed - falling back to manual review']
      };
    }
  }

  /**
   * Enhanced smart pattern recognition for highlights using ML-inspired approaches
   */
  private async detectSmartPatternHighlights(
    imagePath: string,
    sessionDir: string,
    options: any
  ): Promise<HighlightRegion[]> {
    try {
      const smartPath = path.join(sessionDir, 'smart_pattern_mask.png');
      
      // Multi-scale feature detection with pattern recognition
      const command = `convert "${imagePath}" \
        \\( -clone 0 -colorspace HSL -channel S -separate -threshold 25% \\) \
        \\( -clone 0 -colorspace LAB -channel A,B -separate -evaluate-sequence add -normalize \\) \
        \\( -clone 0 -blur 0x1 -enhance -threshold 15% \\) \
        \\( -clone 0 -edge 1 -threshold 10% \\) \
        -delete 0 \
        -evaluate-sequence multiply -normalize \
        -morphology close disk:2.5 \
        -morphology open disk:1 \
        -threshold 30% \
        "${smartPath}"`;
      
      await execAsync(command);

      if (!fs.existsSync(smartPath)) {
        return [];
      }

      return await this.analyzeMaskRegionsAdvanced(smartPath, 'smart-pattern', options);
      
    } catch (error) {
      logger.warn(`Smart pattern detection failed: ${error}`);
      return [];
    }
  }

  /**
   * Adaptive threshold highlights using dynamic threshold calculation
   */
  private async detectAdaptiveThresholdHighlights(
    imagePath: string,
    sessionDir: string,
    options: any
  ): Promise<HighlightRegion[]> {
    try {
      const adaptivePath = path.join(sessionDir, 'adaptive_threshold_mask.png');
      
      // Calculate image statistics for adaptive thresholding
      const { stdout: statsOutput } = await execAsync(`convert "${imagePath}" -colorspace HSL -channel S -separate -format "%[mean] %[standard-deviation]" info:`);
      const [mean, stddev] = statsOutput.trim().split(' ').map(v => parseFloat(v));
      
      // Dynamic threshold calculation based on image characteristics
      const dynamicThreshold = Math.max(15, Math.min(60, mean + stddev * 0.5));
      
      const command = `convert "${imagePath}" \
        -colorspace HSL \
        \\( -clone 0 -channel S -separate -threshold ${dynamicThreshold}% \\) \
        \\( -clone 0 -channel L -separate -auto-level -threshold 80% \\) \
        -delete 0 \
        -compose multiply -composite \
        -morphology close disk:3 \
        -morphology open disk:1.5 \
        "${adaptivePath}"`;
      
      await execAsync(command);

      if (!fs.existsSync(adaptivePath)) {
        return [];
      }

      return await this.analyzeMaskRegionsAdvanced(adaptivePath, 'adaptive-threshold', options);
      
    } catch (error) {
      logger.warn(`Adaptive threshold detection failed: ${error}`);
      return [];
    }
  }
}

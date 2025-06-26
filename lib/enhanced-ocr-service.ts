import { PreprocessingService } from './preprocessing-service';
import { HighlightDetector } from './highlight-detector';
import { HandwritingDetector } from './handwriting-detector';
import { ImageProcessingService } from './image-processing-service';
import { TensorOCRService } from './tensor-ocr-service';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(execSync);

// Import logger utility
const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warn: (message: string) => console.warn(`[WARN] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`)
};

export interface EnhancedOCROptions {
  applyCLAHE?: boolean;
  deskew?: boolean;
  enhanceEdges?: boolean;
  normalize?: boolean;
  perspectiveCorrection?: boolean;
  optimizeHighlightedText?: boolean;
  enableHandwritingDetection?: boolean;
  outputDir?: string;
  language?: string;
  edgeStrength?: number;
  claheClipLimit?: number;
  claheTileSize?: number;
  // New advanced options
  useAdvancedImageProcessing?: boolean;
  useTensorOCR?: boolean;
  multiScaleProcessing?: boolean;
  useNeuralEnhancement?: boolean;
  applyDenoising?: boolean;
  sharpenText?: boolean;
  adaptiveContrast?: boolean;
  highlightColors?: string[];
  usePostProcessing?: boolean;
}

export interface EnhancedOCRResult {
  text: string;
  confidence: number;
  processingTime: number;
  success: boolean;
  enhancedImagePath?: string;
  preprocessingOperations: string[];
  error?: string;
  highlightedRegions?: any[];
  wordCount: number;
  documentType?: 'handwritten' | 'printed' | 'mixed' | 'unknown';
  qualityScore?: number;
  recommendationsApplied?: string[];
}

/**
 * Enhanced OCR Service that extends existing functionality
 * without breaking current implementations
 */
export class EnhancedOCRService {
  private preprocessingService: PreprocessingService;
  private highlightDetector: HighlightDetector;
  private handwritingDetector: HandwritingDetector;
  private imageProcessor: ImageProcessingService;
  private tensorOCR: TensorOCRService;
  private sessionDir: string;

  constructor() {
    this.preprocessingService = new PreprocessingService();
    this.highlightDetector = new HighlightDetector();
    this.handwritingDetector = new HandwritingDetector();
    this.imageProcessor = new ImageProcessingService();
    this.tensorOCR = new TensorOCRService();
    this.sessionDir = path.join(os.tmpdir(), `enhanced_ocr_${Date.now()}`);
    this.ensureSessionDirectory();

    // Initialize TensorOCR models in background
    this.tensorOCR.loadModels().catch(err => {
      logger.warn(`Failed to load TensorOCR models: ${err}`);
    });
  }

  private ensureSessionDirectory(): void {
    try {
      if (!fs.existsSync(this.sessionDir)) {
        fs.mkdirSync(this.sessionDir, { recursive: true });
      }
    } catch (error) {
      logger.error(`Failed to create session directory: ${error}`);
      this.sessionDir = os.tmpdir();
    }
  }

  /**
   * Process document with enhanced preprocessing and OCR
   * Uses advanced image processing and TensorOCR for better results
   */
  async processDocument(inputPath: string, options: EnhancedOCROptions = {}): Promise<EnhancedOCRResult> {
    const startTime = Date.now();
    let preprocessingOperations: string[] = [];

    try {
      logger.info(`Starting enhanced OCR processing for: ${inputPath}`);

      // Validate input
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      // Step 1: Apply enhanced preprocessing with advanced image processing
      let preprocessedPath;
      if (options.useAdvancedImageProcessing !== false) {
        // Use the new ImageProcessingService for better results
        const processingResult = await this.imageProcessor.processImage(inputPath, {
          applyCLAHE: options.applyCLAHE !== false,
          claheClipLimit: options.claheClipLimit || 2.0,
          claheTileSize: options.claheTileSize || 8,
          enhanceEdges: options.enhanceEdges || false,
          edgeStrength: options.edgeStrength || 1.0,
          applyDenoising: options.applyDenoising !== false,
          sharpenText: options.sharpenText !== false,
          perspectiveCorrection: options.perspectiveCorrection || false,
          enhanceHighlights: options.optimizeHighlightedText || false,
          highlightColors: options.highlightColors || ['yellow', 'green', 'cyan', 'pink', 'orange', 'blue'],
          multiScaleProcessing: options.multiScaleProcessing || false
        });

        preprocessedPath = processingResult.outputPath;
        preprocessingOperations = processingResult.operations;
        logger.info(`Advanced image processing completed with quality score ${processingResult.qualityScore}`);
      } else {
        // Fall back to traditional preprocessing
        preprocessedPath = await this.applyEnhancedPreprocessing(inputPath, options);
        preprocessingOperations = await this.getAppliedOperations(options);
      }

      // Step 2: Detect document type and characteristics
      const documentType = await this.detectDocumentType(preprocessedPath, options);
      logger.info(`Document type detected as: ${documentType}`);

      // Step 3: Detect highlights if enabled with improved highlight detection
      let highlightRegions: any[] = [];
      if (options.optimizeHighlightedText) {
        try {
          // Use enhanced highlight detection with advanced filtering
          const highlightResult = await this.highlightDetector.detectHighlightsWithEnhancedPreprocessing(
            preprocessedPath, {
              colorThreshold: 0.25, // More sensitive threshold
              minRegionSize: 50,    // Detect smaller highlighted areas
              enableTextExtraction: true,
              targetColors: options.highlightColors || ['yellow', 'green', 'cyan', 'pink', 'orange', 'blue'],
              sensitivityLevel: 'high',
              enableDynamicThresholding: true,
              useAdvancedFiltering: true,
              adaptiveContrast: true
            }
          );

          if (highlightResult.hasHighlights) {
            highlightRegions = highlightResult.highlightRegions;
            preprocessingOperations.push(`Detected ${highlightRegions.length} highlighted regions with enhanced algorithms`);
            logger.info(`Found ${highlightRegions.length} highlighted regions with confidence ${highlightResult.confidenceScore}%`);
          }
        } catch (error) {
          logger.warn(`Enhanced highlight detection failed: ${error}`);
          // Try fallback detection
          try {
            const basicResult = await this.highlightDetector.detectHighlights(preprocessedPath);
            if (basicResult.hasHighlights) {
              highlightRegions = basicResult.highlightRegions;
              preprocessingOperations.push(`Detected ${highlightRegions.length} highlighted regions with basic algorithm`);
            }
          } catch (fallbackError) {
            logger.error(`Fallback highlight detection also failed: ${fallbackError}`);
          }
        }
      }

      // Step 4: Perform OCR with appropriate strategy, using TensorOCR if enabled
      const ocrResult = await this.performIntelligentOCR(
        preprocessedPath, 
        highlightRegions, 
        documentType,
        {
          ...options,
          // Enable TensorOCR unless explicitly disabled
          useTensorOCR: options.useTensorOCR !== false
        }
      );

      // Step 5: Calculate quality metrics with improved algorithm
      const qualityScore = this.calculateEnhancedQualityScore(ocrResult.text, ocrResult.confidence, highlightRegions.length);
      const processingTime = Date.now() - startTime;
      const wordCount = ocrResult.text.split(/\s+/).filter(Boolean).length;

      // Generate detailed recommendations based on all factors
      const recommendations = this.generateEnhancedRecommendations(
        preprocessingOperations, 
        qualityScore, 
        documentType, 
        highlightRegions.length > 0,
        processingTime
      );

      logger.info(`Enhanced OCR completed in ${processingTime}ms with confidence ${ocrResult.confidence}% and quality score ${qualityScore}`);

      return {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        processingTime,
        success: true,
        enhancedImagePath: preprocessedPath,
        preprocessingOperations,
        highlightedRegions: highlightRegions,
        wordCount,
        documentType,
        qualityScore,
        recommendationsApplied: recommendations
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`Enhanced OCR processing failed: ${error}`);

      return {
        text: '',
        confidence: 0,
        processingTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        preprocessingOperations,
        highlightedRegions: [],
        wordCount: 0,
        documentType: 'unknown'
      };
    }
  }

  /**
   * Apply enhanced preprocessing techniques with advanced image processing
   */
  private async applyEnhancedPreprocessing(inputPath: string, options: EnhancedOCROptions): Promise<string> {
    try {
      logger.info('Applying advanced image processing for OCR enhancement');

      const processingResult = await this.imageProcessor.processImage(inputPath, {
        applyCLAHE: options.applyCLAHE !== false,
        claheClipLimit: options.claheClipLimit || 2.0,
        claheTileSize: options.claheTileSize || 8,
        enhanceEdges: options.enhanceEdges || false,
        edgeStrength: options.edgeStrength || 1.0,
        applyDenoising: true,
        denoiseStrength: 10,
        sharpenText: true,
        sharpenStrength: 1.2,
        adaptiveThreshold: false,
        perspectiveCorrection: options.perspectiveCorrection || false,
        enhanceHighlights: options.optimizeHighlightedText || false,
        highlightColors: ['yellow', 'green', 'cyan', 'pink', 'orange', 'blue'],
        multiScaleProcessing: true
      });

      if (processingResult.success) {
        logger.info(`Advanced image processing completed with ${processingResult.operations.length} operations and quality score ${processingResult.qualityScore}`);
        return processingResult.outputPath;
      } else {
        logger.warn(`Advanced image processing failed: ${processingResult.error}, falling back to basic processing`);
        return this.applyBasicPreprocessing(inputPath, options);
      }
    } catch (error) {
      logger.warn(`Enhanced preprocessing failed, using fallback: ${error}`);
      // Fall back to basic preprocessing if advanced fails
      return this.applyBasicPreprocessing(inputPath, options);
    }
  }

  /**
   * Apply basic preprocessing as fallback
   */
  private async applyBasicPreprocessing(inputPath: string, options: EnhancedOCROptions): Promise<string> {
    const outputPath = path.join(this.sessionDir, 'basic_preprocessed.png');
    let command = `convert "${inputPath}"`;

    // Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    if (options.applyCLAHE !== false) {
      command += ` -colorspace Lab -channel 0 -contrast-stretch 2%x98% -equalize -channel RG -equalize -colorspace sRGB`;
    }

    // Apply deskewing
    if (options.deskew !== false) {
      command += ' -background white -deskew 40% -trim +repage';
    }

    // Apply edge enhancement
    if (options.enhanceEdges) {
      const strength = options.edgeStrength || 1.0;
      command += ` -unsharp 0x1+${strength}+0.05`;
    }

    // Apply normalization
    if (options.normalize) {
      command += ' -normalize -contrast-stretch 2%x98%';
    }

    // Apply perspective correction (simplified)
    if (options.perspectiveCorrection) {
      command += ' -auto-orient';
    }

    command += ` "${outputPath}"`;

    try {
      execSync(command, { stdio: 'pipe', timeout: 30000 });
      logger.info('Basic preprocessing completed successfully');
      return outputPath;
    } catch (error) {
      logger.warn(`Basic preprocessing failed, using original: ${error}`);
      // Fall back to original file if preprocessing fails
      return inputPath;
    }
  }

  /**
   * Detect document type (handwritten, printed, mixed)
   */
  private async detectDocumentType(imagePath: string, options: EnhancedOCROptions): Promise<'handwritten' | 'printed' | 'mixed' | 'unknown'> {
    if (!options.enableHandwritingDetection) {
      return 'printed';
    }

    try {
      const handwritingAnalysis = await this.handwritingDetector.analyzeHandwriting(imagePath, 0.7);
      
      if (handwritingAnalysis.isHandwritten) {
        return handwritingAnalysis.confidence > 0.8 ? 'handwritten' : 'mixed';
      }
      
      return 'printed';
    } catch (error) {
      logger.warn(`Document type detection failed: ${error}`);
      return 'unknown';
    }
  }

  /**
   * Perform intelligent OCR based on document characteristics
   * Enhanced with TensorOCR for better accuracy and highlight recognition
   */
  private async performIntelligentOCR(
    imagePath: string, 
    highlightRegions: any[] = [], 
    documentType: string,
    options: EnhancedOCROptions
  ): Promise<{ text: string; confidence: number }> {

    try {
      let bestResult = { text: '', confidence: 0 };
      const isHandwritten = documentType === 'handwritten';
      const hasHighlights = highlightRegions.length > 0;

      // Strategy 1: Use TensorOCR with neural enhancement if enabled
      if (options.useTensorOCR) {
        try {
          logger.info('Using TensorOCR for enhanced text recognition');
          const tensorResult = await this.tensorOCR.processImage(imagePath, {
            useHandwritingModel: isHandwritten,
            enhanceText: true,
            usePostProcessing: options.usePostProcessing !== false,
            language: options.language || 'eng',
            debugMode: true
          });

          if (tensorResult.text) {
            bestResult = {
              text: tensorResult.text,
              confidence: tensorResult.confidence * 100
            };

            logger.info(`TensorOCR succeeded with confidence ${bestResult.confidence}% using ${tensorResult.modelUsed} model`);
          }
        } catch (error) {
          logger.warn(`TensorOCR failed, falling back to traditional OCR: ${error}`);
          // Continue with traditional methods as fallback
        }
      }

      // Strategy 2: Multi-PSM approach if TensorOCR didn't produce good results
      if (bestResult.confidence < 70) {
        logger.info('Using multi-PSM Tesseract approach for text recognition');
        const psmModes = this.selectOptimalPSMModes(documentType, hasHighlights);

        for (const psm of psmModes) {
          try {
            const result = await this.performOCRWithPSM(imagePath, psm, options.language || 'eng');
            if (result.confidence > bestResult.confidence) {
              bestResult = result;
              logger.info(`Found better result with PSM ${psm}: ${result.confidence}%`);
            }
          } catch (error) {
            logger.warn(`OCR with PSM ${psm} failed: ${error}`);
          }
        }
      }

      // Strategy 3: Enhanced processing for highlighted regions
      if (hasHighlights) {
        logger.info(`Processing ${highlightRegions.length} highlighted regions with specialized techniques`);
        const highlightText = await this.extractHighlightedText(imagePath, highlightRegions);

        if (highlightText) {
          bestResult.text += '\n\nHighlighted Content:\n' + highlightText;
          bestResult.confidence = Math.min(bestResult.confidence + 5, 95);
          logger.info('Successfully extracted highlighted text content');
        }
      }

      // Strategy 4: Document-type specific enhancement
      if (isHandwritten) {
        logger.info('Applying handwriting-specific enhancements');
        const enhancedResult = await this.enhanceHandwrittenOCR(imagePath, bestResult, options);

        if (enhancedResult.confidence > bestResult.confidence) {
          bestResult = enhancedResult;
          logger.info(`Handwriting enhancement improved confidence to ${bestResult.confidence}%`);
        }
      }

      // Strategy 5: Post-processing to improve text quality
      if (options.usePostProcessing !== false && !options.useTensorOCR) {
        bestResult.text = this.postProcessText(bestResult.text, documentType);
        logger.info('Applied text post-processing for quality improvement');
      }

      return bestResult;

    } catch (error) {
      logger.error(`Intelligent OCR failed: ${error}`);
      return { text: '', confidence: 0 };
    }
  }

  /**
   * Post-process OCR text to improve quality based on document type
   */
  private postProcessText(text: string, documentType: string): string {
    if (!text) return '';

    // Common corrections
    let processed = text;

    // Remove excessive whitespace
    processed = processed.replace(/\s+/g, ' ');
    processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n');

    // Fix common OCR errors
    const corrections: [RegExp, string][] = [
      [/\b1\b/g, 'I'],                  // Isolated 1 to I
      [/\b0\b/g, 'O'],                  // Isolated 0 to O
      [/([a-z])l\b/g, '$1!'],          // ending l to !
      [/\bl([A-Z])/g, 'I$1'],          // starting l to I
      [/\.\s*,/g, ','],                 // .  , to just ,
      [/,\s*\./g, '.'],                // ,  . to just .
      [/([a-z])(\s+)([.,;:])/g, '$1$3'], // Remove space before punctuation
      [/\s+([\])}])/g, '$1'],          // Remove space before closing brackets
      [/([\[({])\s+/g, '$1']           // Remove space after opening brackets
    ];

    for (const [pattern, replacement] of corrections) {
      processed = processed.replace(pattern, replacement);
    }

    // Document-type specific corrections
    if (documentType === 'handwritten') {
      // Handwriting-specific corrections
      processed = processed.replace(/\bcloes\b/gi, 'does');
      processed = processed.replace(/\bavith\b/gi, 'with');
      processed = processed.replace(/\bthot\b/gi, 'that');
    }

    return processed.trim();
  }

  /**
   * Select optimal PSM modes based on document characteristics
   */
  private selectOptimalPSMModes(documentType: string, hasHighlights: boolean): number[] {
    if (documentType === 'handwritten') {
      return [8, 13, 6]; // Single word, raw line, uniform block
    } else if (hasHighlights) {
      return [6, 3, 8]; // Uniform block, auto OSD, single word for highlights
    } else {
      return [3, 6, 4]; // Auto OSD, uniform block, single column
    }
  }

  /**
   * Perform OCR with specific PSM mode
   */
  private async performOCRWithPSM(imagePath: string, psm: number, language: string): Promise<{ text: string; confidence: number }> {
    const outputBasePath = path.join(this.sessionDir, `ocr_output_psm${psm}`);

    try {
      execSync(`tesseract "${imagePath}" "${outputBasePath}" -l ${language} --psm ${psm} --oem 3`, 
        { stdio: 'pipe', timeout: 30000 });
      
      const textFilePath = `${outputBasePath}.txt`;
      if (fs.existsSync(textFilePath)) {
        const text = fs.readFileSync(textFilePath, 'utf-8').trim();
        const confidence = this.calculateTextQuality(text);
        
        // Cleanup
        fs.unlinkSync(textFilePath);
        
        return { text, confidence };
      }
      
      throw new Error('OCR output file not generated');
    } catch (error) {
      throw new Error(`Tesseract with PSM ${psm} failed: ${error}`);
    }
  }
  /**
   * Extract text from highlighted regions with specialized OCR
   * Uses multiple enhancement techniques and OCR approaches for better accuracy
   */
  private async extractHighlightedText(imagePath: string, highlightRegions: any[]): Promise<string> {
    const highlightTexts: string[] = [];
    const processedRegions: Record<number, { text: string; confidence: number }[]> = {};

    // Process each highlight region with multiple approaches
    for (let i = 0; i < Math.min(highlightRegions.length, 10); i++) {
      try {
        processedRegions[i] = [];
        const region = highlightRegions[i];
        const baseCropPath = path.join(this.sessionDir, `highlight_${i}`);
        const cropSpec = `${region.width}x${region.height}+${region.x}+${region.y}`;

        // Create multiple enhanced versions of the highlighted region
        // 1. Standard enhancement
        const standardPath = `${baseCropPath}_standard.png`;
        await execAsync(`convert "${imagePath}" -crop ${cropSpec} \
          -resize 200% \
          -unsharp 0x1+1.5+0 \
          -contrast-stretch 3%x97% \
          "${standardPath}"`);

        // 2. High contrast binarization - good for yellow highlights
        const binarizedPath = `${baseCropPath}_binarized.png`;
        await execAsync(`convert "${imagePath}" -crop ${cropSpec} \
          -resize 200% \
          -grayscale Rec709Luminance \
          -normalize \
          -threshold 75% \
          "${binarizedPath}"`);

        // 3. Color space transformation - good for colored highlights
        const colorSpacePath = `${baseCropPath}_colorspace.png`;
        await execAsync(`convert "${imagePath}" -crop ${cropSpec} \
          -resize 200% \
          -colorspace Lab -channel 0 \
          -contrast-stretch 5%x95% \
          -normalize \
          -colorspace sRGB \
          -sharpen 0x1 \
          "${colorSpacePath}"`);

        // 4. Edge enhancement - good for partially highlighted text
        const edgePath = `${baseCropPath}_edge.png`;
        await execAsync(`convert "${imagePath}" -crop ${cropSpec} \
          -resize 200% \
          -colorspace Gray \
          -edge 1 \
          -negate \
          -normalize \
          "${edgePath}"`);

        // Process each enhanced version with different OCR approaches
        const enhancedPaths = [standardPath, binarizedPath, colorSpacePath, edgePath];
        const psmModes = [8, 6, 7]; // Single word, uniform block, single line

        for (const enhancedPath of enhancedPaths) {
          for (const psm of psmModes) {
            try {
              const outputBasePath = path.join(this.sessionDir, `highlight_text_${i}_psm${psm}_${path.basename(enhancedPath, '.png')}`);

              // Apply OCR with specific settings for each approach
              await execAsync(`tesseract "${enhancedPath}" "${outputBasePath}" -l eng --psm ${psm} \
                -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;-()[]{}/ \"'& \
                -c textord_min_linesize=2.5`, { timeout: 10000 });

              const textFilePath = `${outputBasePath}.txt`;
              if (fs.existsSync(textFilePath)) {
                const text = fs.readFileSync(textFilePath, 'utf-8').trim();
                if (text.length > 0) {
                  // Calculate confidence based on various metrics
                  const confidence = this.calculateTextConfidence(text);
                  processedRegions[i].push({ text, confidence });
                }
                fs.unlinkSync(textFilePath);
              }
            } catch (err) {
              logger.warn(`OCR attempt failed for highlight ${i} with PSM ${psm}: ${err}`);
            }
          }
        }

        // Cleanup crop files
        for (const enhancedPath of enhancedPaths) {
          if (fs.existsSync(enhancedPath)) {
            fs.unlinkSync(enhancedPath);
          }
        }

        // Select best result for this region based on confidence
        if (processedRegions[i].length > 0) {
          // Sort by confidence
          processedRegions[i].sort((a, b) => b.confidence - a.confidence);
          highlightTexts.push(processedRegions[i][0].text);
        }

      } catch (error) {
        logger.warn(`Failed to extract highlight ${i}: ${error}`);
      }
    }

    return highlightTexts.join('\n');
  }

  /**
   * Calculate confidence score for extracted text
   */
  private calculateTextConfidence(text: string): number {
    if (!text || text.length === 0) return 0;

    let score = 50; // Base score

    // Check for readable characters ratio
    const readableChars = text.match(/[a-zA-Z0-9\s.,!?;:]/g);
    if (readableChars) {
      score += (readableChars.length / text.length) * 30;
    }

    // Check for complete words
    const words = text.split(/\s+/).filter(word => word.match(/^[a-zA-Z]+$/));
    if (words.length > 0) {
      score += Math.min(words.length * 2, 20);
    }

    // Penalize excessive special characters
    const specialChars = text.match(/[^a-zA-Z0-9\s.,!?;:\-()]/g);
    if (specialChars && specialChars.length > text.length * 0.1) {
      score -= 10;
    }

    // Word length variation score - natural text has varied word lengths
    const wordLengths = text.split(/\s+/).map(w => w.length).filter(l => l > 0);
    if (wordLengths.length > 2) {
      const uniqueLengths = new Set(wordLengths).size;
      score += Math.min(uniqueLengths * 2, 10);
    }

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Enhance OCR results for handwritten documents
   */
  private async enhanceHandwrittenOCR(
    imagePath: string, 
    baseResult: { text: string; confidence: number },
    options: EnhancedOCROptions
  ): Promise<{ text: string; confidence: number }> {
    
    try {
      // Apply handwriting-specific preprocessing
      const handwritingEnhancedPath = path.join(this.sessionDir, 'handwriting_enhanced.png');
      
      const enhanceCommand = `convert "${imagePath}" \
        -colorspace Gray \
        -threshold 85% \
        -morphology close disk:1 \
        -unsharp 0x2+2.0+0 \
        "${handwritingEnhancedPath}"`;
        
      execSync(enhanceCommand, { stdio: 'pipe' });

      // Try OCR with handwriting-optimized settings
      const handwritingResult = await this.performOCRWithPSM(handwritingEnhancedPath, 8, options.language || 'eng');
      
      // Choose better result
      if (handwritingResult.confidence > baseResult.confidence) {
        return {
          text: handwritingResult.text,
          confidence: Math.min(handwritingResult.confidence + 10, 95) // Boost confidence for handwriting
        };
      }
      
      return baseResult;
      
    } catch (error) {
      logger.warn(`Handwriting enhancement failed: ${error}`);
      return baseResult;
    }
  }

  /**
   * Calculate text quality score
   */
  private calculateTextQuality(text: string): number {
    if (!text || text.length === 0) return 0;

    let score = 50; // Base score

    // Check for readable characters
    const readableChars = text.match(/[a-zA-Z0-9\s.,!?;:]/g);
    if (readableChars) {
      score += (readableChars.length / text.length) * 30;
    }

    // Check for complete words
    const words = text.split(/\s+/).filter(word => word.match(/^[a-zA-Z]+$/));
    if (words.length > 0) {
      score += Math.min(words.length * 2, 20);
    }

    // Penalize excessive special characters
    const specialChars = text.match(/[^a-zA-Z0-9\s.,!?;:\-()]/g);
    if (specialChars && specialChars.length > text.length * 0.1) {
      score -= 10;
    }

    return Math.min(Math.max(score, 0), 95);
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(text: string, confidence: number): number {
    const textQuality = this.calculateTextQuality(text);
    const lengthScore = Math.min(text.length / 100, 1) * 10; // Bonus for longer text
    
    return Math.round((textQuality + confidence + lengthScore) / 3);
  }

  /**
   * Calculate enhanced quality score with additional factors
   */
  private calculateEnhancedQualityScore(text: string, confidence: number, highlightCount: number): number {
    // Base quality calculation
    const textQuality = this.calculateTextQuality(text);
    const lengthScore = Math.min(text.length / 100, 1) * 10; // Bonus for longer text

    // Additional factors
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const wordVarietyScore = this.calculateWordVariety(text) * 10; // 0-10 score for word variety
    const sentenceStructureScore = this.calculateSentenceStructure(text) * 10; // 0-10 score for natural sentence structure

    // Bonus for highlight extraction success
    const highlightBonus = highlightCount > 0 ? Math.min(highlightCount * 2, 10) : 0;

    // Combine all factors with appropriate weights
    const weightedScore = 
      (textQuality * 0.3) + 
      (confidence * 0.3) + 
      (lengthScore * 0.1) + 
      (wordVarietyScore * 0.1) + 
      (sentenceStructureScore * 0.1) + 
      (highlightBonus * 0.1);

    return Math.round(weightedScore);
  }

  /**
   * Calculate word variety score (lexical diversity)
   */
  private calculateWordVariety(text: string): number {
    if (!text) return 0;

    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length < 5) return 0.5; // Too few words for good measurement

    const uniqueWords = new Set(words);
    const uniqueRatio = uniqueWords.size / words.length;

    return Math.min(uniqueRatio * 2, 1); // Scale 0-1
  }

  /**
   * Calculate sentence structure score
   * Checks for natural text patterns like capitalization, punctuation
   */
  private calculateSentenceStructure(text: string): number {
    if (!text || text.length < 10) return 0.5;

    let score = 0.5; // Start with neutral score

    // Check for sentence capitalization
    const sentenceStarts = text.match(/[.!?]\s+[A-Z]/g);
    if (sentenceStarts && sentenceStarts.length > 0) {
      score += 0.1;
    }

    // Check for appropriate punctuation
    const endingPunctuation = text.match(/[.!?]\s*$/g);
    if (endingPunctuation) {
      score += 0.1;
    }

    // Check for natural paragraph structure
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) {
      score += 0.1;
    }

    // Check for absence of random characters/strings
    const randomCharPatterns = text.match(/[^a-zA-Z0-9,.!?;:'"\s\-()\[\]{}]/g);
    if (!randomCharPatterns || randomCharPatterns.length < text.length * 0.05) {
      score += 0.1;
    }

    // Check word length distribution (natural text has varied word lengths)
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 5) {
      const lengths = words.map(w => w.length);
      const uniqueLengths = new Set(lengths).size;
      if (uniqueLengths >= 3) {
        score += 0.1;
      }
    }

    return Math.min(score, 1);
  }

  /**
   * Get list of applied preprocessing operations
   */
  private async getAppliedOperations(options: EnhancedOCROptions): Promise<string[]> {
    const operations: string[] = [];

    if (options.applyCLAHE !== false) {
      operations.push('CLAHE Enhancement');
    }
    if (options.deskew !== false) {
      operations.push('Document Deskewing');
    }
    if (options.enhanceEdges) {
      operations.push('Edge Enhancement');
    }
    if (options.normalize) {
      operations.push('Image Normalization');
    }
    if (options.perspectiveCorrection) {
      operations.push('Perspective Correction');
    }
    if (options.enableHandwritingDetection) {
      operations.push('Handwriting Detection');
    }

    return operations;
  }

  /**
   * Generate processing recommendations
   */
  private generateRecommendations(operations: string[], qualityScore: number): string[] {
    const recommendations: string[] = [];

    if (qualityScore < 70) {
      recommendations.push('Consider using higher resolution images for better results');
      
      if (!operations.includes('CLAHE Enhancement')) {
        recommendations.push('Try enabling CLAHE for low-contrast documents');
      }
      
      if (!operations.includes('Edge Enhancement')) {
        recommendations.push('Enable edge enhancement for blurry text');
      }
    }

    if (qualityScore > 85) {
      recommendations.push('Excellent OCR quality achieved');
    }

    return recommendations;
  }

  /**
   * Generate enhanced recommendations based on multiple factors
   */
  private generateEnhancedRecommendations(
    operations: string[], 
    qualityScore: number, 
    documentType: string,
    hasHighlights: boolean,
    processingTime: number
  ): string[] {
    const recommendations: string[] = [];
    const applied: Record<string, boolean> = {};

    // Mark all operations as applied
    operations.forEach(op => {
      applied[op] = true;
    });

    // Quality-based recommendations
    if (qualityScore < 60) {
      recommendations.push('Low OCR quality detected. Consider trying multiple processing approaches.');

      // Suggest image quality improvements
      if (!applied['CLAHE enhancement']) {
        recommendations.push('Enable CLAHE enhancement for improved contrast in low-quality documents');
      }

      if (!applied['Multi-scale image decomposition and enhancement']) {
        recommendations.push('Try multi-scale processing for complex documents with varying text sizes');
      }

      if (!applied['Edge enhancement']) {
        recommendations.push('Enable edge enhancement to improve text clarity');
      }

      if (!applied['Neural text enhancement'] && !applied['TensorOCR']) {
        recommendations.push('Try TensorOCR with neural enhancement for better recognition quality');
      }
    } else if (qualityScore < 75) {
      recommendations.push('Moderate OCR quality. Consider fine-tuning preprocessing parameters.');
    } else if (qualityScore >= 90) {
      recommendations.push('Excellent OCR quality achieved. Current settings are optimal.');
    }

    // Document type specific recommendations
    if (documentType === 'handwritten') {
      if (!applied['Neural handwriting OCR']) {
        recommendations.push('Enable TensorOCR with handwriting model for better handwriting recognition');
      }

      if (!applied['Handwriting Detection']) {
        recommendations.push('Enable handwriting detection for specialized processing');
      }
    }

    // Highlight-specific recommendations
    if (hasHighlights) {
      if (!applied['Enhanced highlighted regions']) {
        recommendations.push('Enable highlight optimization for better extraction of highlighted content');
      }

      if (applied['Detected highlighted regions'] && !applied['CLAHE enhancement']) {
        recommendations.push('Add CLAHE enhancement to improve highlighted text recognition');
      }
    }

    // Performance recommendations
    if (processingTime > 10000) { // More than 10 seconds
      recommendations.push('Processing time is high. Consider disabling some intensive preprocessing steps for faster results.');
    }

    // Limit to most important recommendations
    return recommendations.slice(0, 5);
  }

  /**
   * Clean up session directory
   */
  cleanup(): void {
    try {
      if (fs.existsSync(this.sessionDir)) {
        execSync(`rm -rf "${this.sessionDir}"`, { stdio: 'pipe' });
      }
    } catch (error) {
      logger.warn(`Cleanup failed: ${error}`);
    }
  }

  /**
   * Get processing capabilities
   */
  getCapabilities(): Record<string, any> {
    return {
      supportedFormats: ['png', 'jpg', 'jpeg', 'tiff', 'pdf'],
      preprocessingOptions: [
        'CLAHE Enhancement',
        'Document Deskewing', 
        'Edge Enhancement',
        'Image Normalization',
        'Perspective Correction',
        'Highlight Optimization',
        'Handwriting Detection'
      ],
      ocrEngines: ['tesseract'],
      supportedLanguages: ['eng', 'fra', 'deu', 'spa', 'ita'],
      maxFileSize: '50MB',
      batchProcessing: true,
      highlightDetection: true,
      handwritingSupport: true
    };
  }
}

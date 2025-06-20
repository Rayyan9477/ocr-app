/**
 * Paligemma 2 OCR Integration
 * 
 * Integrates the Paligemma 2 VLM into the OCR system to enhance recognition
 * accuracy and precision without replacing the existing functionality.
 */

import { AutoModel, AutoProcessor } from '@xenova/transformers';
import { PromptCategory } from './vlm/models/paligemma2-prompts';
import { OCRResult, OCREngine } from './multi-engine-ocr';
import logger from './logger';
import { VLMOptions } from './paligemma2-service';

// Use dynamic imports for Node.js modules to ensure they're only loaded on the server
let fsModule: any = null;
let pathModule: any = null;

// This will only be executed on the server side
if (typeof window === 'undefined') {
  // Using dynamic import() for server-only modules with ES modules
  import('fs').then(module => { fsModule = module.default });
  import('path').then(module => { pathModule = module.default });
}

/**
 * Integration mode for Paligemma 2
 */
export enum Paligemma2IntegrationMode {
  /**
   * Uses VLM for direct OCR of text from images
   */
  DIRECT = 'direct',
  
  /**
   * Uses VLM to assist other OCR engines
   */
  ASSIST = 'assist',
  
  /**
   * Uses VLM for post-processing and enhancement only
   */
  ENHANCE = 'enhance',
  
  /**
   * Dynamically chooses the best approach for processing
   */
  ADAPTIVE = 'adaptive'
}

/**
 * Result from Paligemma 2 OCR assistance
 */
export interface Paligemma2AssistResult {
  /**
   * Original OCR result
   */
  originalResult: OCRResult;
  
  /**
   * Enhanced text from Paligemma 2
   */
  enhancedText: string;
  
  /**
   * Confidence assessment
   */
  confidenceAssessment: {
    overall: number;
    regions: Array<{
      region: string;
      confidence: number;
      issues: string[];
    }>;
    potentialErrors: Array<{
      detected: string;
      probable: string;
      confidence: number;
    }>;
  };
  
  /**
   * Processing time in milliseconds
   */
  processingTimeMs: number;
  
  /**
   * Integration mode used
   */
  integrationMode: Paligemma2IntegrationMode;
  
  /**
   * Whether the result was improved
   */
  improved: boolean;
  
  /**
   * Improvement metrics
   */
  improvementMetrics: {
    confidenceImprovement: number;
    errorsCorrected: number;
    textSimilarity: number;
  };
}

/**
 * Paligemma 2 OCR Integration Service
 * 
 * Provides seamless integration of Paligemma 2 VLM with existing OCR engines
 * to enhance accuracy and precision without disrupting current functionality.
 */
// Interface for VLM response
export interface VLMResponse<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  processingTimeMs?: number;
}

export class Paligemma2OCRIntegration implements OCREngine {
  name = 'paligemma2';
  service: any = this; // Reference to self for compatibility
  available = true;
  specialization: string[] = ['handwritten', 'document', 'general'];
  confidence = true; // Indicates this engine provides confidence scores
  
  // Required by OCREngine interface
  preprocessor = async (inputPath: string, documentType?: string): Promise<string> => {
    // Use the existing preprocessing logic from the class
    return this.preprocessImage(inputPath, documentType);
  };
  
  // Add process method required by OCREngine
  process = async (inputPath: string, options: any = {}): Promise<OCRResult> => {
    const prompt = 'Extract all text from this document with high accuracy. ' +
                 'Preserve formatting, line breaks, and document structure. ' +
                 'Include all visible text including headers, footers, and page numbers.';
    
    const result = await this.processImage(inputPath, prompt);
    
    return {
      text: result.text,
      confidence: 0.9, // Default confidence since Paligemma2 doesn't provide this
      engine: this.name,
      processingTime: result.processingTime,
      metadata: {
        ...result.metadata,
        engine: this.name
      }
    };
  };
  private model: any = null;
  private processor: any = null;
  private initialized: boolean = false;
  private mode: Paligemma2IntegrationMode = Paligemma2IntegrationMode.DIRECT;
  
  // Add missing methods required by OCREngine interface
  private preprocessImage = async (inputPath: string, documentType?: string): Promise<string> => {
    // Simple preprocessing - just return the input path for now
    // In a real implementation, you might want to enhance the image here
    return inputPath;
  };
  
  private processPage = async (page: { path: string; metadata: any }): Promise<any> => {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Process the page using the adapter
      const result = await this.processImage(page.path, 'Extract all text from this document page.');
      
      return {
        ...page,
        metadata: {
          ...page.metadata,
          ...result.metadata,
          processingTime: result.processingTime
        },
        text: result.text
      };
    } catch (error) {
      logger.error(`Error processing page ${page.path}: ${error}`);
      throw error;
    }
  };
  
  private processImage = async (imagePath: string, prompt: string): Promise<{ text: string; processingTime: number; metadata: any }> => {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const startTime = Date.now();
    try {
      // Load and process image
      const image = await this.loadImage(imagePath);
      const inputs = await this.processor(image);
      const outputs = await this.model.generate(inputs);

      return {
        text: outputs.text || '',
        processingTime: Date.now() - startTime,
        metadata: {
          confidence: outputs.confidence || 0,
          processedWith: 'Paligemma2',
          mode: this.mode,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error(`Error processing image: ${error}`);
      throw error;
    }
  };
  
  constructor(options: { mode?: Paligemma2IntegrationMode } = {}) {
    if (options.mode) {
      this.mode = options.mode;
    }
  }
  
  /**
   * Initialize the Paligemma 2 adapter
   */
  async initialize(mode: Paligemma2IntegrationMode = Paligemma2IntegrationMode.DIRECT): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    try {
      // Set cache directory
      process.env.TRANSFORMERS_CACHE = './models/paligemma2';

      // Load model and processor
      [this.model, this.processor] = await Promise.all([
        AutoModel.from_pretrained('Paligemma/paligemma2-3b-mix-224'),
        AutoProcessor.from_pretrained('Paligemma/paligemma2-3b-mix-224')
      ]);

      this.initialized = true;
      logger.info('Paligemma 2 model initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize Paligemma 2: ${error}`);
      return false;
    }
  }
  
  /**
   * Assist OCR process with Paligemma 2
   * 
   * @param imagePath Path to the document image
   * @param ocrResult Original OCR result
   * @param mode Integration mode
   * @returns Enhanced OCR result
   */
  async assistOCR(
    imagePath: string, 
    ocrResult: OCRResult,
    mode: Paligemma2IntegrationMode = Paligemma2IntegrationMode.DIRECT
  ): Promise<Paligemma2AssistResult> {
    // Ensure adapter is initialized
    if (!this.initialized) {
      await this.initialize(mode);
    }
    
    // Check if file exists (server-side only)
    if (typeof window === 'undefined' && fsModule && !fsModule.existsSync(imagePath)) {
      throw new Error(`File not found: ${imagePath}`);
    }
    
    // Skip file check on client-side
    
    const startTime = Date.now();
    let enhancedText = ocrResult.text;
    let confidenceAssessment = {
      overall: ocrResult.confidence / 100 || 0.7,
      regions: [],
      potentialErrors: []
    };
    
    try {
      // Step 1: Assess confidence using the confidence assessment prompt
      const confidenceResponse = await this.adapter.processWithPrompt(
        imagePath,
        PromptCategory.CONFIDENCE_ASSESSMENT,
        {
          ocrText: ocrResult.text,
          taskDescription: 'Provide a detailed confidence assessment for the OCR result, focusing on identifying potential errors and problematic regions.'
        }
      );
      
      if (confidenceResponse.success && confidenceResponse.result) {
        confidenceAssessment = confidenceResponse.result.assessment || confidenceAssessment;
      }
      
      // Step 2: Enhance OCR text using the result enhancement prompt
      const enhancementResponse = await this.adapter.processWithPrompt(
        imagePath,
        PromptCategory.RESULT_ENHANCEMENT,
        {
          ocrText: ocrResult.text,
          taskDescription: 'Enhance the OCR result by fixing character recognition errors, restoring missing text, and correcting layout issues while preserving the original format.'
        }
      );
      
      if (enhancementResponse.success && enhancementResponse.result) {
        enhancedText = enhancementResponse.result.enhancedText || ocrResult.text;
      }
      
      // Step 3: If in adaptive or enhance mode, perform semantic validation
      let semanticValidation = null;
      if (mode !== Paligemma2IntegrationMode.ASSIST) {
        const validationResponse = await this.adapter.processWithPrompt(
          imagePath,
          PromptCategory.SEMANTIC_VALIDATION,
          {
            ocrText: enhancedText,
            taskDescription: 'Validate the semantic consistency of the enhanced OCR result, focusing on dates, amounts, calculations, identifiers, and domain-specific terminology.'
          }
        );
        
        if (validationResponse.success && validationResponse.result) {
          semanticValidation = validationResponse.result;
          
          // Apply further corrections based on semantic validation
          if (!semanticValidation.isConsistent && semanticValidation.suggestions?.length > 0) {
            for (const suggestion of semanticValidation.suggestions) {
              if (suggestion.confidence > 0.8) {
                enhancedText = enhancedText.replace(suggestion.original, suggestion.suggested);
              }
            }
          }
        }
      }
      
      // Calculate improvement metrics
      const confidenceImprovement = confidenceAssessment.overall - (ocrResult.confidence / 100 || 0.7);
      const errorsCorrected = confidenceAssessment.potentialErrors?.length || 0;
      
      // Simple text similarity measure (this is a basic implementation)
      const textSimilarity = calculateTextSimilarity(ocrResult.text, enhancedText);
      
      const processingTimeMs = Date.now() - startTime;
      
      return {
        originalResult: ocrResult,
        enhancedText,
        confidenceAssessment,
        processingTimeMs,
        integrationMode: mode,
        improved: confidenceImprovement > 0 || errorsCorrected > 0,
        improvementMetrics: {
          confidenceImprovement,
          errorsCorrected,
          textSimilarity
        }
      };
    } catch (error) {
      logger.error(`Paligemma2 OCR Integration: Assistance failed: ${error}`);
      
      // Return a basic result with the original text and minimal processing
      return {
        originalResult: ocrResult,
        enhancedText: ocrResult.text,
        confidenceAssessment,
        processingTimeMs: Date.now() - startTime,
        integrationMode: mode,
        improved: false,
        improvementMetrics: {
          confidenceImprovement: 0,
          errorsCorrected: 0,
          textSimilarity: 1.0
        }
      };
    }
  }
  
  /**
   * Get preprocessing recommendations for a document
   * 
   * @param imagePath Path to the document image
   * @returns Preprocessing recommendations
   */
  async getPreprocessingRecommendations(imagePath: string): Promise<any> {
    // Ensure adapter is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const response = await this.adapter.processWithPrompt(
        imagePath,
        PromptCategory.PREPROCESSING_RECOMMENDATION,
        {
          taskDescription: 'Identify preprocessing steps that would improve OCR accuracy for this document, including deskew, denoise, contrast enhancement, binarization, resolution improvement, cropping, and shadow removal.'
        }
      );
      
      return response.success ? response.result : null;
    } catch (error) {
      logger.error(`Paligemma2 OCR Integration: Failed to get preprocessing recommendations: ${error}`);
      return null;
    }
  }
  
  /**
   * Get engine recommendations for a document
   * 
   * @param imagePath Path to the document image
   * @returns Engine recommendations
   */
  async getEngineRecommendations(imagePath: string): Promise<any> {
    // Ensure adapter is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const response = await this.adapter.processWithPrompt(
        imagePath,
        PromptCategory.ENGINE_RECOMMENDATION,
        {
          taskDescription: 'Determine the best OCR engine to process this document for maximum accuracy, considering content type, layout complexity, image quality, text density, and special elements.'
        }
      );
      
      return response.success ? response.result : null;
    } catch (error) {
      logger.error(`Paligemma2 OCR Integration: Failed to get engine recommendations: ${error}`);
      return null;
    }
  }
  
  /**
   * Enhance confidence data with Paligemma 2
   * 
   * @param imagePath Path to the document image
   * @param confidenceData Original confidence data
   * @returns Enhanced confidence data
   */
  async enhanceConfidenceData(imagePath: string, confidenceData: any): Promise<any> {
    // Ensure adapter is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Get full OCR text from confidence data
      const fullText = confidenceData.pageConfidences
        ? confidenceData.pageConfidences.map(page => page.text || '').join('\n\n')
        : confidenceData.text || '';
      
      const response = await this.adapter.processWithPrompt(
        imagePath,
        PromptCategory.CONFIDENCE_ASSESSMENT,
        {
          ocrText: fullText,
          taskDescription: 'Provide a detailed confidence assessment for the OCR result, focusing on identifying potential errors and problematic regions.'
        }
      );
      
      if (!response.success || !response.result) {
        return confidenceData;
      }
      
      const assessment = response.result.assessment;
      
      // Enhance confidence data with Paligemma 2 assessment
      return {
        ...confidenceData,
        // Update average confidence with Paligemma 2 assessment
        averageConfidence: Math.min(
          100,
          Math.max(0, Math.round((confidenceData.averageConfidence + assessment.overall * 100) / 2))
        ),
        // Add Paligemma 2 metadata
        metadata: {
          ...confidenceData.metadata,
          paligemma2Enhanced: true,
          paligemma2Confidence: assessment.overall,
          potentialErrorCount: assessment.potentialErrors?.length || 0
        }
      };
    } catch (error) {
      logger.error(`Paligemma2 OCR Integration: Failed to enhance confidence data: ${error}`);
      return confidenceData;
    }
  }
  
  /**
   * Process handwritten text with Paligemma 2
   * 
   * @param imagePath Path to the document image
   * @returns Handwritten text recognition result
   */
  async processHandwrittenText(imagePath: string): Promise<any> {
    // Ensure adapter is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const response = await this.adapter.processWithPrompt(
        imagePath,
        PromptCategory.HANDWRITING_RECOGNITION,
        {
          taskDescription: 'Recognize and transcribe handwritten text from this document image, considering different handwriting styles, quality issues, and contextual clues.'
        }
      );
      
      return response.success ? response.result : null;
    } catch (error) {
      logger.error(`Paligemma2 OCR Integration: Failed to process handwritten text: ${error}`);
      return null;
    }
  }
  
  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.model = null;
    this.processor = null;
    this.initialized = false;
  }
  
  /**
   * Process image with specified options
   * 
   * @param params Processing parameters
   * @returns Processing result
   */
  async process(params: ProcessOptions): Promise<TextExtractionResponse> {
    const { imagePath, options = {} } = params;
    const mode = options.mode || this.mode;

    try {
      switch (mode) {
        case Paligemma2IntegrationMode.DIRECT:
          return await this.processDirectMode(imagePath, options);
          
        case Paligemma2IntegrationMode.ASSIST:
          return await this.processAssistMode(imagePath, options);
          
        case Paligemma2IntegrationMode.ENHANCE:
          return await this.processEnhanceMode(imagePath, options);
          
        case Paligemma2IntegrationMode.ADAPTIVE:
          return await this.processAdaptiveMode(imagePath, options);
          
        default:
          throw new Error(`Unsupported mode: ${mode}`);
      }
    } catch (error) {
      this.logger.error(`Error processing in ${mode} mode:`, error);
      throw new VLMError('ProcessingError', `Failed to process image in ${mode} mode`, error);
    }
  }

  private async processDirectMode(imagePath: string, options: any): Promise<TextExtractionResponse> {
    this.logger.info('Processing in DIRECT mode');
    const preprocessed = await this.preprocessImage(imagePath, options.documentType);
    const result = await this.processImage(preprocessed, this.getDirectModePrompt(options));
    return {
      text: result.text,
      confidence: result.metadata?.confidence || 0.8,
      processingTime: result.processingTime,
      metadata: result.metadata
    };
  }

  private async processAssistMode(imagePath: string, options: any): Promise<TextExtractionResponse> {
    this.logger.info('Processing in ASSIST mode');
    // Analyze document to guide OCR engine selection
    const analysis = await this.analyzeDocument(imagePath);
    
    // Generate preprocessing recommendations
    const enhancedImage = await this.preprocessImage(imagePath, analysis.documentType);
    
    return {
      text: '',  // Will be filled by OCR engine
      confidence: 0,
      processingTime: 0,
      metadata: {
        analysis,
        recommendations: {
          preprocessing: analysis.recommendations,
          engineSelection: this.getEngineRecommendations(analysis)
        }
      }
    };
  }

  private async processEnhanceMode(imagePath: string, options: any): Promise<TextExtractionResponse> {
    this.logger.info('Processing in ENHANCE mode');
    const { originalText } = options;
    
    if (!originalText) {
      throw new VLMError('ValidationError', 'Original text is required for ENHANCE mode');
    }

    const result = await this.processImage(
      imagePath,
      this.getEnhancementPrompt(originalText, options)
    );

    return {
      text: result.text,
      confidence: result.metadata?.confidence || 0.8,
      processingTime: result.processingTime,
      metadata: {
        enhancement: {
          originalText,
          changes: this.detectTextChanges(originalText, result.text)
        }
      }
    };
  }

  private async processAdaptiveMode(imagePath: string, options: any): Promise<TextExtractionResponse> {
    this.logger.info('Processing in ADAPTIVE mode');
    
    // First analyze the document
    const analysis = await this.analyzeDocument(imagePath);
    
    // Choose the best mode based on analysis
    const bestMode = this.determineBestMode(analysis);
    this.logger.info(`Adaptive mode selected: ${bestMode}`);
    
    // Process with the selected mode
    return await this.process({
      imagePath,
      options: { ...options, mode: bestMode }
    });
  }

  private determineBestMode(analysis: DocumentAnalysis): Paligemma2IntegrationMode {
    if (analysis.confidence.overall < 0.5) {
      return Paligemma2IntegrationMode.ENHANCE;
    }
    
    if (analysis.hasHandwriting || analysis.complexLayout) {
      return Paligemma2IntegrationMode.DIRECT;
    }
    
    return Paligemma2IntegrationMode.ASSIST;
  }

  private getEngineRecommendations(analysis: DocumentAnalysis): any {
    return {
      primaryEngine: this.selectPrimaryEngine(analysis),
      fallbackEngine: this.selectFallbackEngine(analysis),
      confidence: analysis.confidence.overall
    };
  }

  private selectPrimaryEngine(analysis: DocumentAnalysis): string {
    if (analysis.hasHandwriting && analysis.confidence.handwriting > 0.7) {
      return 'paligemma2';
    }
    return 'tesseract';
  }

  private selectFallbackEngine(analysis: DocumentAnalysis): string {
    return this.selectPrimaryEngine(analysis) === 'paligemma2' ? 'tesseract' : 'paligemma2';
  }

  private detectTextChanges(original: string, enhanced: string): any {
    return {
      charactersChanged: this.countDifferentCharacters(original, enhanced),
      confidenceImprovement: this.calculateConfidenceImprovement(original, enhanced)
    };
  }

  // Helper methods for text comparison and confidence calculation
  private countDifferentCharacters(str1: string, str2: string): number {
    let diff = 0;
    const len = Math.max(str1.length, str2.length);
    for (let i = 0; i < len; i++) {
      if (str1[i] !== str2[i]) diff++;
    }
    return diff;
  }

  private calculateConfidenceImprovement(original: string, enhanced: string): number {
    const diff = this.countDifferentCharacters(original, enhanced);
    return Math.max(0, 1 - (diff / Math.max(original.length, enhanced.length)));
  }
}

/**
 * Calculate text similarity between two strings
 * This is a simple implementation that could be improved
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) {
    return 0;
  }
  
  if (text1 === text2) {
    return 1;
  }
  
  // Simple character-based similarity
  const longer = text1.length > text2.length ? text1 : text2;
  const shorter = text1.length > text2.length ? text2 : text1;
  
  // Count matching characters
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) {
      matches++;
    }
  }
  
  return matches / longer.length;
}

// Export singleton instance
export const paligemma2Integration = new Paligemma2OCRIntegration();
export default paligemma2Integration;

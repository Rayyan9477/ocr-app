/**
 * Paligemma 2 OCR Integration
 * 
 * Integrates the Paligemma 2 VLM into the OCR system to enhance recognition
 * accuracy and precision without replacing the existing functionality.
 */

import { AutoModel, AutoProcessor } from '@xenova/transformers';
import { PromptCategory } from './vlm/models/paligemma2-prompts';
import { OCRResult, OCREngine } from './multi-engine-ocr';
import logger from './logger.mjs';
import { VLMOptions } from './paligemma2-service';
import { PaliGemma2Client } from './vlm/models/paligemma2-client';
// Using local DocumentAnalysis interface to avoid import conflict

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

interface ProcessOptions {
  documentType?: string;
  enhanceResolution?: boolean;
  preserveLayout?: boolean;
  mode?: Paligemma2IntegrationMode;
  isFallback?: boolean;
  additionalInstructions?: string;
  [key: string]: any;
}

interface TextExtractionResponse {
  text: string;
  confidence: number;
  metadata: {
    processingTime: number;
    model: string;
    [key: string]: any;
  };
}

interface DocumentAnalysis {
  isHandwritten: boolean;
  hasTables: boolean;
  isPoorQuality: boolean;
  isComplexLayout: boolean;
  confidence: number;
  metadata: {
    processingTime: number;
    model: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export class Paligemma2OCRIntegration implements OCREngine {
  name = 'paligemma2';
  service: any = this; // Reference to self for compatibility
  available = true;
  specialization: string[] = ['handwritten', 'document', 'general'];
  confidence = true; // Indicates this engine provides confidence scores
  
  private initialized = false;
  public mode: Paligemma2IntegrationMode = Paligemma2IntegrationMode.ADAPTIVE;
  private adapter: PaliGemma2Client | null = null;
  private model: any = null;
  private processor: any = null;
  private analysis: any; // Will be properly typed later
  private logger = logger; // Simple console logger
  
  constructor(options: { mode?: Paligemma2IntegrationMode } = {}) {
    if (options.mode) {
      this.mode = options.mode;
    }
  }
  
  // Required by OCREngine interface
  preprocessor = async (inputPath: string, documentType?: string): Promise<string> => {
    // Use the existing preprocessing logic from the class
    return this.preprocessImage(inputPath, documentType);
  };
  
  // Add process method required by OCREngine
  // Image processing methods
  private async loadImage(imagePath: string): Promise<{ path: string }> {
    // Implementation depends on your image loading library
    // This is a placeholder - replace with actual implementation
    return { path: imagePath };
  }
  
  private async preprocessImage(inputPath: string, documentType?: string): Promise<string> {
    // Simple implementation - just return the input path for now
    // In a real implementation, you might want to do actual image preprocessing
    return inputPath;
  }
  
  private async processImage(imagePath: string, prompt: string, options: ProcessOptions = {}): Promise<TextExtractionResponse> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      if (!this.model || !this.processor) {
        throw new Error('Model or processor not initialized');
      }
      const startTime = Date.now();
      const image = await this.loadImage(imagePath);
      const inputs = await this.processor(image, prompt);
      const { output } = await this.model.generate(inputs);
      const text = this.processor.decode(output[0], { skip_special_tokens: true });
      
      return {
        text,
        confidence: this.calculateConfidence(text, options),
        metadata: {
          processingTime: Date.now() - startTime,
          model: 'paligemma2',
          ...options
        }
      };
    } catch (error: any) {
      console.error(`Error processing image: ${error}`);
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }
  
  private async processPage(page: { path: string; metadata: any }): Promise<{text: string; confidence: number; metadata: any}> {
    if (!page) {
      throw new Error('Page object is required');
    }
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      const result = await this.processImage(page.path, 'Extract all text from this document page.');
      return {
        text: result.text,
        confidence: result.confidence,
        metadata: {
          ...result.metadata,
          ...page.metadata,
          processingTime: result.metadata.processingTime
        }
      };
    } catch (error: any) {
      console.error(`Error processing page: ${error}`);
      throw new Error(`Page processing failed: ${error.message}`);
    }
  }
  
  private calculateConfidence(text: string, metadata: any = {}): number {
    if (!text || text.trim().length === 0) return 0;
    
    let confidence = 0.8;
    const hasPunctuation = /[.,!?]/.test(text);
    const hasNumbers = /\d/.test(text);
    const hasLetters = /[a-zA-Z]/.test(text);
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;
    const avgWordLength = wordCount > 0 
      ? words.reduce((sum: number, word: string) => sum + word.length, 0) / wordCount 
      : 0;
    
    // Adjust confidence based on text characteristics
    if (wordCount > 10) confidence += 0.1;
    if (hasPunctuation) confidence += 0.05;
    if (hasNumbers && hasLetters) confidence += 0.05;
    if (avgWordLength > 3 && avgWordLength < 10) confidence += 0.02;
    
    // Apply metadata confidence if available
    if (metadata?.confidence) {
      confidence = (confidence + Number(metadata.confidence)) / 2;
    }
    
    // Ensure confidence is within bounds
    return Math.min(Math.max(confidence, 0), 1);
  }
  
  /**
   * Process an image file and extract text using Paligemma 2
   * @param inputPath Path to the input image file
   * @param options Processing options
   * @returns OCR result with extracted text and metadata
   */
  async process(inputPath: string, options: ProcessOptions = {}): Promise<OCRResult> {
    const {
      documentType = 'general',
      enhanceResolution = true,
      preserveLayout = true,
      confidenceThreshold = 0.7,
      mode = this.mode,
      ...otherOptions
    } = options;

    try {
      // Generate context-aware prompt based on document type
      const prompt = this.generatePrompt(documentType, options);
      
      // Process the document
      const result = await this.processImage(inputPath, prompt, {
        documentType,
        enhanceResolution,
        preserveLayout,
        ...otherOptions
      });

      // Post-process the result
      const processedText = this.postProcessText(result.text, documentType);
      
      // Calculate confidence based on result quality
      const confidence = this.calculateConfidence(processedText, result.metadata);
      
      // If confidence is below threshold, try fallback mode
      if (confidence < confidenceThreshold && mode === Paligemma2IntegrationMode.ADAPTIVE) {
        this.logger.warn(`Low confidence (${confidence.toFixed(2)}) for ${documentType} document, trying fallback mode`);
        return this.process(inputPath, {
          ...options,
          mode: Paligemma2IntegrationMode.ASSIST,
          isFallback: true
        });
      }

      return {
        text: processedText,
        confidence,
        engine: this.name,
        processingTime: result.metadata.processingTime,
        metadata: {
          ...result.metadata,
          engine: this.name,
          documentType,
          mode,
          confidence,
          isFallback: options.isFallback || false
        }
      };
    } catch (error: any) {
      this.logger.error(`Error in Paligemma2 OCR processing: ${error.message}`);
      
      // If not already in fallback mode, try fallback
      if (options.mode !== Paligemma2IntegrationMode.ASSIST && !options.isFallback) {
        this.logger.info('Trying fallback mode after error');
        return this.process(inputPath, {
          ...options,
          mode: Paligemma2IntegrationMode.ASSIST,
          isFallback: true
        });
      }
      
      // If we're already in fallback mode or it's disabled, rethrow
      throw error;
    }
  }

  private generatePrompt(documentType: string = 'document', options: any = {}): string {
    const docType = documentType.toLowerCase();
    
    // Base prompt with document type
    let prompt = `Extract all text from this ${docType} document with high accuracy. `;
    
    // Add document-type specific instructions
    const typeSpecificPrompts: Record<string, string> = {
      'handwritten': 'Pay special attention to handwritten text and ensure accurate transcription. ' +
                   'Be careful with similar-looking characters and maintain the original case. ',
      'table': 'Extract all tabular data while preserving the table structure. ' +
              'Maintain row and column alignment. ',
      'medical': 'Extract all medical terms and values accurately. ' +
                'Pay attention to units of measurement and maintain precision. ',
      'form': 'Extract all form fields and their values. ' +
             'Clearly indicate field labels and corresponding values. ',
      'receipt': 'Extract all receipt details including vendor, date, items, prices, and totals. ' +
                'Ensure accurate extraction of numerical values. ',
      'invoice': 'Extract all invoice details including vendor, customer, dates, line items, ' +
                'quantities, prices, and totals. Ensure accurate extraction of numerical values. ',
      'id': 'Extract all text from this ID document accurately. Pay special attention to ' +
            'names, ID numbers, dates, and other personal information. ',
      'general': 'Extract all text while preserving the original formatting and structure. ' +
                'Maintain line breaks and paragraphs as they appear in the document. '
    };
    
    // Add document type specific prompt if available
    prompt += typeSpecificPrompts[docType] || typeSpecificPrompts.general;
    
    // Add layout preservation if needed
    if (options.preserveLayout) {
      prompt += 'Preserve the original document layout and structure. ';
    }
    
    // Add quality considerations
    if (options.enhanceResolution) {
      prompt += 'The document may be of poor quality, so take extra care with character recognition. ';
    }
    
    // Add any custom instructions
    if (options.additionalInstructions) {
      prompt += options.additionalInstructions;
    }
    
    return prompt;
  }
  
  /**
   * Post-process the extracted text based on document type
   * @param text Extracted text
   * @param documentType Type of document being processed
   * @returns Processed text
   */
  private postProcessText(text: string, documentType: string = 'general'): string {
    if (!text) return '';
    
    // Common text cleaning
    let processedText = text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    // Document type specific processing
    if (documentType) {
      const docType = documentType.toLowerCase();
      
      switch (docType) {
        case 'handwritten':
          // Improve spacing for handwritten text
          processedText = processedText.replace(/([.,!?])([^\s])/g, '$1 $2');
          break;
          
        case 'table':
          // Ensure consistent column alignment
          processedText = processedText.replace(/\s{2,}/g, '\t');
          break;
          
        case 'medical':
          // Ensure proper spacing around units and numbers
          processedText = processedText
            .replace(/(\d)([a-zA-Z])/g, '$1 $2')
            .replace(/([a-zA-Z])(\d)/g, '$1 $2');
          break;
          
        case 'form':
        case 'receipt':
        case 'invoice':
          // Standardize common patterns
          processedText = processedText
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // Add space between words in camelCase
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between words in PascalCase
            .replace(/:\s*/g, ': '); // Add form-specific processing
          break;
      }
    }
    
    return processedText;
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
        AutoModel.from_pretrained('google/paligemma-2b-vit-bf16'),
        AutoProcessor.from_pretrained('google/paligemma-2b-vit-bf16')
      ]);

      this.initialized = true;
      this.logger.info('Paligemma2 OCR integration initialized');
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
   * Process document with specified options
   * 
   * @param inputPath Path to the input document
   * @param options Processing options
   * @returns Processing result
   */
  async processDocument(inputPath: string, options: ProcessOptions = {}): Promise<OCRResult> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      const startTime = Date.now();
      const documentType = options.documentType || 'document';
      const prompt = this.generatePrompt(documentType, options);
      const result = await this.processImage(inputPath, prompt, options);
      
      // Post-process the result
      const processedText = this.postProcessText(result.text, documentType);
      
      return {
        text: processedText,
        confidence: result.confidence,
        engine: this.name,
        processingTime: Date.now() - startTime,
        metadata: {
          ...result.metadata,
          engine: this.name,
          documentType,
          mode: this.mode,
          isFallback: options.isFallback || false
        }
      };
    } catch (error: any) {
      this.logger.error(`Error in processDocument: ${error.message}`);
      throw error;
    }
  }

  private async analyzeDocument(imagePath: string): Promise<DocumentAnalysis> {
    try {
      // This is a simplified implementation - in a real app, you'd analyze the image
      const analysis: DocumentAnalysis = {
        isHandwritten: false,
        hasTables: false,
        isPoorQuality: false,
        isComplexLayout: false,
        confidence: 0.8,
        metadata: {
          processingTime: 0,
          model: 'paligemma2',
          recommendations: []
        }
      };

      // Add some basic analysis based on file name (simplified)
      if (imagePath.toLowerCase().includes('handwritten')) {
        analysis.isHandwritten = true;
        analysis.confidence = 0.6;
      }
      
      if (imagePath.toLowerCase().includes('table')) {
        analysis.hasTables = true;
        analysis.isComplexLayout = true;
      }

      return analysis;
    } catch (error: any) {
      this.logger.error(`Error analyzing document: ${error.message}`);
      // Return a default analysis on error
      return {
        isHandwritten: false,
        hasTables: false,
        isPoorQuality: false,
        isComplexLayout: false,
        confidence: 0.5,
        metadata: {
          processingTime: 0,
          model: 'paligemma2',
          error: error.message
        },
        recommendations: []
      };
    }
  }

  private getDirectModePrompt(options: any = {}): string {
    const docType = options.documentType || 'document';
    let prompt = `Extract all text from this ${docType} with high accuracy. `;
    
    if (docType === 'handwritten') {
      prompt += 'The text is handwritten - take extra care with character recognition. ';
    } else if (docType === 'form') {
      prompt += 'Extract all fields and their values. ';
    } else if (docType === 'receipt' || docType === 'invoice') {
      prompt += 'Extract all items, quantities, prices, and totals. ';
    }
    
    if (options.preserveLayout) {
      prompt += 'Preserve the original layout and formatting. ';
    }
    
    return prompt;
  }

  private async processDirectMode(imagePath: string, options: ProcessOptions = {}): Promise<TextExtractionResponse> {
    this.logger.info('Processing in DIRECT mode');
    try {
      const prompt = this.getDirectModePrompt(options);
      const result = await this.processImage(imagePath, prompt, options);
      
      // Post-process the result
      if (result.text) {
        result.text = this.postProcessText(result.text, options.documentType);
      }
      
      return result;
    } catch (error: any) {
      this.logger.error(`Error in processDirectMode: ${error.message}`);
      throw new Error(`Direct mode processing failed: ${error.message}`);
    }
  }

  private async processAssistMode(imagePath: string, options: ProcessOptions = {}): Promise<TextExtractionResponse> {
    this.logger.info('Processing in ASSIST mode');
    try {
      // First try direct mode
      const directResult = await this.processDirectMode(imagePath, options);
      
      // If confidence is high, return the result
      if (directResult.confidence > 0.85) {
        return directResult;
      }
      
      // Otherwise, try enhance mode with the direct result
      if (directResult.text) {
        return this.processEnhanceMode(imagePath, { 
          ...options, 
          originalText: directResult.text 
        });
      }
      
      // Fallback to direct result if no text was extracted
      return directResult;
    } catch (error: any) {
      this.logger.error(`Error in processAssistMode: ${error.message}`);
      throw new Error(`Assist mode processing failed: ${error.message}`);
    }
  }

  private async processEnhanceMode(imagePath: string, options: ProcessOptions & { originalText?: string } = {}): Promise<TextExtractionResponse> {
    this.logger.info('Processing in ENHANCE mode');
    try {
      const { originalText, ...otherOptions } = options;
      
      if (!originalText) {
        this.logger.warn('No original text provided for enhancement, falling back to direct mode');
        return this.processDirectMode(imagePath, otherOptions);
      }
      
      const prompt = this.getEnhancementPrompt(originalText, otherOptions);
      const result = await this.processImage(imagePath, prompt, otherOptions);
      
      // Calculate confidence based on changes from original
      const changes = this.detectTextChanges(originalText, result.text);
      const changeRatio = changes.changes.length / (originalText.length || 1);
      
      // Adjust confidence based on changes (fewer changes might indicate better quality)
      const adjustedConfidence = Math.max(0, Math.min(1, result.confidence * (1 - changeRatio * 0.5)));
      
      return {
        ...result,
        confidence: adjustedConfidence,
        metadata: {
          ...result.metadata,
          enhancementChanges: changes.changes.length,
          originalConfidence: result.confidence,
          adjustedConfidence: adjustedConfidence,
          changeRatio: changeRatio
        }
      };
    } catch (error: any) {
      this.logger.error(`Error in processEnhanceMode: ${error.message}`);
      // Fall back to direct mode if enhancement fails
      return this.processDirectMode(imagePath, options);
    }
  }

  private getEnhancementPrompt(originalText: string, options: ProcessOptions = {}): string {
    const docType = options.documentType || 'document';
    let prompt = `The following text was extracted from a ${docType} using OCR. `;
    prompt += 'Please correct any recognition errors while preserving the original meaning and formatting.\n\n';
    prompt += `Original text: ${originalText}\n\n`;
    prompt += 'Corrected text:';
    
    return prompt;
  }

  private detectTextChanges(original: string, enhanced: string): { changes: Array<{ from: string, to: string }> } {
    const changes: Array<{ from: string, to: string }> = [];
    
    // Simple diff implementation - in a real app, you might want to use a proper diffing library
    const originalLines = original.split('\n');
    const enhancedLines = enhanced.split('\n');
    
    for (let i = 0; i < Math.max(originalLines.length, enhancedLines.length); i++) {
      const origLine = originalLines[i] || '';
      const enhLine = enhancedLines[i] || '';
      
      if (origLine !== enhLine) {
        changes.push({
          from: origLine,
          to: enhLine
        });
      }
    }
    
    return { changes };
  }
  
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

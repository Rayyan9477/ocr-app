/**
 * VLM OCR Enhancer
 * 
 * Enhances OCR results using Vision Language Model (VLM) capabilities
 * Provides post-processing, confidence assessment, and result validation.
 */

import logger from './logger';
import { VLMManager } from './vlm/core/vlm-manager';
import { VLMInterface } from './vlm/core/vlm-interface';
import { PromptCategory } from './vlm/models/paligemma2-prompts';
import { OCRResult } from './multi-engine-ocr';
import { DocumentConfidence } from './confidence-detector';
import { ExtendedPaliGemma2Adapter } from './extended-paligemma2-adapter';
import { paligemma2Integration, Paligemma2IntegrationMode } from './paligemma2-ocr-integration';

// Ensure VLM models are registered
import './vlm-bootstrap';

// Use dynamic imports for Node.js modules to ensure they're only loaded on the server
let fs: any = null;
let path: any = null;

// This will only be executed on the server side
if (typeof window === 'undefined') {
  // Using dynamic import for server-only modules with ES modules
  import('fs').then(module => { fs = module.default });
  import('path').then(module => { path = module.default });
}

/**
 * Enhanced OCR result with VLM confidence assessment
 */
export interface EnhancedOCRResult extends OCRResult {
  /**
   * VLM-enhanced text (corrected and improved)
   */
  enhancedText?: string;
  
  /**
   * Detailed confidence assessment
   */
  confidenceAssessment?: {
    /**
     * Overall confidence score
     */
    overall: number;
    
    /**
     * Confidence scores by region
     */
    regions: Array<{
      region: string;
      confidence: number;
      issues: string[];
    }>;
    
    /**
     * Potential errors detected
     */
    potentialErrors: Array<{
      detected: string;
      probable: string;
      confidence: number;
    }>;
  };
  
  /**
   * VLM processing time in milliseconds
   */
  vlmProcessingTimeMs?: number;
  
  /**
   * Whether VLM enhancement was applied
   */
  vlmEnhanced: boolean;
}

/**
 * Engine recommendation from VLM
 */
export interface EngineRecommendation {
  /**
   * Recommended OCR engine
   */
  recommendedEngine: string;
  
  /**
   * Confidence in recommendation
   */
  confidence: number;
  
  /**
   * Reasoning for recommendation
   */
  reasoning: string;
  
  /**
   * Document properties detected
   */
  documentProperties: {
    contentType: string;
    layoutComplexity: number;
    imageQuality: number;
    hasHandwriting: boolean;
    hasTables: boolean;
    hasComplexLayout: boolean;
    isPoorQuality: boolean;
  };
  
  /**
   * Alternative engine recommendation
   */
  alternativeEngine: string;
}

/**
 * Preprocessing recommendation from VLM
 */
export interface PreprocessingRecommendation {
  /**
   * Recommended preprocessing techniques
   */
  recommendations: Array<{
    technique: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
    expectedImprovement: number;
  }>;
  
  /**
   * Document issues detected
   */
  documentIssues: {
    skew: number;
    noise: number;
    poorContrast: number;
    shadows: boolean;
    lowResolution: boolean;
  };
  
  /**
   * Overall document quality
   */
  overallQuality: number;
}

/**
 * OCR Enhancer using Vision Language Model
 */
export class VlmOcrEnhancer {
  private vlmManager: VLMManager;
  private vlm: VLMInterface | null = null;
  private usePaligemma2Integration: boolean = true; // Use the new integration by default
  
  constructor() {
    // Initialize VLM manager with PaliGemma2 as default model
    this.vlmManager = new VLMManager({
      defaultModelId: 'paligemma2-3b-mix-224',
      defaultDeploymentStrategy: 'local',
      maxCachedInstances: 1 // Keep one instance in memory
    });
  }
  
  /**
   * Initialize the VLM
   */
  private async initializeVLM(): Promise<boolean> {
    try {
      if (!this.vlm) {
        // Use Extended PaliGemma2 Adapter directly instead of going through VLM Manager
        this.vlm = new ExtendedPaliGemma2Adapter();
        await this.vlm.initialize({
          deploymentStrategy: 'local',
          enableCache: true
        });
        
        logger.info('VLM OCR Enhancer: VLM initialized successfully');
        return true;
      }
      return this.vlm.isReady;
    } catch (error) {
      logger.warn(`VLM OCR Enhancer: Failed to initialize VLM: ${error}`);
      return false;
    }
  }
  
  /**
   * Enhance OCR result using VLM
   * 
   * @param imagePath Path to the original image
   * @param ocrResult OCR result to enhance
   * @returns Enhanced OCR result
   */
  async enhanceOCRResult(imagePath: string, ocrResult: OCRResult): Promise<EnhancedOCRResult> {
    try {
      // Check if file exists
      // Check if file exists (server-side only)
      if (typeof window === 'undefined' && fs && !fs.existsSync(imagePath)) {
        throw new Error(`File not found: ${imagePath}`);
      }
      
      // Skip file check on client-side
      
      // If using Paligemma 2 integration, delegate to it
      if (this.usePaligemma2Integration) {
        return this.enhanceWithPaligemma2(imagePath, ocrResult);
      }
      
      // Legacy implementation with direct VLM usage as fallback
      // Try to initialize VLM
      const vlmInitialized = await this.initializeVLM();
      
      if (!vlmInitialized || !this.vlm) {
        logger.warn('VLM OCR Enhancer: VLM not available, returning original result');
        return {
          ...ocrResult,
          vlmEnhanced: false
        };
      }
      
      // Start enhancement process
      const startTime = Date.now();
      
      // Enhance OCR text using the result enhancement prompt
      const enhancementResponse = await this.vlm.processWithPrompt(
        imagePath,
        PromptCategory.RESULT_ENHANCEMENT,
        {
          ocrText: ocrResult.text
        }
      );
      
      // Extract enhanced text from response
      const enhancedText = enhancementResponse.result?.enhancedText || ocrResult.text;
      
      // Assess confidence using the confidence assessment prompt
      const confidenceResponse = await this.vlm.processWithPrompt(
        imagePath,
        PromptCategory.CONFIDENCE_ASSESSMENT,
        {
          ocrText: ocrResult.text
        }
      );
      
      // Extract confidence assessment from response
      const confidenceAssessment = confidenceResponse.result?.assessment || {
        overall: ocrResult.confidence || 0.7,
        regions: [],
        potentialErrors: []
      };
      
      const processingTimeMs = Date.now() - startTime;
      logger.info(`VLM OCR Enhancer: Enhancement completed in ${processingTimeMs}ms`);
      
      // Return enhanced result
      return {
        ...ocrResult,
        text: enhancedText, // Replace with enhanced text
        confidence: confidenceAssessment.overall * 100, // Update confidence score
        enhancedText,
        confidenceAssessment,
        vlmProcessingTimeMs: processingTimeMs,
        vlmEnhanced: true,
        metadata: {
          ...ocrResult.metadata,
          vlmEnhanced: true,
          vlmProcessingTimeMs: processingTimeMs
        }
      };
    } catch (error) {
      logger.error(`VLM OCR Enhancer: Enhancement failed: ${error}`);
      // Return original result with vlmEnhanced flag set to false
      return {
        ...ocrResult,
        vlmEnhanced: false
      };
    }
  }
  
  /**
   * Enhance OCR result using Paligemma 2 integration
   * 
   * @param imagePath Path to the original image
   * @param ocrResult OCR result to enhance
   * @returns Enhanced OCR result
   */
  private async enhanceWithPaligemma2(imagePath: string, ocrResult: OCRResult): Promise<EnhancedOCRResult> {
    try {
      // Use the dedicated Paligemma 2 integration
      const assistResult = await paligemma2Integration.assistOCR(
        imagePath, 
        ocrResult, 
        Paligemma2IntegrationMode.ENHANCE
      );
      
      // Map the assist result to enhanced OCR result
      return {
        ...ocrResult,
        text: assistResult.enhancedText, // Replace with enhanced text
        confidence: assistResult.confidenceAssessment.overall * 100, // Update confidence score
        enhancedText: assistResult.enhancedText,
        confidenceAssessment: assistResult.confidenceAssessment,
        vlmProcessingTimeMs: assistResult.processingTimeMs,
        vlmEnhanced: assistResult.improved,
        metadata: {
          ...ocrResult.metadata,
          vlmEnhanced: assistResult.improved,
          vlmProcessingTimeMs: assistResult.processingTimeMs,
          paligemma2Mode: assistResult.integrationMode,
          improvementMetrics: assistResult.improvementMetrics
        }
      };
    } catch (error) {
      logger.error(`VLM OCR Enhancer: Paligemma 2 enhancement failed: ${error}`);
      // Fall back to legacy implementation
      this.usePaligemma2Integration = false;
      return this.enhanceOCRResult(imagePath, ocrResult);
    }
  }
  
  /**
   * Validate OCR result semantically using VLM
   * 
   * @param imagePath Path to the original image
   * @param ocrText OCR text to validate
   * @returns Validation result
   */
  async validateOCRResult(imagePath: string, ocrText: string): Promise<any> {
    try {
      // Try to initialize VLM
      const vlmInitialized = await this.initializeVLM();
      
      if (!vlmInitialized || !this.vlm) {
        logger.warn('VLM OCR Enhancer: VLM not available, skipping validation');
        return { isConsistent: true, semanticConfidence: 0.7 };
      }
      
      // Validate OCR result using the semantic validation prompt
      const validationResponse = await this.vlm.processWithPrompt(
        imagePath,
        PromptCategory.SEMANTIC_VALIDATION,
        {
          ocrText
        }
      );
      
      // Return validation result
      return validationResponse.result || { isConsistent: true, semanticConfidence: 0.7 };
    } catch (error) {
      logger.error(`VLM OCR Enhancer: Validation failed: ${error}`);
      // Return basic result
      return { isConsistent: true, semanticConfidence: 0.7 };
    }
  }
  
  /**
   * Get engine recommendation for a document
   * 
   * @param imagePath Path to the document image
   * @returns Engine recommendation
   */
  async getEngineRecommendation(imagePath: string): Promise<EngineRecommendation | null> {
    try {
      // If using Paligemma 2 integration, delegate to it
      if (this.usePaligemma2Integration) {
        return await paligemma2Integration.getEngineRecommendations(imagePath);
      }
      
      // Legacy implementation with direct VLM usage as fallback
      // Try to initialize VLM
      const vlmInitialized = await this.initializeVLM();
      
      if (!vlmInitialized || !this.vlm) {
        logger.warn('VLM OCR Enhancer: VLM not available, skipping engine recommendation');
        return null;
      }
      
      // Get engine recommendation using the engine recommendation prompt
      const recommendationResponse = await this.vlm.processWithPrompt(
        imagePath,
        PromptCategory.ENGINE_RECOMMENDATION,
        {}
      );
      
      // Return recommendation
      return recommendationResponse.result as EngineRecommendation || null;
    } catch (error) {
      logger.error(`VLM OCR Enhancer: Engine recommendation failed: ${error}`);
      return null;
    }
  }
  
  /**
   * Get preprocessing recommendation for a document
   * 
   * @param imagePath Path to the document image
   * @returns Preprocessing recommendation
   */
  async getPreprocessingRecommendation(imagePath: string): Promise<PreprocessingRecommendation | null> {
    try {
      // If using Paligemma 2 integration, delegate to it
      if (this.usePaligemma2Integration) {
        return await paligemma2Integration.getPreprocessingRecommendations(imagePath);
      }
      
      // Legacy implementation with direct VLM usage as fallback
      // Try to initialize VLM
      const vlmInitialized = await this.initializeVLM();
      
      if (!vlmInitialized || !this.vlm) {
        logger.warn('VLM OCR Enhancer: VLM not available, skipping preprocessing recommendation');
        return null;
      }
      
      // Get preprocessing recommendation using the preprocessing recommendation prompt
      const recommendationResponse = await this.vlm.processWithPrompt(
        imagePath,
        PromptCategory.PREPROCESSING_RECOMMENDATION,
        {}
      );
      
      // Return recommendation
      return recommendationResponse.result as PreprocessingRecommendation || null;
    } catch (error) {
      logger.error(`VLM OCR Enhancer: Preprocessing recommendation failed: ${error}`);
      return null;
    }
  }
  
  /**
   * Enhance confidence data with VLM assessment
   * 
   * @param imagePath Path to the original image
   * @param confidenceData Original confidence data
   * @returns Enhanced confidence data
   */
  async enhanceConfidenceData(
    imagePath: string,
    confidenceData: DocumentConfidence
  ): Promise<DocumentConfidence> {
    try {
      // If using Paligemma 2 integration, delegate to it
      if (this.usePaligemma2Integration) {
        return await paligemma2Integration.enhanceConfidenceData(imagePath, confidenceData);
      }
      
      // Legacy implementation with direct VLM usage as fallback
      // Try to initialize VLM
      const vlmInitialized = await this.initializeVLM();
      
      if (!vlmInitialized || !this.vlm) {
        logger.warn('VLM OCR Enhancer: VLM not available, returning original confidence data');
        return confidenceData;
      }
      
      // Get full OCR text from confidence data
      const fullText = confidenceData.pageConfidences
        .map(page => page.text || '')
        .join('\n\n');
      
      // Assess confidence using the confidence assessment prompt
      const confidenceResponse = await this.vlm.processWithPrompt(
        imagePath,
        PromptCategory.CONFIDENCE_ASSESSMENT,
        {
          ocrText: fullText
        }
      );
      
      // Extract confidence assessment
      const assessment = confidenceResponse.result?.assessment;
      
      if (!assessment) {
        return confidenceData;
      }
      
      // Enhance confidence data with VLM assessment
      const enhancedData: DocumentConfidence = {
        ...confidenceData,
        // Update average confidence with VLM assessment
        averageConfidence: Math.min(
          100,
          Math.max(0, Math.round((confidenceData.averageConfidence + assessment.overall * 100) / 2))
        ),
        // Add VLM metadata
        metadata: {
          ...confidenceData.metadata,
          vlmEnhanced: true,
          vlmConfidence: assessment.overall,
          potentialErrorCount: assessment.potentialErrors?.length || 0
        }
      };
      
      return enhancedData;
    } catch (error) {
      logger.error(`VLM OCR Enhancer: Confidence enhancement failed: ${error}`);
      return confidenceData;
    }
  }
  
  /**
   * Process handwritten text with VLM
   * 
   * @param imagePath Path to the document image
   * @returns Handwritten text recognition result
   */
  async processHandwrittenText(imagePath: string): Promise<any> {
    try {
      // If using Paligemma 2 integration, delegate to it
      if (this.usePaligemma2Integration) {
        return await paligemma2Integration.processHandwrittenText(imagePath);
      }
      
      // Legacy implementation with direct VLM usage as fallback
      // Try to initialize VLM
      const vlmInitialized = await this.initializeVLM();
      
      if (!vlmInitialized || !this.vlm) {
        logger.warn('VLM OCR Enhancer: VLM not available, skipping handwritten text recognition');
        return null;
      }
      
      // Process handwritten text using the handwriting recognition prompt
      const response = await this.vlm.processWithPrompt(
        imagePath,
        PromptCategory.HANDWRITING_RECOGNITION,
        {
          taskDescription: 'Recognize and transcribe handwritten text from this document image, considering different handwriting styles, quality issues, and contextual clues.'
        }
      );
      
      return response.success ? response.result : null;
    } catch (error) {
      logger.error(`VLM OCR Enhancer: Handwritten text recognition failed: ${error}`);
      return null;
    }
  }
}

// Export singleton instance
export const vlmOcrEnhancer = new VlmOcrEnhancer();

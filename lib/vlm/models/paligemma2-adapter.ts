/**
 * PaliGemma2 Model Adapter
 * 
 * Implementation of the VLM interface for the PaliGemma2 model
 */

import path from 'path';
import fs from 'fs/promises';
import { VLMInterface, VLMOptions } from '../core/vlm-interface';
import { VLMCapability } from '../core/vlm-capabilities';
import { 
  VLMResponse, 
  DocumentAnalysisResponse,
  TextExtractionResponse,
  StructuredDataResponse
} from '../core/vlm-response-types';
import { VlmError, VlmErrorType, createVlmError } from '../core/vlm-error-types';
import { paliGemma2Config } from '../config/model-configs';
import { getDeploymentConfig } from '../config/deployment-configs';
import { PaliGemma2Client } from './paligemma2-client';
import { PaliGemma2Parser } from './paligemma2-parser';
import { processImage } from '../utils/image-preprocessor';
import { buildPrompt } from '../utils/prompt-builder';
import logger from '../../logger';

/**
 * PaliGemma2-specific options
 */
export interface PaliGemma2Options extends VLMOptions {
  /**
   * Model ID to use with HuggingFace
   */
  modelId?: string;
  
  /**
   * Maximum output length
   */
  maxLength?: number;
  
  /**
   * Sampling temperature
   */
  temperature?: number;
  
  /**
   * Top-k sampling parameter
   */
  topK?: number;
  
  /**
   * Repetition penalty
   */
  repetitionPenalty?: number;
  
  /**
   * Number of beams for beam search
   */
  numBeams?: number;
  
  /**
   * Prompt template to use
   */
  promptTemplate?: string;
}

/**
 * PaliGemma2 adapter implementation
 */
export class PaliGemma2Adapter implements VLMInterface {
  readonly id: string = 'paligemma2-3b-mix-224';
  readonly name: string = 'PaliGemma2 3B Mix';
  readonly capabilities: VLMCapability[] = paliGemma2Config.capabilities;
  
  private client: PaliGemma2Client | null = null;
  private parser: PaliGemma2Parser | null = null;
  private options: PaliGemma2Options = {};
  private _isReady: boolean = false;
  private lastError?: VlmError;
  private deploymentConfig: any;
  
  get isReady(): boolean {
    return this._isReady && this.client !== null;
  }
  
  async initialize(options?: VLMOptions): Promise<boolean> {
    try {
      // Merge options with defaults
      this.options = {
        ...paliGemma2Config.options,
        ...options
      };
      
      // Get deployment configuration
      const deploymentStrategy = this.options.deploymentStrategy || 'local';
      this.deploymentConfig = getDeploymentConfig(deploymentStrategy as any);
      
      // Initialize client
      this.client = new PaliGemma2Client({
        modelId: this.options.modelId || paliGemma2Config.options.modelId,
        deploymentStrategy: deploymentStrategy as any,
        ...this.options
      });
      
      await this.client.initialize();
      
      // Initialize parser
      this.parser = new PaliGemma2Parser();
      
      this._isReady = true;
      logger.info(`PaliGemma2 model initialized with deployment strategy: ${deploymentStrategy}`);
      return true;
    } catch (error) {
      this.lastError = createVlmError(error, VlmErrorType.INIT_FAILED);
      logger.error(`Failed to initialize PaliGemma2 model: ${this.lastError.message}`);
      this._isReady = false;
      return false;
    }
  }
  
  async analyzeDocument(imagePath: string, options?: VLMOptions): Promise<DocumentAnalysisResponse> {
    this.checkReady();
    
    try {
      const startTime = Date.now();
      const mergedOptions = { ...this.options, ...options };
      
      // Preprocess image
      const processedImage = await processImage(imagePath, {
        width: 224,
        height: 224,
        ...mergedOptions.resolution
      });
      
      // Build prompt for document analysis
      const prompt = buildPrompt('document_analysis', {
        taskDescription: 'Analyze this document and provide detailed information about its type, quality, content, and layout.'
      });
      
      // Process with VLM - handle both file path and buffer
      let rawResponse;
      if (typeof processedImage === 'string') {
        // processedImage is a file path
        rawResponse = await this.client!.process(processedImage, prompt, mergedOptions);
      } else {
        // processedImage is a buffer, need to save it temporarily
        const fs = require('fs');
        const path = require('path');
        const tempPath = path.join(process.cwd(), 'uploads', `temp_${Date.now()}.jpg`);
        fs.writeFileSync(tempPath, processedImage);
        try {
          rawResponse = await this.client!.process(tempPath, prompt, mergedOptions);
        } finally {
          // Clean up temp file
          try {
            fs.unlinkSync(tempPath);
          } catch (cleanupError) {
            logger.warn(`Failed to cleanup temp file: ${cleanupError}`);
          }
        }
      }
      
      // Parse response
      const result = this.parser!.parseDocumentAnalysis(rawResponse);
      
      const processingTimeMs = Date.now() - startTime;
      
      return {
        success: true,
        confidence: result.confidence,
        processingTimeMs,
        timestamp: new Date().toISOString(),
        model: {
          id: this.id,
          name: this.name,
          version: paliGemma2Config.version
        },
        documentType: result.documentType,
        quality: result.quality,
        content: result.content,
        layout: result.layout,
        recommendations: result.recommendations,
        deployment: {
          type: mergedOptions.deploymentStrategy as any || 'local',
          provider: 'HuggingFace'
        }
      };
    } catch (error) {
      const vlmError = createVlmError(error, VlmErrorType.PROCESSING_FAILED);
      logger.error(`Document analysis error: ${vlmError.message}`);
      
      return {
        success: false,
        confidence: 0,
        processingTimeMs: 0,
        timestamp: new Date().toISOString(),
        model: {
          id: this.id,
          name: this.name,
          version: paliGemma2Config.version
        },
        error: {
          code: vlmError.code,
          message: vlmError.message,
          details: vlmError.details
        },
        documentType: 'unknown',
        quality: {
          overall: 0,
          resolution: 0,
          noise: 0,
          contrast: 0
        },
        content: {
          hasHandwriting: false,
          hasTables: false,
          hasHighlights: false,
          hasImages: false,
          hasSignatures: false
        }
      };
    }
  }
  
  async extractText(imagePath: string, options?: VLMOptions): Promise<TextExtractionResponse> {
    this.checkReady();
    
    try {
      const startTime = Date.now();
      const mergedOptions = { ...this.options, ...options };
      
      // Preprocess image
      const processedImage = await processImage(imagePath, {
        width: 224,
        height: 224,
        ...mergedOptions.resolution
      });
      
      // Build prompt for text extraction
      const prompt = buildPrompt('text_extraction', {
        taskDescription: 'Extract all text from this document, preserving layout where possible.'
      });
      
      // Process with VLM - handle both file path and buffer
      let rawResponse;
      if (typeof processedImage === 'string') {
        // processedImage is a file path
        rawResponse = await this.client!.process(processedImage, prompt, mergedOptions);
      } else {
        // processedImage is a buffer, need to save it temporarily
        const fs = require('fs');
        const path = require('path');
        const tempPath = path.join(process.cwd(), 'uploads', `temp_${Date.now()}.jpg`);
        fs.writeFileSync(tempPath, processedImage);
        try {
          rawResponse = await this.client!.process(tempPath, prompt, mergedOptions);
        } finally {
          // Clean up temp file
          try {
            fs.unlinkSync(tempPath);
          } catch (cleanupError) {
            logger.warn(`Failed to cleanup temp file: ${cleanupError}`);
          }
        }
      }
      
      // Parse response
      const result = this.parser!.parseTextExtraction(rawResponse);
      
      const processingTimeMs = Date.now() - startTime;
      
      return {
        success: true,
        confidence: result.confidence,
        processingTimeMs,
        timestamp: new Date().toISOString(),
        model: {
          id: this.id,
          name: this.name,
          version: paliGemma2Config.version
        },
        text: result.text,
        blocks: result.blocks,
        corrections: result.corrections,
        languages: result.languages,
        deployment: {
          type: mergedOptions.deploymentStrategy as any || 'local',
          provider: 'HuggingFace'
        }
      };
    } catch (error) {
      const vlmError = createVlmError(error, VlmErrorType.PROCESSING_FAILED);
      logger.error(`Text extraction error: ${vlmError.message}`);
      
      return {
        success: false,
        confidence: 0,
        processingTimeMs: 0,
        timestamp: new Date().toISOString(),
        model: {
          id: this.id,
          name: this.name,
          version: paliGemma2Config.version
        },
        error: {
          code: vlmError.code,
          message: vlmError.message,
          details: vlmError.details
        },
        text: ''
      };
    }
  }
  
  async extractStructuredData(imagePath: string, options?: VLMOptions): Promise<StructuredDataResponse> {
    this.checkReady();
    
    try {
      const startTime = Date.now();
      const mergedOptions = { ...this.options, ...options };
      
      // Preprocess image
      const processedImagePath = await processImage(imagePath, {
        width: 224,
        height: 224,
        ...mergedOptions.resolution
      });
      
      // Build prompt for structured data extraction
      const prompt = buildPrompt('structured_data_extraction', {
        taskDescription: 'Extract structured data from this document, including tables, forms, and key-value pairs.'
      });
      
      // Process with VLM
      const rawResponse = await this.client!.process(processedImagePath, prompt, mergedOptions);
      
      // Parse response
      const result = this.parser!.parseStructuredData(rawResponse);
      
      const processingTimeMs = Date.now() - startTime;
      
      return {
        success: true,
        confidence: result.confidence,
        processingTimeMs,
        timestamp: new Date().toISOString(),
        model: {
          id: this.id,
          name: this.name,
          version: paliGemma2Config.version
        },
        keyValuePairs: result.keyValuePairs,
        tables: result.tables,
        forms: result.forms,
        medicalEntities: result.medicalEntities,
        documentStructure: result.documentStructure,
        deployment: {
          type: mergedOptions.deploymentStrategy as any || 'local',
          provider: 'HuggingFace'
        }
      };
    } catch (error) {
      const vlmError = createVlmError(error, VlmErrorType.PROCESSING_FAILED);
      logger.error(`Structured data extraction error: ${vlmError.message}`);
      
      return {
        success: false,
        confidence: 0,
        processingTimeMs: 0,
        timestamp: new Date().toISOString(),
        model: {
          id: this.id,
          name: this.name,
          version: paliGemma2Config.version
        },
        error: {
          code: vlmError.code,
          message: vlmError.message,
          details: vlmError.details
        }
      };
    }
  }
  
  async processWithPrompt(imagePath: string, prompt: string, options?: VLMOptions): Promise<VLMResponse> {
    this.checkReady();
    
    try {
      const startTime = Date.now();
      const mergedOptions = { ...this.options, ...options };
      
      // Preprocess image
      const processedImagePath = await processImage(imagePath, {
        width: 224,
        height: 224,
        ...mergedOptions.resolution
      });
      
      // Process with VLM
      const rawResponse = await this.client!.process(processedImagePath, prompt, mergedOptions);
      
      const processingTimeMs = Date.now() - startTime;
      
      return {
        success: true,
        confidence: 1.0, // Custom prompts don't have confidence scoring
        processingTimeMs,
        timestamp: new Date().toISOString(),
        model: {
          id: this.id,
          name: this.name,
          version: paliGemma2Config.version
        },
        rawResponse,
        deployment: {
          type: mergedOptions.deploymentStrategy as any || 'local',
          provider: 'HuggingFace'
        }
      };
    } catch (error) {
      const vlmError = createVlmError(error, VlmErrorType.PROCESSING_FAILED);
      logger.error(`Custom prompt processing error: ${vlmError.message}`);
      
      return {
        success: false,
        confidence: 0,
        processingTimeMs: 0,
        timestamp: new Date().toISOString(),
        model: {
          id: this.id,
          name: this.name,
          version: paliGemma2Config.version
        },
        error: {
          code: vlmError.code,
          message: vlmError.message,
          details: vlmError.details
        }
      };
    }
  }
  
  async dispose(): Promise<void> {
    if (this.client) {
      await this.client.dispose();
      this.client = null;
    }
    
    this._isReady = false;
  }
  
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    details: Record<string, any>;
    lastError?: VlmError;
  }> {
    if (!this.isReady) {
      return {
        isHealthy: false,
        details: {
          status: 'not_initialized',
          message: 'Model is not initialized'
        },
        lastError: this.lastError || new VlmError(
          VlmErrorType.MODEL_NOT_INITIALIZED,
          'Model is not initialized',
          undefined,
          true,
          ['Initialize the model']
        )
      };
    }
    
    try {
      // Check if client is healthy
      const clientHealth = await this.client!.checkHealth();
      
      return {
        isHealthy: clientHealth.isHealthy,
        details: {
          status: clientHealth.isHealthy ? 'healthy' : 'unhealthy',
          message: clientHealth.message,
          memoryUsage: clientHealth.memoryUsage,
          modelInfo: {
            id: this.id,
            name: this.name,
            version: paliGemma2Config.version
          },
          deployment: {
            type: this.options.deploymentStrategy || 'local',
            provider: 'HuggingFace'
          },
          ...clientHealth.details
        },
        lastError: clientHealth.isHealthy ? undefined : new VlmError(
          VlmErrorType.PROCESSING_FAILED,
          clientHealth.message || 'Unknown health check failure',
          clientHealth.details,
          true
        )
      };
    } catch (error) {
      const vlmError = createVlmError(error, VlmErrorType.UNKNOWN_ERROR);
      
      return {
        isHealthy: false,
        details: {
          status: 'error',
          message: vlmError.message,
          error: vlmError.toJSON()
        },
        lastError: vlmError
      };
    }
  }
  
  /**
   * Check if the model is ready for processing
   */
  private checkReady(): void {
    if (!this.isReady) {
      throw new VlmError(
        VlmErrorType.MODEL_NOT_INITIALIZED,
        'PaliGemma2 model is not initialized',
        undefined,
        true,
        ['Initialize the model first']
      );
    }
  }
}

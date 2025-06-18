/**
 * PaliGemma2 Client
 * 
 * Client for interacting with the PaliGemma2 model
 * through different deployment strategies
 */

import { VlmError, VlmErrorType } from '../core/vlm-error-types';
import { HuggingFaceClient } from '../integrations/huggingface-client';
import { TransformersClient } from '../integrations/transformers-client';
import { ONNXClient } from '../integrations/onnx-client';
import { getDeploymentConfig } from '../config/deployment-configs';
import logger from '../../logger';

// Use dynamic imports for Node.js modules to ensure they're only loaded on the server
let fs: any = null;
let pathModule: any = null;

// This will only be executed on the server side
if (typeof window === 'undefined') {
  // Import fs synchronously for immediate use
  fs = require('fs');
  pathModule = require('path');
}

/**
 * PaliGemma2 client options
 */
export interface PaliGemma2ClientOptions {
  /**
   * Model ID to use with HuggingFace
   */
  modelId: string;
  
  /**
   * Deployment strategy
   */
  deploymentStrategy: 'local' | 'cloud' | 'hybrid';
  
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
  
  /**
   * API key for HuggingFace (cloud deployment)
   */
  apiKey?: string;
  
  /**
   * Timeout in milliseconds
   */
  timeoutMs?: number;
}

/**
 * Client for PaliGemma2 model processing
 */
export class PaliGemma2Client {
  private options: PaliGemma2ClientOptions;
  private deploymentConfig: any;
  private client: HuggingFaceClient | TransformersClient | ONNXClient | null = null;
  private initialized: boolean = false;
  
  constructor(options: PaliGemma2ClientOptions) {
    this.options = {
      ...{
        modelId: 'google/paligemma2-3b-mix-224',
        deploymentStrategy: 'local',
        maxLength: 1024,
        temperature: 0.0,
        topK: 50,
        repetitionPenalty: 1.0,
        numBeams: 1,
        promptTemplate: 'USER: {prompt}\nASSISTANT:',
        timeoutMs: 30000
      },
      ...options
    };
    
    this.deploymentConfig = getDeploymentConfig(this.options.deploymentStrategy);
  }
  
  /**
   * Initialize the client
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      switch (this.options.deploymentStrategy) {
        case 'local':
          await this.initializeLocalClient();
          break;
        case 'cloud':
          await this.initializeCloudClient();
          break;
        case 'hybrid':
          await this.initializeHybridClient();
          break;
        default:
          throw new VlmError(
            VlmErrorType.INVALID_INPUT,
            `Unsupported deployment strategy: ${this.options.deploymentStrategy}`,
            { deploymentStrategy: this.options.deploymentStrategy },
            false
          );
      }
      
      this.initialized = true;
      logger.info(`PaliGemma2 client initialized with strategy: ${this.options.deploymentStrategy}`);
    } catch (error) {
      if (error instanceof VlmError) {
        throw error;
      }
      
      throw new VlmError(
        VlmErrorType.INIT_FAILED,
        `Failed to initialize PaliGemma2 client: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error },
        true,
        ['Check model configuration', 'Verify API key if using cloud deployment']
      );
    }
  }
  
  /**
   * Process an image with the model
   */
  async process(imagePath: string, prompt: string, options: any = {}): Promise<any> {
    if (!this.initialized || !this.client) {
      throw new VlmError(
        VlmErrorType.MODEL_NOT_INITIALIZED,
        'PaliGemma2 client is not initialized',
        undefined,
        true,
        ['Initialize the client first']
      );
    }
    
    try {
      // Check if image exists
      try {
        if (fs) {
          fs.accessSync(imagePath);
        }
      } catch (error) {
        throw new VlmError(
          VlmErrorType.FILE_NOT_FOUND,
          `Image file not found: ${imagePath}`,
          { path: imagePath },
          false
        );
      }
      
      // Read image
      const imageBuffer = fs ? fs.readFileSync(imagePath) : Buffer.from([]);
      
      // Format prompt using template
      const formattedPrompt = this.formatPrompt(prompt);
      
      // Process with client
      const result = await this.client.process(imageBuffer, formattedPrompt, {
        maxLength: options.maxLength || this.options.maxLength,
        temperature: options.temperature || this.options.temperature,
        topK: options.topK || this.options.topK,
        repetitionPenalty: options.repetitionPenalty || this.options.repetitionPenalty,
        numBeams: options.numBeams || this.options.numBeams,
        timeoutMs: options.timeoutMs || this.options.timeoutMs
      });
      
      return result;
    } catch (error) {
      if (error instanceof VlmError) {
        throw error;
      }
      
      throw new VlmError(
        VlmErrorType.PROCESSING_FAILED,
        `Failed to process image with PaliGemma2: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error },
        false
      );
    }
  }
  
  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    if (this.client) {
      await this.client.dispose();
      this.client = null;
    }
    
    this.initialized = false;
  }
  
  /**
   * Check health of the client
   */
  async checkHealth(): Promise<{
    isHealthy: boolean;
    message?: string;
    details?: any;
    memoryUsage?: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  }> {
    if (!this.initialized || !this.client) {
      return {
        isHealthy: false,
        message: 'Client is not initialized'
      };
    }
    
    try {
      const clientHealth = await this.client.checkHealth();
      const memoryUsage = process.memoryUsage();
      
      return {
        isHealthy: clientHealth.isHealthy,
        message: clientHealth.message,
        details: clientHealth.details,
        memoryUsage: {
          rss: Math.round(memoryUsage.rss / (1024 * 1024)), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / (1024 * 1024)), // MB
          heapUsed: Math.round(memoryUsage.heapUsed / (1024 * 1024)), // MB
          external: Math.round(memoryUsage.external / (1024 * 1024)) // MB
        }
      };
    } catch (error) {
      return {
        isHealthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        details: { error }
      };
    }
  }
  
  /**
   * Initialize local client (Transformers.js or ONNX)
   */
  private async initializeLocalClient(): Promise<void> {
    const useONNX = this.deploymentConfig.config.preferONNX;
    
    if (useONNX) {
      this.client = new ONNXClient({
        modelId: this.options.modelId,
        optimizationLevel: this.deploymentConfig.config.onnxOptimizationLevel
      });
    } else {
      this.client = new TransformersClient({
        modelId: this.options.modelId,
        preferGPU: this.deploymentConfig.config.preferGPU,
        fallbackToCPU: this.deploymentConfig.config.fallbackToCPU
      });
    }
    
    await this.client.initialize();
  }
  
  /**
   * Initialize cloud client (HuggingFace Inference API)
   */
  private async initializeCloudClient(): Promise<void> {
    const apiKey = this.options.apiKey || process.env.HUGGINGFACE_API_KEY;
    
    if (!apiKey) {
      throw new VlmError(
        VlmErrorType.AUTHENTICATION_FAILED,
        'HuggingFace API key is required for cloud deployment',
        undefined,
        true,
        ['Set HUGGINGFACE_API_KEY environment variable', 'Provide apiKey in options']
      );
    }
    
    this.client = new HuggingFaceClient({
      modelId: this.options.modelId,
      apiKey,
      apiEndpoint: this.deploymentConfig.config.apiEndpoint,
      maxRetries: this.deploymentConfig.config.retryStrategy.maxRetries,
      retryDelayMs: this.deploymentConfig.config.retryStrategy.retryDelayMs
    });
    
    await this.client.initialize();
  }
  
  /**
   * Initialize hybrid client (switches between local and cloud)
   */
  private async initializeHybridClient(): Promise<void> {
    // Initialize both clients for hybrid mode
    const hybridConfig = this.deploymentConfig.config;
    
    // Prefer local by default
    if (hybridConfig.switchingStrategy.preferLocal) {
      try {
        await this.initializeLocalClient();
      } catch (error) {
        logger.warn(`Failed to initialize local client, falling back to cloud: ${error instanceof Error ? error.message : String(error)}`);
        await this.initializeCloudClient();
      }
    } else {
      try {
        await this.initializeCloudClient();
      } catch (error) {
        logger.warn(`Failed to initialize cloud client, falling back to local: ${error instanceof Error ? error.message : String(error)}`);
        await this.initializeLocalClient();
      }
    }
  }
  
  /**
   * Format prompt using template
   */
  private formatPrompt(prompt: string): string {
    if (!this.options.promptTemplate) {
      return prompt;
    }
    
    return this.options.promptTemplate.replace('{prompt}', prompt);
  }
}

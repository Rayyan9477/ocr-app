/**
 * HuggingFace Integration Client
 * 
 * Client for interacting with HuggingFace Inference API
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import { VLMError, VLMErrorCode } from '../core/vlm-error-types';
import logger from '../../logger';

/**
 * Options for HuggingFace client
 */
export interface HuggingFaceClientOptions {
  /**
   * Model ID to use
   */
  modelId: string;
  
  /**
   * API key for HuggingFace
   */
  apiKey: string;
  
  /**
   * API endpoint
   */
  apiEndpoint?: string;
  
  /**
   * Number of retries for failed requests
   */
  maxRetries?: number;
  
  /**
   * Delay between retries in milliseconds
   */
  retryDelayMs?: number;
  
  /**
   * Whether to use exponential backoff for retries
   */
  useExponentialBackoff?: boolean;
  
  /**
   * Timeout for requests in milliseconds
   */
  timeoutMs?: number;
  
  /**
   * Whether to use streaming responses (if supported)
   */
  useStreaming?: boolean;
}

/**
 * Client for HuggingFace Inference API
 */
export class HuggingFaceClient {
  private options: HuggingFaceClientOptions;
  private baseUrl: string;
  private initialized: boolean = false;
  private modelInfo: any = null;
  
  constructor(options: HuggingFaceClientOptions) {
    this.options = {
      ...{
        apiEndpoint: 'https://api-inference.huggingface.co/models',
        maxRetries: 3,
        retryDelayMs: 1000,
        useExponentialBackoff: true,
        timeoutMs: 30000,
        useStreaming: false
      },
      ...options
    };
    
    this.baseUrl = `${this.options.apiEndpoint}/${this.options.modelId}`;
  }
  
  /**
   * Initialize the client
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      // Check if API key is valid
      if (!this.options.apiKey) {
        throw new VLMError(
          VLMErrorCode.AUTHENTICATION_FAILED,
          'HuggingFace API key is required',
          undefined,
          true,
          ['Set HUGGINGFACE_API_KEY environment variable', 'Provide apiKey in options']
        );
      }
      
      // Check if model exists
      this.modelInfo = await this.fetchModelInfo();
      
      this.initialized = true;
      logger.info(`HuggingFace client initialized for model: ${this.options.modelId}`);
    } catch (error) {
      if (error instanceof VLMError) {
        throw error;
      }
      
      throw new VLMError(
        VLMErrorCode.INIT_FAILED,
        `Failed to initialize HuggingFace client: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error },
        true,
        ['Check API key', 'Verify model ID']
      );
    }
  }
  
  /**
   * Process an image with the model
   */
  async process(
    imageBuffer: Buffer,
    prompt: string,
    options: any = {}
  ): Promise<any> {
    if (!this.initialized) {
      throw new VLMError(
        VLMErrorCode.MODEL_NOT_INITIALIZED,
        'HuggingFace client is not initialized',
        undefined,
        true,
        ['Initialize the client first']
      );
    }
    
    try {
      // Prepare request body
      const body: any = {
        inputs: {
          image: this.bufferToBase64(imageBuffer),
          text: prompt
        },
        parameters: {
          max_new_tokens: options.maxLength || 1024,
          temperature: options.temperature || 0.0,
          top_k: options.topK || 50,
          repetition_penalty: options.repetitionPenalty || 1.0,
          num_beams: options.numBeams || 1,
          return_full_text: false
        }
      };
      
      // Make request
      const response = await this.makeRequest(body, options.timeoutMs || this.options.timeoutMs);
      
      return response;
    } catch (error) {
      if (error instanceof VLMError) {
        throw error;
      }
      
      throw new VLMError(
        VLMErrorCode.PROCESSING_FAILED,
        `Failed to process image with HuggingFace: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error },
        false
      );
    }
  }
  
  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    this.initialized = false;
  }
  
  /**
   * Check health of the client
   */
  async checkHealth(): Promise<{
    isHealthy: boolean;
    message?: string;
    details?: any;
  }> {
    try {
      if (!this.initialized) {
        return {
          isHealthy: false,
          message: 'Client is not initialized'
        };
      }
      
      // Make a simple request to check if the API is responding
      const response = await fetch(`${this.options.apiEndpoint}/${this.options.modelId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`
        },
        timeout: 5000
      });
      
      if (!response.ok) {
        return {
          isHealthy: false,
          message: `API returned status ${response.status}: ${response.statusText}`,
          details: {
            status: response.status,
            statusText: response.statusText
          }
        };
      }
      
      return {
        isHealthy: true,
        message: 'API is responding normally',
        details: {
          modelId: this.options.modelId,
          apiEndpoint: this.options.apiEndpoint
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
   * Fetch model information from HuggingFace
   */
  private async fetchModelInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.options.apiEndpoint}/${this.options.modelId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`
        },
        timeout: 5000
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new VLMError(
            VLMErrorCode.AUTHENTICATION_FAILED,
            `Authentication failed with status ${response.status}: ${response.statusText}`,
            { status: response.status, statusText: response.statusText },
            true,
            ['Check your API key', 'Verify that your account has access to this model']
          );
        }
        
        if (response.status === 404) {
          throw new VLMError(
            VLMErrorCode.MODEL_NOT_FOUND,
            `Model "${this.options.modelId}" not found`,
            { modelId: this.options.modelId },
            true,
            ['Check the model ID', 'Try a different model']
          );
        }
        
        throw new VLMError(
          VLMErrorCode.API_ERROR,
          `API error with status ${response.status}: ${response.statusText}`,
          { status: response.status, statusText: response.statusText },
          false
        );
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof VLMError) {
        throw error;
      }
      
      throw new VLMError(
        VLMErrorCode.NETWORK_ERROR,
        `Failed to fetch model info: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error },
        true,
        ['Check your internet connection', 'Verify that the API endpoint is correct']
      );
    }
  }
  
  /**
   * Make a request to the HuggingFace API with retries
   */
  private async makeRequest(body: any, timeoutMs: number): Promise<any> {
    let attempts = 0;
    let lastError: Error | null = null;
    
    while (attempts < this.options.maxRetries!) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const response = await fetch(`${this.baseUrl}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.options.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Handle different response status codes
        if (response.status === 200) {
          return await response.json();
        }
        
        if (response.status === 401 || response.status === 403) {
          throw new VLMError(
            VLMErrorCode.AUTHENTICATION_FAILED,
            `Authentication failed with status ${response.status}: ${response.statusText}`,
            { status: response.status, statusText: response.statusText },
            true,
            ['Check your API key', 'Verify that your account has access to this model']
          );
        }
        
        if (response.status === 404) {
          throw new VLMError(
            VLMErrorCode.MODEL_NOT_FOUND,
            `Model "${this.options.modelId}" not found`,
            { modelId: this.options.modelId },
            true,
            ['Check the model ID', 'Try a different model']
          );
        }
        
        if (response.status === 429) {
          throw new VLMError(
            VLMErrorCode.RATE_LIMIT_EXCEEDED,
            `Rate limit exceeded with status ${response.status}: ${response.statusText}`,
            { status: response.status, statusText: response.statusText },
            true,
            ['Wait and try again later', 'Reduce request frequency']
          );
        }
        
        if (response.status === 503 || response.status === 500) {
          // Server error, can retry
          const responseBody = await response.text();
          lastError = new Error(`API server error (${response.status}): ${responseBody}`);
          attempts++;
          
          // Wait before retrying
          const delay = this.options.useExponentialBackoff!
            ? this.options.retryDelayMs! * Math.pow(2, attempts - 1)
            : this.options.retryDelayMs!;
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Other error status
        const responseBody = await response.text();
        throw new VLMError(
          VLMErrorCode.API_ERROR,
          `API error with status ${response.status}: ${responseBody}`,
          { status: response.status, body: responseBody },
          false
        );
      } catch (error) {
        if (error instanceof VLMError) {
          throw error;
        }
        
        // Network errors can be retried
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts++;
        
        // If it's an abort error (timeout), format it accordingly
        if (lastError.name === 'AbortError') {
          throw new VLMError(
            VLMErrorCode.TIMEOUT,
            `Request timed out after ${timeoutMs}ms`,
            { timeoutMs },
            true,
            ['Increase timeout', 'Check API status']
          );
        }
        
        // Wait before retrying
        const delay = this.options.useExponentialBackoff!
          ? this.options.retryDelayMs! * Math.pow(2, attempts - 1)
          : this.options.retryDelayMs!;
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // All retries failed
    throw new VLMError(
      VLMErrorCode.API_ERROR,
      `Failed after ${attempts} attempts: ${lastError?.message || 'Unknown error'}`,
      { attempts, originalError: lastError },
      false
    );
  }
  
  /**
   * Convert buffer to base64 string
   */
  private bufferToBase64(buffer: Buffer): string {
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  }
}

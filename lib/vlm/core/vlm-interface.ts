/**
 * Vision Language Model Interface
 * 
 * Defines the core abstract interface for VLM implementations
 * to provide consistent interaction patterns regardless of the 
 * underlying model or deployment strategy.
 */

import { VLMCapability } from './vlm-capabilities';
import { 
  VLMResponse, 
  DocumentAnalysisResponse,
  TextExtractionResponse,
  StructuredDataResponse
} from './vlm-response-types';
import { VlmError } from './vlm-error-types';

export interface VLMOptions {
  /**
   * Model-specific options for processing
   */
  modelOptions?: Record<string, any>;
  
  /**
   * Input resolution for images
   */
  resolution?: {
    width: number;
    height: number;
  };
  
  /**
   * Timeout for VLM operations in milliseconds
   */
  timeoutMs?: number;
  
  /**
   * Whether to cache results to improve performance
   */
  enableCache?: boolean;
  
  /**
   * The confidence threshold for accepting results
   * (0-1 range)
   */
  confidenceThreshold?: number;
  
  /**
   * Whether to enable fallback mechanisms if model fails
   */
  enableFallback?: boolean;
}

export interface VLMInterface {
  /**
   * Unique identifier for this VLM implementation
   */
  readonly id: string;
  
  /**
   * Human-readable name of the VLM
   */
  readonly name: string;
  
  /**
   * VLM capabilities supported by this implementation
   */
  readonly capabilities: VLMCapability[];
  
  /**
   * Whether the VLM is currently ready for processing
   */
  readonly isReady: boolean;
  
  /**
   * Initialize the VLM with the given options
   */
  initialize(options?: VLMOptions): Promise<boolean>;
  
  /**
   * Analyze document properties and structure
   * 
   * @param imagePath Path to document image
   * @param options Processing options
   */
  analyzeDocument(imagePath: string, options?: VLMOptions): Promise<DocumentAnalysisResponse>;
  
  /**
   * Extract text from document with VLM capabilities
   * 
   * @param imagePath Path to document image
   * @param options Processing options
   */
  extractText(imagePath: string, options?: VLMOptions): Promise<TextExtractionResponse>;
  
  /**
   * Extract structured data (tables, forms, etc.)
   * 
   * @param imagePath Path to document image
   * @param options Processing options
   */
  extractStructuredData(imagePath: string, options?: VLMOptions): Promise<StructuredDataResponse>;
  
  /**
   * Process a document with a custom prompt for specialized tasks
   * 
   * @param imagePath Path to document image
   * @param prompt Custom prompt for the VLM
   * @param options Processing options
   */
  processWithPrompt(imagePath: string, prompt: string, options?: VLMOptions): Promise<VLMResponse>;
  
  /**
   * Release resources used by the VLM
   */
  dispose(): Promise<void>;
  
  /**
   * Get current model health status
   */
  getHealthStatus(): Promise<{
    isHealthy: boolean;
    details: Record<string, any>;
    lastError?: VlmError;
  }>;
}

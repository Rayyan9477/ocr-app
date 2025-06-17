/**
 * Model-specific Configurations
 * 
 * Configurations for specific VLM models
 */

import { VLMCapability } from '../core/vlm-capabilities';

/**
 * Base model configuration interface
 */
export interface ModelConfig {
  /**
   * Model identifier
   */
  id: string;
  
  /**
   * Human-readable name
   */
  name: string;
  
  /**
   * Model version
   */
  version?: string;
  
  /**
   * Source of the model
   */
  source: string;
  
  /**
   * Model size in parameters
   */
  parameters: number;
  
  /**
   * Size in MB
   */
  sizeInMB: number;
  
  /**
   * Input resolution
   */
  inputResolution: {
    width: number;
    height: number;
  };
  
  /**
   * Supported deployment strategies
   */
  supportedDeployments: ('local' | 'cloud' | 'hybrid')[];
  
  /**
   * Supported capabilities
   */
  capabilities: VLMCapability[];
  
  /**
   * Model-specific options
   */
  options: Record<string, any>;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Configuration for PaliGemma2-3B-Mix-224 model
 */
export const paliGemma2Config: ModelConfig = {
  id: 'paligemma2-3b-mix-224',
  name: 'PaliGemma2 3B Mix',
  version: '1.0',
  source: 'HuggingFace',
  parameters: 3000000000, // 3B
  sizeInMB: 6000, // 6GB
  inputResolution: {
    width: 224,
    height: 224
  },
  supportedDeployments: ['local', 'cloud', 'hybrid'],
  capabilities: [
    VLMCapability.DOCUMENT_TYPE_DETECTION,
    VLMCapability.LAYOUT_ANALYSIS,
    VLMCapability.QUALITY_ASSESSMENT,
    VLMCapability.HANDWRITING_DETECTION,
    VLMCapability.TABLE_DETECTION,
    VLMCapability.HIGHLIGHT_DETECTION,
    VLMCapability.TEXT_EXTRACTION,
    VLMCapability.HANDWRITING_RECOGNITION,
    VLMCapability.LOW_QUALITY_TEXT_RECOGNITION,
    VLMCapability.TABLE_EXTRACTION,
    VLMCapability.FORM_EXTRACTION,
    VLMCapability.KEY_VALUE_EXTRACTION,
    VLMCapability.TEXT_CORRECTION,
    VLMCapability.SEMANTIC_VALIDATION,
    VLMCapability.CONFIDENCE_SCORING
  ],
  options: {
    modelId: 'google/paligemma2-3b-mix-224',
    maxLength: 1024,
    numBeams: 1,
    temperature: 0.0,
    topK: 50,
    repetitionPenalty: 1.0,
    promptTemplate: 'USER: {prompt}\nASSISTANT:'
  },
  metadata: {
    description: 'PaliGemma2 is a vision language model developed by Google that excels at document understanding and OCR enhancement.',
    homepage: 'https://huggingface.co/google/paligemma2-3b-mix-224',
    license: 'Apache-2.0',
    paperUrl: 'https://arxiv.org/abs/2311.01267',
    quantized: false
  }
};

/**
 * Map of all available model configurations
 */
export const modelConfigs: Record<string, ModelConfig> = {
  'paligemma2-3b-mix-224': paliGemma2Config
};

/**
 * Get configuration for a specific model
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return modelConfigs[modelId];
}

/**
 * Get all available model configurations
 */
export function getAllModelConfigs(): ModelConfig[] {
  return Object.values(modelConfigs);
}

export default modelConfigs;

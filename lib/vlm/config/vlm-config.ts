/**
 * VLM Configuration
 * 
 * Main configuration interface for VLM settings
 */

import { VLMCapability } from '../core/vlm-capabilities';

/**
 * Core VLM configuration
 */
export interface VLMConfig {
  /**
   * Whether VLM functionality is enabled
   */
  enabled: boolean;
  
  /**
   * Primary model to use
   */
  primaryModel: string;
  
  /**
   * Fallback models to use if primary fails
   */
  fallbackModels?: string[];
  
  /**
   * Deployment strategy to use
   */
  deploymentStrategy: 'local' | 'cloud' | 'hybrid';
  
  /**
   * Health check interval in milliseconds
   */
  healthCheckIntervalMs: number;
  
  /**
   * Global options for all models
   */
  globalOptions: {
    /**
     * Resolution settings for images
     */
    resolution?: {
      width: number;
      height: number;
    };
    
    /**
     * Default timeout for operations in milliseconds
     */
    timeoutMs: number;
    
    /**
     * Default confidence threshold
     */
    confidenceThreshold: number;
    
    /**
     * Whether to enable caching
     */
    enableCache: boolean;
    
    /**
     * Whether to enable fallback mechanisms
     */
    enableFallback: boolean;
    
    /**
     * Maximum number of concurrent requests
     */
    maxConcurrentRequests: number;
    
    /**
     * Maximum number of retries for failed operations
     */
    maxRetries: number;
    
    /**
     * Whether to log detailed performance metrics
     */
    logPerformance: boolean;
  };
  
  /**
   * Model-specific configurations (overrides global options)
   */
  modelConfigs: Record<string, {
    /**
     * Model-specific options
     */
    options?: Record<string, any>;
    
    /**
     * Whether to preload this model
     */
    preload?: boolean;
    
    /**
     * Priority (lower = higher priority)
     */
    priority?: number;
    
    /**
     * Capabilities to enable for this model
     */
    enabledCapabilities?: VLMCapability[];
  }>;
  
  /**
   * Cache configuration
   */
  cache: {
    /**
     * Maximum number of items to cache
     */
    maxItems: number;
    
    /**
     * Time-to-live in milliseconds
     */
    ttlMs: number;
    
    /**
     * Maximum memory usage in MB
     */
    maxMemoryMB?: number;
  };
  
  /**
   * Integration options
   */
  integration: {
    /**
     * Whether to enhance OCR results with VLM
     */
    enhanceOCR: boolean;
    
    /**
     * Whether to use VLM for document analysis
     */
    enhanceDocumentAnalysis: boolean;
    
    /**
     * Whether to use VLM for preprocessing guidance
     */
    enhancePreprocessing: boolean;
    
    /**
     * Whether to use VLM for engine selection
     */
    enhanceEngineSelection: boolean;
  };
}

/**
 * Default VLM configuration
 */
export const defaultVLMConfig: VLMConfig = {
  enabled: true,
  primaryModel: 'paligemma2-3b-mix-224',
  fallbackModels: ['enhanced-tesseract'],
  deploymentStrategy: 'local',
  healthCheckIntervalMs: 60000,
  globalOptions: {
    resolution: {
      width: 224,
      height: 224
    },
    timeoutMs: 30000,
    confidenceThreshold: 0.7,
    enableCache: true,
    enableFallback: true,
    maxConcurrentRequests: 2,
    maxRetries: 3,
    logPerformance: true
  },
  modelConfigs: {
    'paligemma2-3b-mix-224': {
      preload: true,
      priority: 1,
      options: {
        contextLength: 1024,
        batchSize: 1
      }
    }
  },
  cache: {
    maxItems: 1000,
    ttlMs: 3600000, // 1 hour
    maxMemoryMB: 1000
  },
  integration: {
    enhanceOCR: true,
    enhanceDocumentAnalysis: true,
    enhancePreprocessing: true,
    enhanceEngineSelection: true
  }
};

/**
 * Load VLM configuration from environment variables
 */
export function loadVLMConfigFromEnv(): Partial<VLMConfig> {
  return {
    enabled: process.env.VLM_ENABLED === 'true',
    primaryModel: process.env.VLM_PRIMARY_MODEL,
    deploymentStrategy: (process.env.VLM_DEPLOYMENT_STRATEGY || 'local') as 'local' | 'cloud' | 'hybrid',
    globalOptions: {
      timeoutMs: parseInt(process.env.VLM_TIMEOUT_MS || '30000', 10),
      confidenceThreshold: parseFloat(process.env.VLM_FALLBACK_CONFIDENCE_THRESHOLD || '0.7'),
      maxConcurrentRequests: parseInt(process.env.VLM_MAX_CONCURRENT_REQUESTS || '2', 10),
      maxRetries: parseInt(process.env.VLM_MAX_RETRIES || '3', 10),
      enableFallback: process.env.VLM_ENABLE_FALLBACK === 'true'
    }
  };
}

// Singleton instance
let vlmConfig: VLMConfig = { ...defaultVLMConfig };

/**
 * Get the current VLM configuration
 */
export function getVLMConfig(): VLMConfig {
  return { ...vlmConfig };
}

/**
 * Update the VLM configuration
 */
export function updateVLMConfig(config: Partial<VLMConfig>): VLMConfig {
  vlmConfig = {
    ...vlmConfig,
    ...config,
    globalOptions: {
      ...vlmConfig.globalOptions,
      ...config.globalOptions
    },
    modelConfigs: {
      ...vlmConfig.modelConfigs,
      ...config.modelConfigs
    },
    cache: {
      ...vlmConfig.cache,
      ...config.cache
    },
    integration: {
      ...vlmConfig.integration,
      ...config.integration
    }
  };
  
  return { ...vlmConfig };
}

// Initialize from environment variables
const envConfig = loadVLMConfigFromEnv();
if (Object.keys(envConfig).length > 0) {
  updateVLMConfig(envConfig);
}

export default vlmConfig;

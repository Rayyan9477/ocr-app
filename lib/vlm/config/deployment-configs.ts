/**
 * Deployment Configurations
 * 
 * Configuration for different deployment strategies
 */

/**
 * Base deployment configuration
 */
export interface DeploymentConfig {
  /**
   * Type of deployment
   */
  type: 'local' | 'cloud' | 'hybrid';
  
  /**
   * Human-readable name
   */
  name: string;
  
  /**
   * Description of the deployment strategy
   */
  description: string;
  
  /**
   * Optimization level
   */
  optimizationLevel: 'none' | 'basic' | 'advanced';
  
  /**
   * Whether to enable quantization
   */
  enableQuantization: boolean;
  
  /**
   * Maximum memory usage in MB
   */
  maxMemoryMB?: number;
  
  /**
   * Max number of concurrent requests
   */
  maxConcurrentRequests: number;
  
  /**
   * Connection timeout in milliseconds
   */
  connectionTimeoutMs: number;
  
  /**
   * Additional configuration
   */
  config: Record<string, any>;
}

/**
 * Local deployment configuration
 */
export const localDeploymentConfig: DeploymentConfig = {
  type: 'local',
  name: 'Local Deployment',
  description: 'Runs models locally using TensorFlow.js or ONNX Runtime',
  optimizationLevel: 'advanced',
  enableQuantization: true,
  maxMemoryMB: 4000,
  maxConcurrentRequests: 1,
  connectionTimeoutMs: 5000,
  config: {
    modelCacheDirectory: 'models/vlm',
    preferGPU: true,
    fallbackToCPU: true,
    batchSize: 1,
    onnxOptimizationLevel: 3,
    webglFlags: {
      enableFloatTextures: true,
      useWebGPU: true
    }
  }
};

/**
 * Cloud deployment configuration
 */
export const cloudDeploymentConfig: DeploymentConfig = {
  type: 'cloud',
  name: 'HuggingFace Inference API',
  description: 'Uses HuggingFace Inference API for cloud-based model inference',
  optimizationLevel: 'none',
  enableQuantization: false,
  maxConcurrentRequests: 5,
  connectionTimeoutMs: 30000,
  config: {
    apiEndpoint: 'https://api-inference.huggingface.co/models',
    useApiKey: true,
    retryStrategy: {
      maxRetries: 3,
      retryDelayMs: 1000,
      exponentialBackoff: true
    },
    cacheResponses: true,
    cacheTTLMs: 3600000
  }
};

/**
 * Hybrid deployment configuration
 */
export const hybridDeploymentConfig: DeploymentConfig = {
  type: 'hybrid',
  name: 'Hybrid Deployment',
  description: 'Intelligently switches between local and cloud deployment based on request characteristics',
  optimizationLevel: 'basic',
  enableQuantization: true,
  maxMemoryMB: 2000,
  maxConcurrentRequests: 3,
  connectionTimeoutMs: 15000,
  config: {
    localConfig: { ...localDeploymentConfig.config },
    cloudConfig: { ...cloudDeploymentConfig.config },
    switchingStrategy: {
      preferLocal: true,
      switchToCloudThreshold: 0.7, // Switch to cloud if complexity > 0.7
      complexityEstimationEnabled: true,
      considerAvailableMemory: true,
      considerImageSize: true,
      considerNetworkLatency: true
    }
  }
};

/**
 * All deployment configurations
 */
export const deploymentConfigs: Record<string, DeploymentConfig> = {
  local: localDeploymentConfig,
  cloud: cloudDeploymentConfig,
  hybrid: hybridDeploymentConfig
};

/**
 * Get configuration for a specific deployment type
 */
export function getDeploymentConfig(type: 'local' | 'cloud' | 'hybrid'): DeploymentConfig {
  return deploymentConfigs[type] || localDeploymentConfig;
}

export default deploymentConfigs;

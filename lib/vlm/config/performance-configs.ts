/**
 * Performance Configurations
 * 
 * Performance-related settings for VLM operations
 */

/**
 * Performance configuration interface
 */
export interface PerformanceConfig {
  /**
   * Batch processing configuration
   */
  batch: {
    /**
     * Default batch size
     */
    batchSize: number;
    
    /**
     * Maximum batch size
     */
    maxBatchSize: number;
    
    /**
     * Whether to enable dynamic batch sizing
     */
    dynamicBatchSizing: boolean;
    
    /**
     * Maximum allowed memory usage for batching (MB)
     */
    maxMemoryMB: number;
    
    /**
     * Time to wait for batching requests (ms)
     */
    batchingWindowMs: number;
  };
  
  /**
   * Caching configuration
   */
  cache: {
    /**
     * Whether to enable response caching
     */
    enabled: boolean;
    
    /**
     * Maximum cache size (items)
     */
    maxItems: number;
    
    /**
     * Time-to-live for cache entries (ms)
     */
    ttlMs: number;
    
    /**
     * Whether to enable cache pruning
     */
    enablePruning: boolean;
    
    /**
     * Whether to persist cache between restarts
     */
    persistCache: boolean;
    
    /**
     * Cache directory for persistence (if enabled)
     */
    cacheDirectory: string;
  };
  
  /**
   * Request queue configuration
   */
  requestQueue: {
    /**
     * Maximum queue size
     */
    maxQueueSize: number;
    
    /**
     * Maximum wait time for queued requests (ms)
     */
    maxWaitTimeMs: number;
    
    /**
     * Priority levels for queue
     */
    priorityLevels: number;
    
    /**
     * Whether to enable fair scheduling
     */
    fairScheduling: boolean;
  };
  
  /**
   * Memory management configuration
   */
  memory: {
    /**
     * Low memory threshold (MB)
     */
    lowMemoryThresholdMB: number;
    
    /**
     * Critical memory threshold (MB)
     */
    criticalMemoryThresholdMB: number;
    
    /**
     * Whether to release memory between batches
     */
    releaseMemoryBetweenBatches: boolean;
    
    /**
     * Whether to enable aggressive memory recovery
     */
    aggressiveMemoryRecovery: boolean;
  };
  
  /**
   * Optimization configuration
   */
  optimization: {
    /**
     * Whether to use 16-bit precision
     */
    useFP16: boolean;
    
    /**
     * Whether to use model quantization
     */
    useQuantization: boolean;
    
    /**
     * Whether to enable ONNX optimization
     */
    enableONNX: boolean;
    
    /**
     * ONNX optimization level (1-3)
     */
    onnxOptimizationLevel: number;
    
    /**
     * Whether to enable GPU acceleration
     */
    enableGPU: boolean;
    
    /**
     * Whether to fall back to CPU if GPU fails
     */
    fallbackToCPU: boolean;
  };
  
  /**
   * Timeout configuration
   */
  timeouts: {
    /**
     * Model loading timeout (ms)
     */
    modelLoadingMs: number;
    
    /**
     * Inference timeout (ms)
     */
    inferenceMs: number;
    
    /**
     * API request timeout (ms)
     */
    apiRequestMs: number;
    
    /**
     * Preprocessing timeout (ms)
     */
    preprocessingMs: number;
  };
}

/**
 * Default performance configuration
 */
export const defaultPerformanceConfig: PerformanceConfig = {
  batch: {
    batchSize: 1,
    maxBatchSize: 4,
    dynamicBatchSizing: true,
    maxMemoryMB: 4000,
    batchingWindowMs: 100
  },
  cache: {
    enabled: true,
    maxItems: 1000,
    ttlMs: 3600000, // 1 hour
    enablePruning: true,
    persistCache: false,
    cacheDirectory: 'cache/vlm'
  },
  requestQueue: {
    maxQueueSize: 100,
    maxWaitTimeMs: 60000, // 1 minute
    priorityLevels: 3,
    fairScheduling: true
  },
  memory: {
    lowMemoryThresholdMB: 500,
    criticalMemoryThresholdMB: 200,
    releaseMemoryBetweenBatches: true,
    aggressiveMemoryRecovery: false
  },
  optimization: {
    useFP16: true,
    useQuantization: true,
    enableONNX: true,
    onnxOptimizationLevel: 3,
    enableGPU: true,
    fallbackToCPU: true
  },
  timeouts: {
    modelLoadingMs: 60000, // 1 minute
    inferenceMs: 30000, // 30 seconds
    apiRequestMs: 30000, // 30 seconds
    preprocessingMs: 10000 // 10 seconds
  }
};

/**
 * Performance profiles for different environments
 */
export const performanceProfiles: Record<string, PerformanceConfig> = {
  // High-performance profile for powerful machines
  highPerformance: {
    ...defaultPerformanceConfig,
    batch: {
      ...defaultPerformanceConfig.batch,
      batchSize: 4,
      maxBatchSize: 8,
      dynamicBatchSizing: true,
      maxMemoryMB: 8000
    },
    optimization: {
      ...defaultPerformanceConfig.optimization,
      useFP16: false, // Use full precision
      onnxOptimizationLevel: 3
    }
  },
  
  // Balanced profile for average machines
  balanced: {
    ...defaultPerformanceConfig
  },
  
  // Low-resource profile for limited environments
  lowResource: {
    ...defaultPerformanceConfig,
    batch: {
      ...defaultPerformanceConfig.batch,
      batchSize: 1,
      maxBatchSize: 2,
      dynamicBatchSizing: false,
      maxMemoryMB: 1000
    },
    cache: {
      ...defaultPerformanceConfig.cache,
      maxItems: 100
    },
    memory: {
      ...defaultPerformanceConfig.memory,
      lowMemoryThresholdMB: 200,
      criticalMemoryThresholdMB: 100,
      releaseMemoryBetweenBatches: true,
      aggressiveMemoryRecovery: true
    },
    optimization: {
      ...defaultPerformanceConfig.optimization,
      useFP16: true,
      useQuantization: true
    }
  }
};

/**
 * Get performance configuration for a specific profile
 */
export function getPerformanceConfig(profile: string): PerformanceConfig {
  return performanceProfiles[profile] || defaultPerformanceConfig;
}

/**
 * Detect best performance profile based on system capabilities
 */
export async function detectOptimalPerformanceProfile(): Promise<string> {
  try {
    // Basic detection logic (can be enhanced with actual system metrics)
    const totalMemoryMB = (os.totalmem() / (1024 * 1024));
    const cpuCount = os.cpus().length;
    
    if (totalMemoryMB > 8000 && cpuCount >= 8) {
      return 'highPerformance';
    } else if (totalMemoryMB > 4000 && cpuCount >= 4) {
      return 'balanced';
    } else {
      return 'lowResource';
    }
  } catch (error) {
    console.warn('Error detecting optimal performance profile:', error);
    return 'balanced'; // Default to balanced profile
  }
}

// Need to import os at the top
import os from 'os';

export default performanceProfiles;

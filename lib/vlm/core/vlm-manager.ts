/**
 * VLM Manager
 * 
 * Manages the lifecycle of VLM instances, including
 * creation, caching, and disposal.
 */

import { VLMInterface, VLMOptions } from './vlm-interface';
import { VLMFactory, VLMFactoryOptions } from './vlm-factory';
import { VLMRegistry } from './vlm-registry';
import { VLMError, VLMErrorCode } from './vlm-error-types';

/**
 * Options for the VLM Manager
 */
export interface VLMManagerOptions {
  /**
   * Maximum number of VLM instances to keep in cache
   */
  maxCachedInstances?: number;
  
  /**
   * Default options for VLM instances
   */
  defaultVLMOptions?: VLMOptions;
  
  /**
   * Registry to use for VLM implementations
   */
  registry?: VLMRegistry;
  
  /**
   * Default model ID to use when none is specified
   */
  defaultModelId?: string;
  
  /**
   * Default deployment strategy
   */
  defaultDeploymentStrategy?: 'local' | 'cloud' | 'hybrid';
}

/**
 * Manager for VLM instances
 */
export class VLMManager {
  private factory: VLMFactory;
  private registry: VLMRegistry;
  private instanceCache: Map<string, { vlm: VLMInterface; lastUsed: Date }> = new Map();
  private maxCachedInstances: number;
  private defaultVLMOptions: VLMOptions;
  private defaultModelId?: string;
  private defaultDeploymentStrategy: 'local' | 'cloud' | 'hybrid';
  
  constructor(options: VLMManagerOptions = {}) {
    const {
      maxCachedInstances = 3,
      defaultVLMOptions = {},
      registry,
      defaultModelId,
      defaultDeploymentStrategy = 'local'
    } = options;
    
    this.registry = registry || new VLMRegistry();
    this.factory = new VLMFactory(this.registry);
    this.maxCachedInstances = maxCachedInstances;
    this.defaultVLMOptions = defaultVLMOptions;
    this.defaultModelId = defaultModelId;
    this.defaultDeploymentStrategy = defaultDeploymentStrategy;
  }
  
  /**
   * Get a VLM instance
   */
  async getVLM(options: Partial<VLMFactoryOptions> = {}): Promise<VLMInterface> {
    const modelId = options.modelId || this.defaultModelId;
    
    if (!modelId) {
      throw new VLMError(
        VLMErrorCode.INVALID_INPUT,
        'No model ID specified and no default model ID configured',
        { options },
        true,
        ['Specify a model ID', 'Configure a default model ID']
      );
    }
    
    const deploymentStrategy = options.deploymentStrategy || this.defaultDeploymentStrategy;
    const cacheKey = `${modelId}:${deploymentStrategy}`;
    
    // Check if we have a cached instance
    const cachedEntry = this.instanceCache.get(cacheKey);
    if (cachedEntry) {
      // Update last used time
      cachedEntry.lastUsed = new Date();
      return cachedEntry.vlm;
    }
    
    // Create a new instance
    const factoryOptions: VLMFactoryOptions = {
      modelId,
      deploymentStrategy,
      ...this.defaultVLMOptions,
      ...options
    };
    
    const vlm = await this.factory.createVLM(factoryOptions);
    
    // Add to cache
    this.instanceCache.set(cacheKey, {
      vlm,
      lastUsed: new Date()
    });
    
    // Clean up cache if needed
    this.cleanupCache();
    
    return vlm;
  }
  
  /**
   * Get or create a VLM instance with fallback options
   */
  async getVLMWithFallback(
    primaryOptions: Partial<VLMFactoryOptions> = {},
    fallbackOptions: Partial<VLMFactoryOptions>[] = []
  ): Promise<{ vlm: VLMInterface; usedFallback: boolean; fallbackIndex?: number }> {
    try {
      const vlm = await this.getVLM(primaryOptions);
      return { vlm, usedFallback: false };
    } catch (error) {
      // Try fallbacks in order
      for (let i = 0; i < fallbackOptions.length; i++) {
        try {
          const vlm = await this.getVLM(fallbackOptions[i]);
          return { vlm, usedFallback: true, fallbackIndex: i };
        } catch {
          // Continue to next fallback
        }
      }
      
      // Re-throw the original error if all fallbacks fail
      throw error;
    }
  }
  
  /**
   * Release a VLM instance
   */
  async releaseVLM(modelId: string, deploymentStrategy: 'local' | 'cloud' | 'hybrid' = 'local'): Promise<void> {
    const cacheKey = `${modelId}:${deploymentStrategy}`;
    const cachedEntry = this.instanceCache.get(cacheKey);
    
    if (cachedEntry) {
      try {
        await cachedEntry.vlm.dispose();
      } catch (error) {
        console.error(`Error disposing VLM instance ${modelId}:`, error);
      }
      
      this.instanceCache.delete(cacheKey);
    }
  }
  
  /**
   * Release all VLM instances
   */
  async releaseAllVLMs(): Promise<void> {
    const disposePromises: Promise<void>[] = [];
    
    for (const [cacheKey, cachedEntry] of this.instanceCache.entries()) {
      try {
        disposePromises.push(cachedEntry.vlm.dispose());
      } catch (error) {
        console.error(`Error disposing VLM instance ${cacheKey}:`, error);
      }
    }
    
    await Promise.all(disposePromises);
    this.instanceCache.clear();
  }
  
  /**
   * Clean up the least recently used instances if we're over the limit
   */
  private cleanupCache(): void {
    if (this.instanceCache.size <= this.maxCachedInstances) {
      return;
    }
    
    // Sort entries by last used time (oldest first)
    const entries = Array.from(this.instanceCache.entries())
      .sort((a, b) => a[1].lastUsed.getTime() - b[1].lastUsed.getTime());
    
    // Dispose of oldest entries until we're under the limit
    const entriesToRemove = entries.slice(0, entries.length - this.maxCachedInstances);
    
    for (const [cacheKey, cachedEntry] of entriesToRemove) {
      try {
        // Dispose asynchronously
        cachedEntry.vlm.dispose().catch(error => {
          console.error(`Error disposing VLM instance ${cacheKey}:`, error);
        });
      } catch (error) {
        console.error(`Error disposing VLM instance ${cacheKey}:`, error);
      }
      
      this.instanceCache.delete(cacheKey);
    }
  }
}

// Create and export singleton instance
export const vlmManager = new VLMManager();
export default vlmManager;

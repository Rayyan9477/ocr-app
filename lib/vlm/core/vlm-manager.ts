/**
 * VLM Manager
 * 
 * Manages Paligemma2 VLM instance lifecycle.
 */

import { VLMInterface, VLMOptions } from './vlm-interface';
import { VLMFactory, VLMFactoryOptions } from './vlm-factory';
import { VLMRegistry, vlmRegistry } from './vlm-registry';
import { VlmError, VlmErrorType } from './vlm-error-types';
import { ExtendedPaliGemma2Adapter } from '../../extended-paligemma2-adapter';

/**
 * Options for the VLM Manager
 */
export interface VLMManagerOptions {
  /**
   * Maximum number of VLM instances to keep in cache
   */
  maxCachedInstances?: number;
  
  /**
   * Default options for VLM instance
   */
  defaultVLMOptions?: VLMOptions;
  
  /**
   * Default deployment strategy
   */
  defaultDeploymentStrategy?: 'local' | 'cloud' | 'hybrid';
}

/**
 * Manager for Paligemma2 VLM instance
 */
export class VLMManager {
  private factory: VLMFactory;
  private instance: VLMInterface | null = null;
  private readonly maxInstances: number;
  private readonly defaultOptions: VLMOptions;
  private readonly defaultStrategy: string;

  constructor(options: VLMManagerOptions = {}) {
    this.maxInstances = options.maxCachedInstances ?? 1;
    this.defaultOptions = options.defaultVLMOptions ?? {};
    this.defaultStrategy = options.defaultDeploymentStrategy ?? 'local';
    this.factory = new VLMFactory({ defaultModelId: 'paligemma2-3b-mix-224' });
  }
  
  /**
   * Get a VLM instance
   */
  async getVLM(options: Partial<VLMFactoryOptions> = {}): Promise<VLMInterface> {
    if (this.instance) {
      return this.instance;
    }
    
    const modelId = options.modelId || 'paligemma2-3b-mix-224';
    const deploymentStrategy = options.deploymentStrategy || this.defaultStrategy;
    
    // Create a new instance
    const factoryOptions: VLMFactoryOptions = {
      modelId,
      deploymentStrategy,
      ...this.defaultOptions,
      ...options
    };
    
    this.instance = await this.factory.createVLM(factoryOptions);
    
    return this.instance;
  }
  
  /**
   * Release the VLM instance
   */
  async releaseVLM(): Promise<void> {
    if (this.instance) {
      try {
        await this.instance.dispose();
      } catch (error) {
        console.error(`Error disposing VLM instance:`, error);
      }
      
      this.instance = null;
    }
  }
}

// Create and export singleton instance using the global registry
export const vlmManager = new VLMManager({ registry: vlmRegistry });
export default vlmManager;

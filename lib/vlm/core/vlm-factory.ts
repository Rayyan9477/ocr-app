/**
 * VLM Factory
 * 
 * Factory for creating and configuring VLM instances
 * based on the requested model and deployment strategy.
 */

import { VLMInterface, VLMOptions } from './vlm-interface';
import { VLMError, VLMErrorCode } from './vlm-error-types';
import { VLMRegistry } from './vlm-registry';

/**
 * Factory options for creating VLM instances
 */
export interface VLMFactoryOptions extends VLMOptions {
  /**
   * Model ID to create
   */
  modelId: string;
  
  /**
   * Deployment strategy
   */
  deploymentStrategy?: 'local' | 'cloud' | 'hybrid';
  
  /**
   * Whether to initialize the model immediately
   */
  initializeImmediately?: boolean;
  
  /**
   * Model-specific configuration overrides
   */
  modelConfigOverrides?: Record<string, any>;
}

/**
 * Factory for creating VLM instances
 */
export class VLMFactory {
  private registry: VLMRegistry;
  
  constructor(registry: VLMRegistry) {
    this.registry = registry;
  }
  
  /**
   * Create a VLM instance with the specified options
   */
  async createVLM(options: VLMFactoryOptions): Promise<VLMInterface> {
    const { modelId, deploymentStrategy = 'local', initializeImmediately = true } = options;
    
    // Get VLM implementation from registry
    const implementation = this.registry.getImplementation(modelId, deploymentStrategy);
    
    if (!implementation) {
      throw new VLMError(
        VLMErrorCode.MODEL_NOT_FOUND,
        `VLM implementation not found for model ID "${modelId}" with deployment strategy "${deploymentStrategy}"`,
        { modelId, deploymentStrategy },
        true,
        ['Try a different model ID', 'Check if the model is registered']
      );
    }
    
    // Create instance of the VLM
    const vlm = new implementation();
    
    // Initialize if requested
    if (initializeImmediately) {
      try {
        const success = await vlm.initialize(options);
        
        if (!success) {
          throw new VLMError(
            VLMErrorCode.INIT_FAILED,
            `Failed to initialize VLM model "${modelId}"`,
            { modelId },
            true,
            ['Check model configuration', 'Verify model files exist']
          );
        }
      } catch (error) {
        if (error instanceof VLMError) {
          throw error;
        }
        
        throw new VLMError(
          VLMErrorCode.INIT_FAILED,
          `Error initializing VLM model "${modelId}": ${error instanceof Error ? error.message : String(error)}`,
          { modelId, originalError: error },
          true,
          ['Check model configuration', 'Verify model files exist']
        );
      }
    }
    
    return vlm;
  }
  
  /**
   * Create a VLM instance with fallback options
   * Will try to create the primary model first, then fall back to alternatives if it fails
   */
  async createVLMWithFallback(
    primaryOptions: VLMFactoryOptions,
    fallbackOptions: VLMFactoryOptions[]
  ): Promise<{ vlm: VLMInterface; usedFallback: boolean; fallbackIndex?: number }> {
    try {
      // Try to create primary VLM
      const vlm = await this.createVLM(primaryOptions);
      return { vlm, usedFallback: false };
    } catch (primaryError) {
      console.warn(`Failed to create primary VLM "${primaryOptions.modelId}": ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);
      
      // Try fallback options in order
      for (let i = 0; i < fallbackOptions.length; i++) {
        try {
          const vlm = await this.createVLM(fallbackOptions[i]);
          return { vlm, usedFallback: true, fallbackIndex: i };
        } catch (fallbackError) {
          console.warn(`Failed to create fallback VLM "${fallbackOptions[i].modelId}": ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        }
      }
      
      // If we get here, all fallbacks failed
      throw new VLMError(
        VLMErrorCode.INIT_FAILED,
        `Failed to create VLM with primary model "${primaryOptions.modelId}" and all fallbacks`,
        { primaryOptions, fallbackOptions },
        false
      );
    }
  }
}

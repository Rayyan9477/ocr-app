/**
 * VLM Registry
 * 
 * Registry for VLM implementations that allows dynamic
 * registration and discovery of VLM models.
 */

import { VLMInterface } from './vlm-interface';
import { VLMCapability } from './vlm-capabilities';

/**
 * Constructor type for VLM implementations
 */
export type VLMImplementationConstructor = new () => VLMInterface;

/**
 * Registry entry for a VLM implementation
 */
export interface VLMRegistryEntry {
  /**
   * Unique identifier for this implementation
   */
  id: string;
  
  /**
   * Human-readable name
   */
  name: string;
  
  /**
   * Constructor for the implementation
   */
  implementation: VLMImplementationConstructor;
  
  /**
   * Supported deployment strategies
   */
  deploymentStrategies: ('local' | 'cloud' | 'hybrid')[];
  
  /**
   * Supported capabilities
   */
  capabilities: VLMCapability[];
  
  /**
   * Model size in MB (if known)
   */
  sizeInMB?: number;
  
  /**
   * Whether this is the default implementation
   */
  isDefault?: boolean;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Registry for VLM implementations
 */
export class VLMRegistry {
  private implementations: Map<string, VLMRegistryEntry> = new Map();
  private defaultImplementationId?: string;
  
  /**
   * Register a VLM implementation
   */
  register(entry: VLMRegistryEntry): void {
    this.implementations.set(entry.id, entry);
    
    // Set as default if specified or if it's the first implementation
    if (entry.isDefault || this.implementations.size === 1) {
      this.defaultImplementationId = entry.id;
    }
  }
  
  /**
   * Unregister a VLM implementation
   */
  unregister(id: string): boolean {
    const result = this.implementations.delete(id);
    
    // If we removed the default, set a new default if possible
    if (result && id === this.defaultImplementationId) {
      const entries = Array.from(this.implementations.values());
      this.defaultImplementationId = entries.length > 0 ? entries[0].id : undefined;
    }
    
    return result;
  }
  
  /**
   * Get a VLM implementation by ID and deployment strategy
   */
  getImplementation(
    id: string,
    deploymentStrategy: 'local' | 'cloud' | 'hybrid' = 'local'
  ): VLMImplementationConstructor | undefined {
    const entry = this.implementations.get(id);
    
    if (!entry) {
      return undefined;
    }
    
    // Check if the requested deployment strategy is supported
    if (!entry.deploymentStrategies.includes(deploymentStrategy)) {
      return undefined;
    }
    
    return entry.implementation;
  }
  
  /**
   * Get the default VLM implementation
   */
  getDefaultImplementation(): VLMImplementationConstructor | undefined {
    if (!this.defaultImplementationId) {
      return undefined;
    }
    
    const entry = this.implementations.get(this.defaultImplementationId);
    return entry?.implementation;
  }
  
  /**
   * Set a new default implementation
   */
  setDefaultImplementation(id: string): boolean {
    if (!this.implementations.has(id)) {
      return false;
    }
    
    this.defaultImplementationId = id;
    return true;
  }
  
  /**
   * Get all registered VLM implementations
   */
  getAllImplementations(): VLMRegistryEntry[] {
    return Array.from(this.implementations.values());
  }
  
  /**
   * Find implementations that support specific capabilities
   */
  findImplementationsWithCapabilities(
    capabilities: VLMCapability[],
    deploymentStrategy?: 'local' | 'cloud' | 'hybrid'
  ): VLMRegistryEntry[] {
    return Array.from(this.implementations.values()).filter(entry => {
      // Check deployment strategy if specified
      if (deploymentStrategy && !entry.deploymentStrategies.includes(deploymentStrategy)) {
        return false;
      }
      
      // Check if all required capabilities are supported
      return capabilities.every(capability => entry.capabilities.includes(capability));
    });
  }
}

// Create and export singleton instance
export const vlmRegistry = new VLMRegistry();
export default vlmRegistry;

/**
 * VLM Health Monitor
 * 
 * Monitors the health of VLM models and provides
 * diagnostics and recovery mechanisms.
 */

import { VLMInterface } from './vlm-interface';
import { VLMManager } from './vlm-manager';
import { VLMRegistry } from './vlm-registry';
import { VLMError, VLMErrorCode } from './vlm-error-types';
import { EventEmitter } from 'events';

/**
 * Health status of a VLM model
 */
export interface VLMHealthStatus {
  /**
   * Model ID
   */
  modelId: string;
  
  /**
   * Deployment strategy
   */
  deploymentStrategy: 'local' | 'cloud' | 'hybrid';
  
  /**
   * Whether the model is healthy
   */
  isHealthy: boolean;
  
  /**
   * Last check timestamp
   */
  lastCheckTime: Date;
  
  /**
   * Last error (if any)
   */
  lastError?: VLMError;
  
  /**
   * Memory usage in MB (if available)
   */
  memoryUsageMB?: number;
  
  /**
   * Average response time in ms (if available)
   */
  avgResponseTimeMs?: number;
  
  /**
   * Uptime in seconds (if available)
   */
  uptimeSeconds?: number;
  
  /**
   * Additional health metrics
   */
  metrics?: Record<string, any>;
}

/**
 * Health check options
 */
export interface HealthCheckOptions {
  /**
   * Timeout for health check in milliseconds
   */
  timeoutMs?: number;
  
  /**
   * Whether to force a fresh check (ignore cache)
   */
  force?: boolean;
  
  /**
   * Whether to include detailed metrics
   */
  detailed?: boolean;
}

/**
 * VLM Health Monitor
 */
export class VLMHealthMonitor extends EventEmitter {
  private manager: VLMManager;
  private registry: VLMRegistry;
  private healthStatuses: Map<string, VLMHealthStatus> = new Map();
  private checkInterval?: NodeJS.Timeout;
  private checkIntervalMs: number;
  
  constructor(
    manager: VLMManager,
    registry: VLMRegistry,
    checkIntervalMs = 60000 // Default to checking every minute
  ) {
    super();
    this.manager = manager;
    this.registry = registry;
    this.checkIntervalMs = checkIntervalMs;
  }
  
  /**
   * Start health monitoring
   */
  startMonitoring(): void {
    if (this.checkInterval) {
      return;
    }
    
    // Run an initial check
    this.checkAllModels().catch(error => {
      console.error('Error in initial health check:', error);
    });
    
    // Set up interval for regular checks
    this.checkInterval = setInterval(() => {
      this.checkAllModels().catch(error => {
        console.error('Error in scheduled health check:', error);
      });
    }, this.checkIntervalMs);
  }
  
  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }
  
  /**
   * Check health of all registered models
   */
  async checkAllModels(): Promise<Map<string, VLMHealthStatus>> {
    const implementationEntries = this.registry.getAllImplementations();
    const checkPromises: Promise<void>[] = [];
    
    for (const entry of implementationEntries) {
      for (const deploymentStrategy of entry.deploymentStrategies) {
        const cacheKey = `${entry.id}:${deploymentStrategy}`;
        
        checkPromises.push(
          this.checkModelHealth(entry.id, deploymentStrategy)
            .catch(error => {
              console.error(`Error checking health of ${cacheKey}:`, error);
              
              // Update status with error
              const currentStatus = this.healthStatuses.get(cacheKey) || {
                modelId: entry.id,
                deploymentStrategy,
                isHealthy: false,
                lastCheckTime: new Date()
              };
              
              this.healthStatuses.set(cacheKey, {
                ...currentStatus,
                isHealthy: false,
                lastCheckTime: new Date(),
                lastError: error instanceof VLMError ? error : new VLMError(
                  VLMErrorCode.UNKNOWN_ERROR,
                  `Unknown error checking health: ${error instanceof Error ? error.message : String(error)}`,
                  { originalError: error },
                  false
                )
              });
              
              // Emit error event
              this.emit('healthCheckError', {
                modelId: entry.id,
                deploymentStrategy,
                error
              });
            })
        );
      }
    }
    
    await Promise.all(checkPromises);
    return this.healthStatuses;
  }
  
  /**
   * Check health of a specific model
   */
  async checkModelHealth(
    modelId: string,
    deploymentStrategy: 'local' | 'cloud' | 'hybrid' = 'local',
    options: HealthCheckOptions = {}
  ): Promise<VLMHealthStatus> {
    const { timeoutMs = 10000, force = false, detailed = false } = options;
    const cacheKey = `${modelId}:${deploymentStrategy}`;
    
    // Get last status
    const lastStatus = this.healthStatuses.get(cacheKey);
    
    // If we have a recent status and not forcing a new check, return it
    if (
      !force &&
      lastStatus &&
      lastStatus.lastCheckTime.getTime() > Date.now() - this.checkIntervalMs
    ) {
      return lastStatus;
    }
    
    try {
      // Create a promise that times out
      const checkPromise = this.performHealthCheck(modelId, deploymentStrategy, detailed);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new VLMError(
            VLMErrorCode.TIMEOUT,
            `Health check timed out after ${timeoutMs}ms`,
            { modelId, deploymentStrategy, timeoutMs },
            true
          ));
        }, timeoutMs);
      });
      
      // Race the check against the timeout
      const status = await Promise.race([checkPromise, timeoutPromise]);
      
      // Update cache and emit event
      this.healthStatuses.set(cacheKey, status);
      this.emit('healthCheck', status);
      
      if (!status.isHealthy) {
        this.emit('modelUnhealthy', status);
      }
      
      return status;
    } catch (error) {
      // Create error status
      const errorStatus: VLMHealthStatus = {
        modelId,
        deploymentStrategy,
        isHealthy: false,
        lastCheckTime: new Date(),
        lastError: error instanceof VLMError ? error : new VLMError(
          VLMErrorCode.UNKNOWN_ERROR,
          `Unknown error checking health: ${error instanceof Error ? error.message : String(error)}`,
          { originalError: error },
          false
        )
      };
      
      // Update cache and emit event
      this.healthStatuses.set(cacheKey, errorStatus);
      this.emit('healthCheckError', {
        modelId,
        deploymentStrategy,
        error
      });
      
      return errorStatus;
    }
  }
  
  /**
   * Get health status for all models
   */
  getAllHealthStatuses(): Map<string, VLMHealthStatus> {
    return new Map(this.healthStatuses);
  }
  
  /**
   * Get health status for a specific model
   */
  getModelHealthStatus(
    modelId: string,
    deploymentStrategy: 'local' | 'cloud' | 'hybrid' = 'local'
  ): VLMHealthStatus | undefined {
    const cacheKey = `${modelId}:${deploymentStrategy}`;
    return this.healthStatuses.get(cacheKey);
  }
  
  /**
   * Perform the actual health check
   */
  private async performHealthCheck(
    modelId: string,
    deploymentStrategy: 'local' | 'cloud' | 'hybrid',
    detailed: boolean
  ): Promise<VLMHealthStatus> {
    let vlm: VLMInterface | undefined;
    
    try {
      // Get VLM instance
      vlm = await this.manager.getVLM({
        modelId,
        deploymentStrategy,
        initializeImmediately: true
      });
      
      // Check health
      const healthStatus = await vlm.getHealthStatus();
      
      return {
        modelId,
        deploymentStrategy,
        isHealthy: healthStatus.isHealthy,
        lastCheckTime: new Date(),
        lastError: healthStatus.lastError,
        metrics: detailed ? healthStatus.details : undefined
      };
    } catch (error) {
      return {
        modelId,
        deploymentStrategy,
        isHealthy: false,
        lastCheckTime: new Date(),
        lastError: error instanceof VLMError ? error : new VLMError(
          VLMErrorCode.UNKNOWN_ERROR,
          `Unknown error checking health: ${error instanceof Error ? error.message : String(error)}`,
          { originalError: error },
          false
        )
      };
    }
  }
}

// Create and export singleton instance
export const vlmHealthMonitor = new VLMHealthMonitor(
  require('./vlm-manager').vlmManager,
  require('./vlm-registry').vlmRegistry
);
export default vlmHealthMonitor;

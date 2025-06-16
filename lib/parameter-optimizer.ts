import fs from 'fs';
import path from 'path';
import logger from './logger';

interface ParameterRange {
  min: number;
  max: number;
  step: number;
}

interface OptimizationConfig {
  parameters: {
    [key: string]: ParameterRange;
  };
  documentTypes: string[];
}

export class ParameterOptimizer {
  private configPath: string;
  private config: OptimizationConfig;
  private optimizationResults: Map<string, any> = new Map();
  
  constructor(configPath = path.join(process.cwd(), 'config', 'optimization.json')) {
    this.configPath = configPath;
    
    try {
      if (fs.existsSync(configPath)) {
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } else {
        // Default configuration
        this.config = {
          parameters: {
            confidenceThreshold: { min: 0.1, max: 0.9, step: 0.1 },
            enhanceResolution: { min: 0, max: 1, step: 1 } // Boolean as 0 or 1
          },
          documentTypes: ['handwriting', 'table', 'poor_quality', 'general']
        };
        
        // Save default config
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
      }
    } catch (error) {
      logger.error(`Error loading optimization config: ${error}`);
      throw error;
    }
  }
  
  async findOptimalParameters(documentType: string, testDataPath: string, evaluationFn: Function) {
    if (!this.config.documentTypes.includes(documentType)) {
      throw new Error(`Unsupported document type: ${documentType}`);
    }
    
    logger.info(`Starting parameter optimization for ${documentType}`);
    
    const results = [];
    const parameterCombinations = this.generateParameterCombinations();
    
    for (const params of parameterCombinations) {
      try {
        const score = await evaluationFn(testDataPath, params);
        results.push({
          parameters: { ...params },
          score
        });
      } catch (error) {
        logger.error(`Error evaluating parameters ${JSON.stringify(params)}: ${error}`);
      }
    }
    
    // Sort by score (higher is better)
    results.sort((a, b) => b.score - a.score);
    
    // Store the best parameters
    this.optimizationResults.set(documentType, results[0]);
    
    logger.info(`Optimization complete for ${documentType}. Best parameters: ${JSON.stringify(results[0])}`);
    
    return results[0];
  }
  
  getOptimizedParameters(documentType: string) {
    if (this.optimizationResults.has(documentType)) {
      return this.optimizationResults.get(documentType).parameters;
    }
    
    logger.warn(`No optimized parameters available for ${documentType}. Using defaults.`);
    return {
      confidenceThreshold: 0.5,
      enhanceResolution: true
    };
  }
  
  private generateParameterCombinations() {
    const combinations: Array<Record<string, number>> = [];
    const paramNames = Object.keys(this.config.parameters);
    
    const generateCombination = (index: number, current: Record<string, number>) => {
      if (index === paramNames.length) {
        combinations.push({ ...current });
        return;
      }
      
      const paramName = paramNames[index];
      const range = this.config.parameters[paramName];
      
      for (let value = range.min; value <= range.max; value += range.step) {
        current[paramName] = value;
        generateCombination(index + 1, current);
      }
    };
    
    generateCombination(0, {});
    return combinations;
  }
}

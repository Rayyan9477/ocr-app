/**
 * Enhanced Configuration System with Mode-Aware Settings
 * 
 * This configuration system provides dynamic settings that adapt based on
 * the selected OCR mode and document characteristics.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import logger from './logger';
import { OCRMode } from './adaptive-mode-service';

// Enhanced configuration interfaces
export interface EnhancedOCRConfig {
  // Basic OCR settings
  defaultLanguage: string;
  enableOptimization: boolean;
  ocrTimeout: number;
  
  // Engine configurations per mode
  engineConfigs: Record<OCRMode, EngineConfig>;
  
  // Adaptive behavior settings
  adaptiveSettings: {
    enabled: boolean;
    learningEnabled: boolean;
    autoModeSelection: boolean;
    confidenceThreshold: number;
    performanceWeighting: {
      accuracy: number;
      speed: number;
      resourceUsage: number;
    };
  };
  
  // Mode-specific overrides
  modeOverrides: Record<OCRMode, Partial<OCRSettings>>;
  
  // Quality and performance settings
  qualitySettings: {
    minimumAcceptableConfidence: number;
    retryThreshold: number;
    maxRetries: number;
    escalationEnabled: boolean;
  };
  
  // Resource management
  resourceLimits: {
    maxMemoryMB: number;
    maxCpuPercent: number;
    maxConcurrentProcesses: number;
    timeoutPerMode: Record<OCRMode, number>;
  };
  
  // Preprocessing configurations
  preprocessingProfiles: Record<string, PreprocessingProfile>;
  
  // Postprocessing configurations
  postprocessingProfiles: Record<string, PostprocessingProfile>;
}

export interface EngineConfig {
  engines: string[];
  maxEngines: number;
  parallelProcessing: boolean;
  enginePriority: string[];
  fallbackEngines: string[];
  parameters: Record<string, any>;
}

export interface OCRSettings {
  language: string;
  psm: number;
  oem: number;
  timeout: number;
  retries: number;
  usePreprocessing: boolean;
  aggressivePreprocessing: boolean;
  usePostprocessing: boolean;
  preserveLayout: boolean;
  confidenceThreshold: number;
  customParameters: Record<string, any>;
}

export interface PreprocessingProfile {
  name: string;
  enabled: boolean;
  techniques: string[];
  parameters: Record<string, any>;
  conditions: {
    minQuality?: number;
    maxQuality?: number;
    documentTypes?: string[];
    modes?: OCRMode[];
  };
}

export interface PostprocessingProfile {
  name: string;
  enabled: boolean;
  techniques: string[];
  parameters: Record<string, any>;
  conditions: {
    minConfidence?: number;
    documentTypes?: string[];
    modes?: OCRMode[];
  };
}

export interface DynamicConfig {
  currentMode: OCRMode;
  activeProfile: string;
  runtimeSettings: OCRSettings;
  performanceMetrics: {
    averageAccuracy: number;
    averageSpeed: number;
    successRate: number;
  };
  lastUpdated: Date;
}

/**
 * Enhanced Configuration Manager with mode-aware settings
 */
export class EnhancedConfigManager {
  private config: EnhancedOCRConfig;
  private dynamicConfig: DynamicConfig;
  private configPath: string;
  private dynamicConfigPath: string;

  constructor(configDir: string = './config') {
    this.configPath = join(configDir, 'enhanced-ocr-config.json');
    this.dynamicConfigPath = join(configDir, 'dynamic-config.json');
    
    this.config = this.loadConfig();
    this.dynamicConfig = this.loadDynamicConfig();
  }

  /**
   * Load configuration from file or create default
   */
  private loadConfig(): EnhancedOCRConfig {
    if (existsSync(this.configPath)) {
      try {
        const configData = readFileSync(this.configPath, 'utf8');
        const loadedConfig = JSON.parse(configData);
        logger.info('Enhanced OCR configuration loaded from file');
        return this.validateAndMergeConfig(loadedConfig);
      } catch (error) {
        logger.warn(`Failed to load config from file: ${error}. Using defaults.`);
      }
    }

    logger.info('Creating default enhanced OCR configuration');
    return this.createDefaultConfig();
  }

  /**
   * Load dynamic configuration
   */
  private loadDynamicConfig(): DynamicConfig {
    if (existsSync(this.dynamicConfigPath)) {
      try {
        const configData = readFileSync(this.dynamicConfigPath, 'utf8');
        return JSON.parse(configData);
      } catch (error) {
        logger.warn(`Failed to load dynamic config: ${error}`);
      }
    }

    return this.createDefaultDynamicConfig();
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(): EnhancedOCRConfig {
    return {
      defaultLanguage: 'eng',
      enableOptimization: true,
      ocrTimeout: 600000,
      
      engineConfigs: {
        [OCRMode.FAST]: {
          engines: ['tesseract'],
          maxEngines: 1,
          parallelProcessing: false,
          enginePriority: ['tesseract'],
          fallbackEngines: ['ocrmypdf'],
          parameters: {
            psm: 1,
            oem: 3,
            config: 'fast'
          }
        },
        [OCRMode.BALANCED]: {
          engines: ['tesseract', 'ocrmypdf'],
          maxEngines: 2,
          parallelProcessing: true,
          enginePriority: ['tesseract', 'ocrmypdf'],
          fallbackEngines: ['enhanced-tesseract'],
          parameters: {
            psm: 1,
            oem: 3,
            ensemble: true
          }
        },
        [OCRMode.ACCURACY]: {
          engines: ['tesseract', 'ocrmypdf', 'enhanced-tesseract'],
          maxEngines: 3,
          parallelProcessing: true,
          enginePriority: ['tesseract', 'ocrmypdf', 'enhanced-tesseract'],
          fallbackEngines: [],
          parameters: {
            psm: 1,
            oem: 3,
            ensemble: true,
            multipass: true
          }
        },
        [OCRMode.MEDICAL]: {
          engines: ['tesseract', 'ocrmypdf', 'enhanced-tesseract'],
          maxEngines: 3,
          parallelProcessing: true,
          enginePriority: ['tesseract', 'ocrmypdf', 'enhanced-tesseract'],
          fallbackEngines: ['tf-vlm'],
          parameters: {
            psm: 1,
            oem: 3,
            medical: true,
            preserveLayout: true
          }
        },
        [OCRMode.HANDWRITTEN]: {
          engines: ['tesseract', 'enhanced-tesseract'],
          maxEngines: 2,
          parallelProcessing: true,
          enginePriority: ['enhanced-tesseract', 'tesseract'],
          fallbackEngines: ['tf-vlm'],
          parameters: {
            psm: 13,
            oem: 1,
            handwriting: true
          }
        },
        [OCRMode.DEGRADED]: {
          engines: ['tesseract', 'ocrmypdf'],
          maxEngines: 2,
          parallelProcessing: true,
          enginePriority: ['tesseract', 'ocrmypdf'],
          fallbackEngines: ['enhanced-tesseract', 'tf-vlm'],
          parameters: {
            psm: 1,
            oem: 3,
            aggressive: true
          }
        },
        [OCRMode.STRUCTURED]: {
          engines: ['tesseract', 'ocrmypdf'],
          maxEngines: 2,
          parallelProcessing: true,
          enginePriority: ['tesseract', 'ocrmypdf'],
          fallbackEngines: ['enhanced-tesseract'],
          parameters: {
            psm: 6,
            oem: 3,
            preserveLayout: true,
            tableDetection: true
          }
        },
        [OCRMode.MULTILINGUAL]: {
          engines: ['tesseract', 'enhanced-tesseract'],
          maxEngines: 2,
          parallelProcessing: true,
          enginePriority: ['enhanced-tesseract', 'tesseract'],
          fallbackEngines: ['ocrmypdf'],
          parameters: {
            psm: 1,
            oem: 3,
            multilingual: true
          }
        },
        [OCRMode.ADAPTIVE]: {
          engines: ['tesseract', 'ocrmypdf', 'enhanced-tesseract', 'tf-vlm'],
          maxEngines: 4,
          parallelProcessing: true,
          enginePriority: ['tesseract', 'ocrmypdf', 'enhanced-tesseract', 'tf-vlm'],
          fallbackEngines: [],
          parameters: {
            adaptive: true,
            autoSelect: true
          }
        },
        [OCRMode.EXPERIMENTAL]: {
          engines: ['tesseract', 'ocrmypdf', 'enhanced-tesseract', 'tf-vlm'],
          maxEngines: 4,
          parallelProcessing: true,
          enginePriority: ['enhanced-tesseract', 'tf-vlm', 'tesseract', 'ocrmypdf'],
          fallbackEngines: [],
          parameters: {
            experimental: true,
            cutting_edge: true
          }
        },
        [OCRMode.BATCH]: {
          engines: ['tesseract', 'ocrmypdf'],
          maxEngines: 2,
          parallelProcessing: true,
          enginePriority: ['tesseract', 'ocrmypdf'],
          fallbackEngines: [],
          parameters: {
            batch: true,
            optimized: true
          }
        },
        [OCRMode.REALTIME]: {
          engines: ['tesseract'],
          maxEngines: 1,
          parallelProcessing: false,
          enginePriority: ['tesseract'],
          fallbackEngines: [],
          parameters: {
            realtime: true,
            minimal: true
          }
        }
      },
      
      adaptiveSettings: {
        enabled: true,
        learningEnabled: true,
        autoModeSelection: true,
        confidenceThreshold: 0.7,
        performanceWeighting: {
          accuracy: 0.5,
          speed: 0.3,
          resourceUsage: 0.2
        }
      },
      
      modeOverrides: {
        [OCRMode.FAST]: {
          timeout: 60000,
          retries: 1,
          usePreprocessing: false,
          confidenceThreshold: 50
        },
        [OCRMode.BALANCED]: {
          timeout: 300000,
          retries: 2,
          usePreprocessing: true,
          confidenceThreshold: 70
        },
        [OCRMode.ACCURACY]: {
          timeout: 900000,
          retries: 3,
          usePreprocessing: true,
          aggressivePreprocessing: true,
          confidenceThreshold: 80
        },
        [OCRMode.MEDICAL]: {
          timeout: 600000,
          retries: 2,
          usePreprocessing: true,
          preserveLayout: true,
          confidenceThreshold: 75
        },
        [OCRMode.HANDWRITTEN]: {
          timeout: 450000,
          retries: 3,
          usePreprocessing: true,
          aggressivePreprocessing: true,
          confidenceThreshold: 60
        },
        [OCRMode.DEGRADED]: {
          timeout: 600000,
          retries: 3,
          usePreprocessing: true,
          aggressivePreprocessing: true,
          confidenceThreshold: 50
        },
        [OCRMode.STRUCTURED]: {
          timeout: 450000,
          retries: 2,
          usePreprocessing: true,
          preserveLayout: true,
          confidenceThreshold: 75
        },
        [OCRMode.MULTILINGUAL]: {
          timeout: 500000,
          retries: 2,
          usePreprocessing: true,
          confidenceThreshold: 65
        },
        [OCRMode.ADAPTIVE]: {
          timeout: 600000,
          retries: 3,
          usePreprocessing: true,
          confidenceThreshold: 70
        },
        [OCRMode.EXPERIMENTAL]: {
          timeout: 1200000,
          retries: 4,
          usePreprocessing: true,
          aggressivePreprocessing: true,
          confidenceThreshold: 60
        },
        [OCRMode.BATCH]: {
          timeout: 180000,
          retries: 1,
          usePreprocessing: false,
          confidenceThreshold: 60
        },
        [OCRMode.REALTIME]: {
          timeout: 30000,
          retries: 0,
          usePreprocessing: false,
          confidenceThreshold: 40
        }
      },
      
      qualitySettings: {
        minimumAcceptableConfidence: 50,
        retryThreshold: 70,
        maxRetries: 3,
        escalationEnabled: true
      },
      
      resourceLimits: {
        maxMemoryMB: 4096,
        maxCpuPercent: 80,
        maxConcurrentProcesses: 4,
        timeoutPerMode: {
          [OCRMode.FAST]: 60000,
          [OCRMode.BALANCED]: 300000,
          [OCRMode.ACCURACY]: 900000,
          [OCRMode.MEDICAL]: 600000,
          [OCRMode.HANDWRITTEN]: 450000,
          [OCRMode.DEGRADED]: 600000,
          [OCRMode.STRUCTURED]: 450000,
          [OCRMode.MULTILINGUAL]: 500000,
          [OCRMode.ADAPTIVE]: 600000,
          [OCRMode.EXPERIMENTAL]: 1200000,
          [OCRMode.BATCH]: 180000,
          [OCRMode.REALTIME]: 30000
        }
      },
      
      preprocessingProfiles: {
        'none': {
          name: 'none',
          enabled: false,
          techniques: [],
          parameters: {},
          conditions: {}
        },
        'basic': {
          name: 'basic',
          enabled: true,
          techniques: ['deskew', 'normalize'],
          parameters: {
            deskew_threshold: 0.1,
            normalize_method: 'histogram'
          },
          conditions: {
            modes: [OCRMode.BALANCED, OCRMode.STRUCTURED]
          }
        },
        'aggressive': {
          name: 'aggressive',
          enabled: true,
          techniques: ['deskew', 'normalize', 'denoise', 'enhance_contrast', 'sharpen', 'despeckle'],
          parameters: {
            deskew_threshold: 0.05,
            normalize_method: 'clahe',
            denoise_strength: 'medium',
            contrast_enhancement: 1.2,
            sharpen_radius: 1.0
          },
          conditions: {
            modes: [OCRMode.ACCURACY, OCRMode.DEGRADED, OCRMode.HANDWRITTEN],
            maxQuality: 70
          }
        },
        'medical': {
          name: 'medical',
          enabled: true,
          techniques: ['deskew', 'normalize', 'enhance_contrast', 'medical_enhance'],
          parameters: {
            medical_dictionary: true,
            preserve_medical_symbols: true,
            enhance_small_text: true
          },
          conditions: {
            modes: [OCRMode.MEDICAL],
            documentTypes: ['medical', 'healthcare', 'insurance']
          }
        },
        'handwriting': {
          name: 'handwriting',
          enabled: true,
          techniques: ['deskew', 'normalize', 'denoise', 'binarize', 'morphology'],
          parameters: {
            binarization_method: 'adaptive',
            morphology_kernel: 'ellipse',
            morphology_size: 2
          },
          conditions: {
            modes: [OCRMode.HANDWRITTEN],
            documentTypes: ['handwritten', 'notes', 'forms']
          }
        }
      },
      
      postprocessingProfiles: {
        'none': {
          name: 'none',
          enabled: false,
          techniques: [],
          parameters: {},
          conditions: {}
        },
        'basic': {
          name: 'basic',
          enabled: true,
          techniques: ['confidence_filter', 'spellcheck'],
          parameters: {
            min_confidence: 60,
            spellcheck_language: 'en'
          },
          conditions: {
            modes: [OCRMode.BALANCED, OCRMode.FAST]
          }
        },
        'advanced': {
          name: 'advanced',
          enabled: true,
          techniques: ['confidence_filter', 'spellcheck', 'grammar_check', 'context_analysis'],
          parameters: {
            min_confidence: 70,
            spellcheck_language: 'en',
            grammar_check_enabled: true,
            context_window: 5
          },
          conditions: {
            modes: [OCRMode.ACCURACY, OCRMode.MEDICAL],
            minConfidence: 70
          }
        },
        'medical': {
          name: 'medical',
          enabled: true,
          techniques: ['medical_terminology', 'date_extraction', 'code_validation', 'address_extraction'],
          parameters: {
            medical_dictionary: true,
            code_formats: ['ICD10', 'CPT', 'HCPCS'],
            date_formats: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
            address_validation: true
          },
          conditions: {
            modes: [OCRMode.MEDICAL],
            documentTypes: ['medical', 'healthcare']
          }
        }
      }
    };
  }

  /**
   * Create default dynamic configuration
   */
  private createDefaultDynamicConfig(): DynamicConfig {
    return {
      currentMode: OCRMode.BALANCED,
      activeProfile: 'basic',
      runtimeSettings: {
        language: 'eng',
        psm: 1,
        oem: 3,
        timeout: 300000,
        retries: 2,
        usePreprocessing: true,
        aggressivePreprocessing: false,
        usePostprocessing: true,
        preserveLayout: false,
        confidenceThreshold: 70,
        customParameters: {}
      },
      performanceMetrics: {
        averageAccuracy: 0,
        averageSpeed: 0,
        successRate: 0
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Validate and merge loaded configuration with defaults
   */
  private validateAndMergeConfig(loadedConfig: any): EnhancedOCRConfig {
    const defaultConfig = this.createDefaultConfig();
    
    // Deep merge configurations
    return this.deepMerge(defaultConfig, loadedConfig);
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Get configuration for specific mode
   */
  getModeConfig(mode: OCRMode): EngineConfig & Partial<OCRSettings> {
    const engineConfig = this.config.engineConfigs[mode];
    const modeOverrides = this.config.modeOverrides[mode] || {};
    
    return {
      ...engineConfig,
      ...modeOverrides
    };
  }

  /**
   * Get preprocessing profile for mode and document characteristics
   */
  getPreprocessingProfile(mode: OCRMode, documentType?: string, quality?: number): PreprocessingProfile {
    for (const profile of Object.values(this.config.preprocessingProfiles)) {
      if (this.profileMatches(profile, mode, documentType, quality)) {
        return profile;
      }
    }
    
    return this.config.preprocessingProfiles['basic'];
  }

  /**
   * Get postprocessing profile for mode and document characteristics
   */
  getPostprocessingProfile(mode: OCRMode, documentType?: string, confidence?: number): PostprocessingProfile {
    for (const profile of Object.values(this.config.postprocessingProfiles)) {
      if (this.profileMatches(profile, mode, documentType, undefined, confidence)) {
        return profile;
      }
    }
    
    return this.config.postprocessingProfiles['basic'];
  }

  /**
   * Check if a profile matches the given conditions
   */
  private profileMatches(
    profile: PreprocessingProfile | PostprocessingProfile,
    mode: OCRMode,
    documentType?: string,
    quality?: number,
    confidence?: number
  ): boolean {
    const conditions = profile.conditions;
    
    // Check mode conditions
    if (conditions.modes && !conditions.modes.includes(mode)) {
      return false;
    }
    
    // Check document type conditions
    if (conditions.documentTypes && documentType && !conditions.documentTypes.includes(documentType)) {
      return false;
    }
    
    // Check quality conditions (only for preprocessing profiles)
    if (quality !== undefined && 'minQuality' in conditions) {
      if (conditions.minQuality && quality < conditions.minQuality) return false;
      if (conditions.maxQuality && quality > conditions.maxQuality) return false;
    }
    
    // Check confidence conditions (only for postprocessing profiles)
    if (confidence !== undefined && 'minConfidence' in conditions) {
      if (conditions.minConfidence && confidence < conditions.minConfidence) return false;
    }
    
    return true;
  }

  /**
   * Update dynamic configuration
   */
  updateDynamicConfig(updates: Partial<DynamicConfig>): void {
    this.dynamicConfig = {
      ...this.dynamicConfig,
      ...updates,
      lastUpdated: new Date()
    };
    
    this.saveDynamicConfig();
  }

  /**
   * Update runtime settings based on mode and conditions
   */
  updateRuntimeSettings(mode: OCRMode, documentType?: string, quality?: number): OCRSettings {
    const modeConfig = this.getModeConfig(mode);
    const baseSettings = this.dynamicConfig.runtimeSettings;
    
    // Update based on mode configuration
    const updatedSettings: OCRSettings = {
      ...baseSettings,
      ...modeConfig,
      timeout: this.config.resourceLimits.timeoutPerMode[mode]
    };
    
    this.dynamicConfig.runtimeSettings = updatedSettings;
    this.dynamicConfig.currentMode = mode;
    this.dynamicConfig.lastUpdated = new Date();
    
    this.saveDynamicConfig();
    
    return updatedSettings;
  }

  /**
   * Get current configuration
   */
  getConfig(): EnhancedOCRConfig {
    return this.config;
  }

  /**
   * Get current dynamic configuration
   */
  getDynamicConfig(): DynamicConfig {
    return this.dynamicConfig;
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(accuracy: number, speed: number, success: boolean): void {
    const metrics = this.dynamicConfig.performanceMetrics;
    const count = 10; // Simple moving average over last 10 operations
    
    metrics.averageAccuracy = (metrics.averageAccuracy * (count - 1) + accuracy) / count;
    metrics.averageSpeed = (metrics.averageSpeed * (count - 1) + speed) / count;
    metrics.successRate = (metrics.successRate * (count - 1) + (success ? 1 : 0)) / count;
    
    this.dynamicConfig.lastUpdated = new Date();
    this.saveDynamicConfig();
  }

  /**
   * Save configuration to file
   */
  saveConfig(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      logger.info('Enhanced OCR configuration saved');
    } catch (error) {
      logger.error(`Failed to save configuration: ${error}`);
    }
  }

  /**
   * Save dynamic configuration to file
   */
  private saveDynamicConfig(): void {
    try {
      writeFileSync(this.dynamicConfigPath, JSON.stringify(this.dynamicConfig, null, 2));
    } catch (error) {
      logger.error(`Failed to save dynamic configuration: ${error}`);
    }
  }

  /**
   * Reload configuration from file
   */
  reloadConfig(): void {
    this.config = this.loadConfig();
    this.dynamicConfig = this.loadDynamicConfig();
    logger.info('Configuration reloaded');
  }

  /**
   * Validate current configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate basic settings
    if (!this.config.defaultLanguage) {
      errors.push('Default language not specified');
    }
    
    if (this.config.ocrTimeout <= 0) {
      errors.push('Invalid OCR timeout value');
    }
    
    // Validate engine configurations
    for (const [mode, engineConfig] of Object.entries(this.config.engineConfigs)) {
      if (!engineConfig.engines || engineConfig.engines.length === 0) {
        errors.push(`No engines configured for mode: ${mode}`);
      }
      
      if (engineConfig.maxEngines <= 0) {
        errors.push(`Invalid maxEngines value for mode: ${mode}`);
      }
    }
    
    // Validate resource limits
    if (this.config.resourceLimits.maxMemoryMB <= 0) {
      errors.push('Invalid memory limit');
    }
    
    if (this.config.resourceLimits.maxCpuPercent <= 0 || this.config.resourceLimits.maxCpuPercent > 100) {
      errors.push('Invalid CPU limit');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const enhancedConfigManager = new EnhancedConfigManager();
export default enhancedConfigManager;

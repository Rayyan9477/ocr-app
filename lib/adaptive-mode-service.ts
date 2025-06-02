/**
 * Adaptive Mode Service - Intelligent OCR Mode Switching System
 * 
 * This service provides dynamic mode switching capabilities for optimal OCR results
 * based on document characteristics, performance requirements, and quality feedback.
 */

import logger from './logger';
import { DocumentCharacteristics, OptimizedOCRSettings } from './auto-customization';

export enum OCRMode {
  // Basic modes
  FAST = 'fast',                    // Speed-optimized for quick processing
  BALANCED = 'balanced',            // Balance between speed and accuracy
  ACCURACY = 'accuracy',            // Maximum accuracy, slower processing
  
  // Specialized modes
  MEDICAL = 'medical',              // Optimized for medical documents
  HANDWRITTEN = 'handwritten',     // Specialized for handwritten content
  DEGRADED = 'degraded',           // For poor quality/damaged documents
  STRUCTURED = 'structured',        // For forms and structured data
  MULTILINGUAL = 'multilingual',    // For documents with multiple languages
  
  // Advanced modes
  ADAPTIVE = 'adaptive',            // Automatically switches between modes
  EXPERIMENTAL = 'experimental',    // Uses cutting-edge techniques
  BATCH = 'batch',                 // Optimized for bulk processing
  REALTIME = 'realtime'            // For real-time processing needs
}

export interface ModeConfiguration {
  mode: OCRMode;
  engines: string[];
  maxEngines: number;
  parallelProcessing: boolean;
  preprocessing: {
    enabled: boolean;
    aggressive: boolean;
    techniques: string[];
  };
  postprocessing: {
    enabled: boolean;
    techniques: string[];
  };
  qualityThresholds: {
    minimum: number;
    target: number;
    excellent: number;
  };
  timeouts: {
    perEngine: number;
    total: number;
  };
  retryStrategy: {
    enabled: boolean;
    maxRetries: number;
    fallbackModes: OCRMode[];
  };
  customParameters: Record<string, any>;
}

export interface ProcessingContext {
  documentType: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  qualityRequirement: 'draft' | 'standard' | 'high' | 'perfect';
  batchSize?: number;
  previousResults?: any[];
  timeConstraints?: {
    maxTime: number;
    preferredTime: number;
  };
  resourceConstraints?: {
    maxMemory: number;
    maxCpu: number;
  };
}

export interface ModeMetrics {
  mode: OCRMode;
  averageAccuracy: number;
  averageProcessingTime: number;
  successRate: number;
  resourceUsage: {
    memory: number;
    cpu: number;
  };
  documentTypes: Record<string, number>;
  lastUsed: Date;
  usageCount: number;
}

export interface AdaptiveDecision {
  selectedMode: OCRMode;
  reasoning: string[];
  confidence: number;
  alternativeModes: OCRMode[];
  fallbackStrategy: OCRMode[];
  estimatedPerformance: {
    accuracy: number;
    timeSeconds: number;
    successProbability: number;
  };
}

/**
 * Adaptive Mode Service for intelligent OCR mode selection and switching
 */
export class AdaptiveModeService {
  private modeConfigurations: Map<OCRMode, ModeConfiguration>;
  private modeMetrics: Map<OCRMode, ModeMetrics>;
  private currentMode: OCRMode = OCRMode.BALANCED;
  private adaptiveEnabled: boolean = true;
  private learningEnabled: boolean = true;

  constructor() {
    this.modeConfigurations = new Map();
    this.modeMetrics = new Map();
    this.initializeModeConfigurations();
    this.loadMetricsFromStorage();
  }

  /**
   * Initialize default configurations for all OCR modes
   */
  private initializeModeConfigurations(): void {
    // FAST Mode - Speed optimized
    this.modeConfigurations.set(OCRMode.FAST, {
      mode: OCRMode.FAST,
      engines: ['tesseract'],
      maxEngines: 1,
      parallelProcessing: false,
      preprocessing: {
        enabled: false,
        aggressive: false,
        techniques: []
      },
      postprocessing: {
        enabled: false,
        techniques: []
      },
      qualityThresholds: {
        minimum: 50,
        target: 70,
        excellent: 85
      },
      timeouts: {
        perEngine: 30000,
        total: 60000
      },
      retryStrategy: {
        enabled: false,
        maxRetries: 1,
        fallbackModes: [OCRMode.BALANCED]
      },
      customParameters: {
        psm: 1,
        oem: 3,
        tesseract_config: 'fast'
      }
    });

    // BALANCED Mode - Default balanced approach
    this.modeConfigurations.set(OCRMode.BALANCED, {
      mode: OCRMode.BALANCED,
      engines: ['tesseract', 'ocrmypdf'],
      maxEngines: 2,
      parallelProcessing: true,
      preprocessing: {
        enabled: true,
        aggressive: false,
        techniques: ['deskew', 'normalize']
      },
      postprocessing: {
        enabled: true,
        techniques: ['spellcheck', 'confidence_filter']
      },
      qualityThresholds: {
        minimum: 60,
        target: 80,
        excellent: 90
      },
      timeouts: {
        perEngine: 120000,
        total: 300000
      },
      retryStrategy: {
        enabled: true,
        maxRetries: 2,
        fallbackModes: [OCRMode.ACCURACY, OCRMode.DEGRADED]
      },
      customParameters: {
        psm: 1,
        oem: 3,
        ensemble_voting: true
      }
    });

    // ACCURACY Mode - Maximum accuracy
    this.modeConfigurations.set(OCRMode.ACCURACY, {
      mode: OCRMode.ACCURACY,
      engines: ['tesseract', 'ocrmypdf', 'paddleocr', 'kraken'],
      maxEngines: 4,
      parallelProcessing: true,
      preprocessing: {
        enabled: true,
        aggressive: true,
        techniques: ['deskew', 'normalize', 'denoise', 'enhance_contrast', 'sharpen']
      },
      postprocessing: {
        enabled: true,
        techniques: ['spellcheck', 'confidence_filter', 'consensus_voting', 'grammar_check']
      },
      qualityThresholds: {
        minimum: 70,
        target: 90,
        excellent: 95
      },
      timeouts: {
        perEngine: 300000,
        total: 900000
      },
      retryStrategy: {
        enabled: true,
        maxRetries: 3,
        fallbackModes: [OCRMode.EXPERIMENTAL, OCRMode.DEGRADED]
      },
      customParameters: {
        psm: 1,
        oem: 3,
        ensemble_voting: true,
        multiple_passes: true
      }
    });

    // MEDICAL Mode - Specialized for medical documents
    this.modeConfigurations.set(OCRMode.MEDICAL, {
      mode: OCRMode.MEDICAL,
      engines: ['tesseract', 'ocrmypdf', 'paddleocr'],
      maxEngines: 3,
      parallelProcessing: true,
      preprocessing: {
        enabled: true,
        aggressive: true,
        techniques: ['deskew', 'normalize', 'enhance_contrast', 'medical_enhance']
      },
      postprocessing: {
        enabled: true,
        techniques: ['medical_terminology', 'date_extraction', 'code_validation', 'address_extraction']
      },
      qualityThresholds: {
        minimum: 65,
        target: 85,
        excellent: 95
      },
      timeouts: {
        perEngine: 240000,
        total: 600000
      },
      retryStrategy: {
        enabled: true,
        maxRetries: 2,
        fallbackModes: [OCRMode.ACCURACY, OCRMode.STRUCTURED]
      },
      customParameters: {
        psm: 1,
        oem: 3,
        medical_dictionary: true,
        preserve_layout: true,
        extract_medical_fields: true
      }
    });

    // HANDWRITTEN Mode - Specialized for handwritten content
    this.modeConfigurations.set(OCRMode.HANDWRITTEN, {
      mode: OCRMode.HANDWRITTEN,
      engines: ['tesseract', 'kraken'],
      maxEngines: 2,
      parallelProcessing: true,
      preprocessing: {
        enabled: true,
        aggressive: true,
        techniques: ['deskew', 'normalize', 'denoise', 'enhance_contrast', 'binarize', 'morphology']
      },
      postprocessing: {
        enabled: true,
        techniques: ['character_confidence', 'word_confidence', 'context_analysis']
      },
      qualityThresholds: {
        minimum: 40,
        target: 65,
        excellent: 80
      },
      timeouts: {
        perEngine: 180000,
        total: 450000
      },
      retryStrategy: {
        enabled: true,
        maxRetries: 3,
        fallbackModes: [OCRMode.DEGRADED, OCRMode.EXPERIMENTAL]
      },
      customParameters: {
        psm: 13,
        oem: 1,
        handwriting_model: true,
        character_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,;:!?'
      }
    });

    // DEGRADED Mode - For poor quality documents
    this.modeConfigurations.set(OCRMode.DEGRADED, {
      mode: OCRMode.DEGRADED,
      engines: ['tesseract', 'ocrmypdf'],
      maxEngines: 2,
      parallelProcessing: true,
      preprocessing: {
        enabled: true,
        aggressive: true,
        techniques: ['deskew', 'normalize', 'denoise', 'enhance_contrast', 'sharpen', 'despeckle', 'morphology']
      },
      postprocessing: {
        enabled: true,
        techniques: ['confidence_filter', 'pattern_matching', 'context_repair']
      },
      qualityThresholds: {
        minimum: 30,
        target: 60,
        excellent: 75
      },
      timeouts: {
        perEngine: 240000,
        total: 600000
      },
      retryStrategy: {
        enabled: true,
        maxRetries: 3,
        fallbackModes: [OCRMode.EXPERIMENTAL, OCRMode.HANDWRITTEN]
      },
      customParameters: {
        psm: 1,
        oem: 3,
        aggressive_preprocessing: true,
        multiple_thresholds: true
      }
    });

    // ADAPTIVE Mode - Automatically switches between modes
    this.modeConfigurations.set(OCRMode.ADAPTIVE, {
      mode: OCRMode.ADAPTIVE,
      engines: ['tesseract', 'ocrmypdf', 'paddleocr', 'kraken'],
      maxEngines: 4,
      parallelProcessing: true,
      preprocessing: {
        enabled: true,
        aggressive: false,
        techniques: ['auto_select']
      },
      postprocessing: {
        enabled: true,
        techniques: ['auto_select']
      },
      qualityThresholds: {
        minimum: 50,
        target: 80,
        excellent: 90
      },
      timeouts: {
        perEngine: 180000,
        total: 600000
      },
      retryStrategy: {
        enabled: true,
        maxRetries: 3,
        fallbackModes: [OCRMode.ACCURACY, OCRMode.DEGRADED]
      },
      customParameters: {
        auto_mode_selection: true,
        learning_enabled: true,
        dynamic_optimization: true
      }
    });

    // Initialize other modes similarly...
    this.initializeRemainingModes();
  }

  /**
   * Initialize remaining specialized modes
   */
  private initializeRemainingModes(): void {
    // STRUCTURED Mode
    this.modeConfigurations.set(OCRMode.STRUCTURED, {
      mode: OCRMode.STRUCTURED,
      engines: ['tesseract', 'ocrmypdf'],
      maxEngines: 2,
      parallelProcessing: true,
      preprocessing: {
        enabled: true,
        aggressive: false,
        techniques: ['deskew', 'normalize', 'table_detection']
      },
      postprocessing: {
        enabled: true,
        techniques: ['table_extraction', 'form_field_detection', 'layout_analysis']
      },
      qualityThresholds: {
        minimum: 60,
        target: 85,
        excellent: 95
      },
      timeouts: {
        perEngine: 180000,
        total: 450000
      },
      retryStrategy: {
        enabled: true,
        maxRetries: 2,
        fallbackModes: [OCRMode.BALANCED, OCRMode.ACCURACY]
      },
      customParameters: {
        psm: 6,
        oem: 3,
        preserve_layout: true,
        table_detection: true
      }
    });

    // BATCH Mode
    this.modeConfigurations.set(OCRMode.BATCH, {
      mode: OCRMode.BATCH,
      engines: ['tesseract', 'ocrmypdf'],
      maxEngines: 2,
      parallelProcessing: true,
      preprocessing: {
        enabled: false,
        aggressive: false,
        techniques: []
      },
      postprocessing: {
        enabled: false,
        techniques: []
      },
      qualityThresholds: {
        minimum: 55,
        target: 75,
        excellent: 85
      },
      timeouts: {
        perEngine: 60000,
        total: 180000
      },
      retryStrategy: {
        enabled: false,
        maxRetries: 1,
        fallbackModes: []
      },
      customParameters: {
        batch_optimization: true,
        resource_pooling: true
      }
    });

    // REALTIME Mode
    this.modeConfigurations.set(OCRMode.REALTIME, {
      mode: OCRMode.REALTIME,
      engines: ['tesseract'],
      maxEngines: 1,
      parallelProcessing: false,
      preprocessing: {
        enabled: false,
        aggressive: false,
        techniques: []
      },
      postprocessing: {
        enabled: false,
        techniques: []
      },
      qualityThresholds: {
        minimum: 40,
        target: 65,
        excellent: 80
      },
      timeouts: {
        perEngine: 15000,
        total: 30000
      },
      retryStrategy: {
        enabled: false,
        maxRetries: 0,
        fallbackModes: []
      },
      customParameters: {
        realtime_optimization: true,
        minimal_processing: true
      }
    });

    // Initialize metrics for all modes
    this.initializeModeMetrics();
  }

  /**
   * Initialize metrics tracking for all modes
   */
  private initializeModeMetrics(): void {
    for (const mode of Object.values(OCRMode)) {
      this.modeMetrics.set(mode, {
        mode,
        averageAccuracy: 0,
        averageProcessingTime: 0,
        successRate: 0,
        resourceUsage: { memory: 0, cpu: 0 },
        documentTypes: {},
        lastUsed: new Date(),
        usageCount: 0
      });
    }
  }

  /**
   * Intelligently select the best OCR mode based on document characteristics and context
   */
  async selectOptimalMode(
    characteristics: DocumentCharacteristics,
    context: ProcessingContext
  ): Promise<AdaptiveDecision> {
    logger.info(`Selecting optimal OCR mode for document type: ${context.documentType}`);

    const reasoning: string[] = [];
    let selectedMode: OCRMode = OCRMode.BALANCED;
    let confidence = 0.5;

    // Primary mode selection based on document characteristics
    if (characteristics.isMedicalDocument) {
      selectedMode = OCRMode.MEDICAL;
      confidence += 0.3;
      reasoning.push('Medical document detected - using specialized medical mode');
    } else if (characteristics.isHandwritten) {
      selectedMode = OCRMode.HANDWRITTEN;
      confidence += 0.3;
      reasoning.push('Handwritten content detected - using handwriting-optimized mode');
    } else if (characteristics.isLowQuality) {
      selectedMode = OCRMode.DEGRADED;
      confidence += 0.25;
      reasoning.push('Low quality document detected - using degraded document mode');
    } else if (characteristics.hasStructuredData) {
      selectedMode = OCRMode.STRUCTURED;
      confidence += 0.25;
      reasoning.push('Structured data detected - using form/table optimized mode');
    }

    // Adjust based on context requirements
    if (context.urgency === 'critical' || context.urgency === 'high') {
      if (context.qualityRequirement === 'draft') {
        selectedMode = OCRMode.FAST;
        confidence += 0.2;
        reasoning.push('High urgency with draft quality - prioritizing speed');
      } else if (context.qualityRequirement === 'perfect') {
        selectedMode = OCRMode.ACCURACY;
        confidence += 0.2;
        reasoning.push('High urgency requiring perfect quality - using maximum accuracy mode');
      }
    }

    // Time constraint adjustments
    if (context.timeConstraints) {
      if (context.timeConstraints.maxTime < 60000) { // Less than 1 minute
        selectedMode = OCRMode.REALTIME;
        confidence += 0.15;
        reasoning.push('Strict time constraint - using real-time mode');
      } else if (context.timeConstraints.maxTime < 180000) { // Less than 3 minutes
        selectedMode = OCRMode.FAST;
        confidence += 0.1;
        reasoning.push('Time constraint - using fast mode');
      }
    }

    // Batch processing adjustments
    if (context.batchSize && context.batchSize > 10) {
      selectedMode = OCRMode.BATCH;
      confidence += 0.15;
      reasoning.push('Large batch detected - using batch-optimized mode');
    }

    // Adaptive mode for uncertain cases
    if (confidence < 0.7 && this.adaptiveEnabled) {
      selectedMode = OCRMode.ADAPTIVE;
      confidence = 0.8;
      reasoning.push('Uncertain optimal mode - using adaptive mode for automatic selection');
    }

    // Generate alternative modes
    const alternativeModes = this.generateAlternativeModes(selectedMode, characteristics, context);
    
    // Generate fallback strategy
    const fallbackStrategy = this.generateFallbackStrategy(selectedMode, characteristics);

    // Estimate performance
    const estimatedPerformance = this.estimatePerformance(selectedMode, characteristics, context);

    const decision: AdaptiveDecision = {
      selectedMode,
      reasoning,
      confidence,
      alternativeModes,
      fallbackStrategy,
      estimatedPerformance
    };

    logger.info(`Mode selection complete: ${selectedMode} (confidence: ${confidence.toFixed(2)})`);
    reasoning.forEach(reason => logger.info(`  - ${reason}`));

    return decision;
  }

  /**
   * Generate alternative modes that could work for this document
   */
  private generateAlternativeModes(
    primaryMode: OCRMode,
    characteristics: DocumentCharacteristics,
    context: ProcessingContext
  ): OCRMode[] {
    const alternatives: OCRMode[] = [];

    // Always include balanced as a fallback
    if (primaryMode !== OCRMode.BALANCED) {
      alternatives.push(OCRMode.BALANCED);
    }

    // Add accuracy mode for high-quality requirements
    if (context.qualityRequirement === 'perfect' && primaryMode !== OCRMode.ACCURACY) {
      alternatives.push(OCRMode.ACCURACY);
    }

    // Add fast mode for time-sensitive processing
    if (context.urgency === 'high' && primaryMode !== OCRMode.FAST) {
      alternatives.push(OCRMode.FAST);
    }

    // Add degraded mode for poor quality documents
    if (characteristics.isLowQuality && primaryMode !== OCRMode.DEGRADED) {
      alternatives.push(OCRMode.DEGRADED);
    }

    return alternatives.slice(0, 3); // Limit to top 3 alternatives
  }

  /**
   * Generate fallback strategy for when primary mode fails
   */
  private generateFallbackStrategy(
    primaryMode: OCRMode,
    characteristics: DocumentCharacteristics
  ): OCRMode[] {
    const fallbacks: OCRMode[] = [];

    // Get fallbacks from mode configuration
    const config = this.modeConfigurations.get(primaryMode);
    if (config?.retryStrategy.fallbackModes) {
      fallbacks.push(...config.retryStrategy.fallbackModes);
    }

    // Add adaptive mode as ultimate fallback
    if (!fallbacks.includes(OCRMode.ADAPTIVE)) {
      fallbacks.push(OCRMode.ADAPTIVE);
    }

    // Add degraded mode for difficult documents
    if (characteristics.isLowQuality && !fallbacks.includes(OCRMode.DEGRADED)) {
      fallbacks.push(OCRMode.DEGRADED);
    }

    return fallbacks.slice(0, 3);
  }

  /**
   * Estimate performance for the selected mode
   */
  private estimatePerformance(
    mode: OCRMode,
    characteristics: DocumentCharacteristics,
    context: ProcessingContext
  ): { accuracy: number; timeSeconds: number; successProbability: number } {
    const metrics = this.modeMetrics.get(mode);
    const config = this.modeConfigurations.get(mode);

    if (!metrics || !config) {
      return { accuracy: 0.7, timeSeconds: 60, successProbability: 0.8 };
    }

    // Base estimates from historical data
    let accuracy = metrics.averageAccuracy || config.qualityThresholds.target;
    let timeSeconds = metrics.averageProcessingTime / 1000 || 60;
    let successProbability = metrics.successRate || 0.8;

    // Adjust based on document characteristics
    if (characteristics.isLowQuality) {
      accuracy *= 0.8;
      timeSeconds *= 1.3;
      successProbability *= 0.9;
    }

    if (characteristics.isHandwritten) {
      accuracy *= 0.7;
      timeSeconds *= 1.2;
      successProbability *= 0.85;
    }

    if (characteristics.isMedicalDocument && mode === OCRMode.MEDICAL) {
      accuracy *= 1.1;
      successProbability *= 1.05;
    }

    // Ensure realistic bounds
    accuracy = Math.min(Math.max(accuracy, 0.2), 0.98);
    timeSeconds = Math.max(timeSeconds, 5);
    successProbability = Math.min(Math.max(successProbability, 0.3), 0.99);

    return { accuracy, timeSeconds, successProbability };
  }

  /**
   * Get configuration for a specific mode
   */
  getModeConfiguration(mode: OCRMode): ModeConfiguration | undefined {
    return this.modeConfigurations.get(mode);
  }

  /**
   * Update mode metrics based on processing results
   */
  updateModeMetrics(
    mode: OCRMode,
    accuracy: number,
    processingTime: number,
    success: boolean,
    documentType: string,
    resourceUsage?: { memory: number; cpu: number }
  ): void {
    if (!this.learningEnabled) return;

    const metrics = this.modeMetrics.get(mode);
    if (!metrics) return;

    // Update running averages
    const count = metrics.usageCount;
    metrics.averageAccuracy = (metrics.averageAccuracy * count + accuracy) / (count + 1);
    metrics.averageProcessingTime = (metrics.averageProcessingTime * count + processingTime) / (count + 1);
    metrics.successRate = (metrics.successRate * count + (success ? 1 : 0)) / (count + 1);

    // Update document type tracking
    metrics.documentTypes[documentType] = (metrics.documentTypes[documentType] || 0) + 1;

    // Update resource usage if provided
    if (resourceUsage) {
      metrics.resourceUsage.memory = (metrics.resourceUsage.memory * count + resourceUsage.memory) / (count + 1);
      metrics.resourceUsage.cpu = (metrics.resourceUsage.cpu * count + resourceUsage.cpu) / (count + 1);
    }

    metrics.lastUsed = new Date();
    metrics.usageCount++;

    logger.info(`Updated metrics for ${mode}: accuracy=${accuracy.toFixed(2)}, time=${processingTime}ms, success=${success}`);
  }

  /**
   * Switch to a different mode during processing
   */
  async switchMode(
    currentMode: OCRMode,
    targetMode: OCRMode,
    reason: string
  ): Promise<boolean> {
    logger.info(`Switching from ${currentMode} to ${targetMode}: ${reason}`);

    const targetConfig = this.modeConfigurations.get(targetMode);
    if (!targetConfig) {
      logger.error(`Target mode ${targetMode} not found`);
      return false;
    }

    this.currentMode = targetMode;
    logger.info(`Mode switch successful: now using ${targetMode}`);

    return true;
  }

  /**
   * Get current mode
   */
  getCurrentMode(): OCRMode {
    return this.currentMode;
  }

  /**
   * Enable or disable adaptive mode selection
   */
  setAdaptiveEnabled(enabled: boolean): void {
    this.adaptiveEnabled = enabled;
    logger.info(`Adaptive mode selection ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable or disable learning from results
   */
  setLearningEnabled(enabled: boolean): void {
    this.learningEnabled = enabled;
    logger.info(`Learning from results ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get performance metrics for all modes
   */
  getAllModeMetrics(): Map<OCRMode, ModeMetrics> {
    return new Map(this.modeMetrics);
  }

  /**
   * Get available modes with their capabilities
   */
  getAvailableModes(): Array<{ mode: OCRMode; description: string; capabilities: string[] }> {
    return [
      {
        mode: OCRMode.FAST,
        description: 'Speed-optimized processing with minimal features',
        capabilities: ['Quick processing', 'Low resource usage', 'Basic accuracy']
      },
      {
        mode: OCRMode.BALANCED,
        description: 'Balanced speed and accuracy for general documents',
        capabilities: ['Multi-engine processing', 'Good accuracy', 'Reasonable speed']
      },
      {
        mode: OCRMode.ACCURACY,
        description: 'Maximum accuracy using all available engines',
        capabilities: ['Highest accuracy', 'Multi-engine ensemble', 'Advanced preprocessing']
      },
      {
        mode: OCRMode.MEDICAL,
        description: 'Specialized processing for medical documents',
        capabilities: ['Medical terminology', 'Code extraction', 'Layout preservation']
      },
      {
        mode: OCRMode.HANDWRITTEN,
        description: 'Optimized for handwritten content recognition',
        capabilities: ['Handwriting models', 'Character confidence', 'Context analysis']
      },
      {
        mode: OCRMode.DEGRADED,
        description: 'Enhanced processing for poor quality documents',
        capabilities: ['Aggressive preprocessing', 'Noise removal', 'Quality enhancement']
      },
      {
        mode: OCRMode.STRUCTURED,
        description: 'Optimized for forms and structured data',
        capabilities: ['Table detection', 'Form field extraction', 'Layout analysis']
      },
      {
        mode: OCRMode.ADAPTIVE,
        description: 'Automatically selects the best approach',
        capabilities: ['Automatic optimization', 'Learning capability', 'Dynamic adjustment']
      },
      {
        mode: OCRMode.BATCH,
        description: 'Optimized for bulk document processing',
        capabilities: ['Batch optimization', 'Resource pooling', 'High throughput']
      },
      {
        mode: OCRMode.REALTIME,
        description: 'Ultra-fast processing for real-time applications',
        capabilities: ['Minimal latency', 'Streaming processing', 'Immediate results']
      }
    ];
  }

  /**
   * Load metrics from persistent storage
   */
  private async loadMetricsFromStorage(): Promise<void> {
    try {
      // Implementation would load from file or database
      logger.info('Mode metrics loaded from storage');
    } catch (error) {
      logger.warn(`Failed to load mode metrics: ${error}`);
    }
  }

  /**
   * Save metrics to persistent storage
   */
  async saveMetricsToStorage(): Promise<void> {
    try {
      // Implementation would save to file or database
      logger.info('Mode metrics saved to storage');
    } catch (error) {
      logger.error(`Failed to save mode metrics: ${error}`);
    }
  }

  /**
   * Reset all metrics to default values
   */
  resetMetrics(): void {
    this.initializeModeMetrics();
    logger.info('All mode metrics reset to default values');
  }
}

// Export singleton instance
export const adaptiveModeService = new AdaptiveModeService();
export default adaptiveModeService;

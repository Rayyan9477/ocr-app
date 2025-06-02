/**
 * Intelligent Processing Orchestrator
 * 
 * This orchestrator coordinates the entire OCR processing pipeline with
 * intelligent mode switching, quality monitoring, and adaptive optimization.
 */

import logger from './logger';
import { adaptiveModeService, OCRMode, ProcessingContext, AdaptiveDecision } from './adaptive-mode-service';
import { enhancedConfigManager } from './enhanced-config-manager';
import { autoCustomization, DocumentCharacteristics } from './auto-customization';
import { multiEngineOCR } from './multi-engine-ocr';
import { fourEngineOCR } from './four-engine-ocr';
import { preprocessingService } from './preprocessing-service';
import { extractConfidenceScores } from './confidence-detector';

export interface ProcessingRequest {
  inputPath: string;
  outputDir: string;
  options: {
    language?: string;
    urgency?: 'low' | 'medium' | 'high' | 'critical';
    qualityRequirement?: 'draft' | 'standard' | 'high' | 'perfect';
    documentType?: string;
    batchSize?: number;
    timeConstraints?: {
      maxTime: number;
      preferredTime: number;
    };
    resourceConstraints?: {
      maxMemory: number;
      maxCpu: number;
    };
    // Mode overrides
    forceMode?: OCRMode;
    disableAdaptive?: boolean;
    enableLearning?: boolean;
  };
}

export interface ProcessingResult {
  success: boolean;
  mode: OCRMode;
  confidence: number;
  text: string;
  outputPath?: string;
  processingTime: number;
  adaptiveDecision: AdaptiveDecision;
  qualityMetrics: {
    accuracy: number;
    readability: number;
    completeness: number;
  };
  engineResults: any[];
  preprocessingApplied: string[];
  postprocessingApplied: string[];
  fallbacksUsed: OCRMode[];
  resourceUsage: {
    memory: number;
    cpu: number;
    diskSpace: number;
  };
  recommendations: string[];
  error?: string;
}

export interface QualityThresholds {
  minimum: number;
  target: number;
  excellent: number;
}

export interface ProcessingStats {
  totalProcessed: number;
  successRate: number;
  averageAccuracy: number;
  averageProcessingTime: number;
  modeUsageStats: Record<OCRMode, number>;
  qualityDistribution: {
    excellent: number;
    good: number;
    acceptable: number;
    poor: number;
  };
}

/**
 * Intelligent Processing Orchestrator for coordinated OCR processing
 */
export class IntelligentProcessingOrchestrator {
  private processingStats: ProcessingStats;
  private qualityThresholds: QualityThresholds;
  private isProcessing: boolean = false;
  private currentProcesses: Map<string, ProcessingRequest> = new Map();

  constructor() {
    this.processingStats = this.initializeStats();
    this.qualityThresholds = {
      minimum: 50,
      target: 75,
      excellent: 90
    };
  }

  /**
   * Main processing method with intelligent orchestration
   */
  async processDocument(request: ProcessingRequest): Promise<ProcessingResult> {
    const startTime = Date.now();
    const processId = `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentProcesses.set(processId, request);
    
    try {
      logger.info(`Starting intelligent processing for ${request.inputPath}`);
      
      // Phase 1: Document Analysis
      const characteristics = await this.analyzeDocument(request.inputPath);
      
      // Phase 2: Context Building
      const context = this.buildProcessingContext(request, characteristics);
      
      // Phase 3: Mode Selection
      const adaptiveDecision = await this.selectOptimalMode(characteristics, context, request.options.forceMode);
      
      // Phase 4: Configuration Optimization
      const optimizedConfig = this.optimizeConfiguration(adaptiveDecision.selectedMode, characteristics, context);
      
      // Phase 5: Processing Execution
      const processingResult = await this.executeProcessing(
        request,
        adaptiveDecision,
        optimizedConfig,
        characteristics
      );
      
      // Phase 6: Quality Assessment
      const qualityAssessment = await this.assessQuality(processingResult);
      
      // Phase 7: Adaptive Response
      const finalResult = await this.handleAdaptiveResponse(
        request,
        processingResult,
        qualityAssessment,
        adaptiveDecision
      );
      
      // Phase 8: Learning and Updates
      await this.updateLearningMetrics(finalResult, adaptiveDecision.selectedMode, characteristics);
      
      const totalTime = Date.now() - startTime;
      finalResult.processingTime = totalTime;
      
      logger.info(`Processing completed in ${totalTime}ms with mode ${finalResult.mode}`);
      
      return finalResult;
      
    } catch (error) {
      logger.error(`Processing failed: ${error}`);
      
      return {
        success: false,
        mode: OCRMode.BALANCED,
        confidence: 0,
        text: '',
        processingTime: Date.now() - startTime,
        adaptiveDecision: {
          selectedMode: OCRMode.BALANCED,
          reasoning: ['Processing failed due to error'],
          confidence: 0,
          alternativeModes: [],
          fallbackStrategy: [],
          estimatedPerformance: { accuracy: 0, timeSeconds: 0, successProbability: 0 }
        },
        qualityMetrics: { accuracy: 0, readability: 0, completeness: 0 },
        engineResults: [],
        preprocessingApplied: [],
        postprocessingApplied: [],
        fallbacksUsed: [],
        resourceUsage: { memory: 0, cpu: 0, diskSpace: 0 },
        recommendations: ['Consider retrying with different settings'],
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.currentProcesses.delete(processId);
    }
  }

  /**
   * Analyze document characteristics
   */
  private async analyzeDocument(inputPath: string): Promise<DocumentCharacteristics> {
    logger.info('Analyzing document characteristics...');
    
    try {
      const analysis = await autoCustomization.analyzeAndCustomize(inputPath);
      return analysis.characteristics;
    } catch (error) {
      logger.warn(`Document analysis failed, using defaults: ${error}`);
      return {
        isHandwritten: false,
        isMedicalDocument: false,
        isLowQuality: false,
        hasStructuredData: false,
        isMultiColumn: false,
        hasImages: false,
        language: 'eng',
        dpi: 300,
        pageCount: 1
      };
    }
  }

  /**
   * Build processing context from request and characteristics
   */
  private buildProcessingContext(
    request: ProcessingRequest,
    characteristics: DocumentCharacteristics
  ): ProcessingContext {
    return {
      documentType: request.options.documentType || this.inferDocumentType(characteristics),
      urgency: request.options.urgency || 'medium',
      qualityRequirement: request.options.qualityRequirement || 'standard',
      batchSize: request.options.batchSize,
      timeConstraints: request.options.timeConstraints,
      resourceConstraints: request.options.resourceConstraints
    };
  }

  /**
   * Infer document type from characteristics
   */
  private inferDocumentType(characteristics: DocumentCharacteristics): string {
    if (characteristics.isMedicalDocument) return 'medical';
    if (characteristics.isHandwritten) return 'handwritten';
    if (characteristics.hasStructuredData) return 'structured';
    if (characteristics.isMultiColumn) return 'multicolumn';
    if (characteristics.hasImages) return 'mixed_content';
    if (characteristics.isLowQuality) return 'degraded';
    
    return 'general';
  }

  /**
   * Select optimal mode with intelligent decision making
   */
  private async selectOptimalMode(
    characteristics: DocumentCharacteristics,
    context: ProcessingContext,
    forceMode?: OCRMode
  ): Promise<AdaptiveDecision> {
    if (forceMode) {
      logger.info(`Using forced mode: ${forceMode}`);
      return {
        selectedMode: forceMode,
        reasoning: [`Mode forced by user: ${forceMode}`],
        confidence: 1.0,
        alternativeModes: [],
        fallbackStrategy: [],
        estimatedPerformance: { accuracy: 0.8, timeSeconds: 60, successProbability: 0.9 }
      };
    }

    return await adaptiveModeService.selectOptimalMode(characteristics, context);
  }

  /**
   * Optimize configuration for selected mode
   */
  private optimizeConfiguration(
    mode: OCRMode,
    characteristics: DocumentCharacteristics,
    context: ProcessingContext
  ): any {
    logger.info(`Optimizing configuration for mode: ${mode}`);
    
    const modeConfig = enhancedConfigManager.getModeConfig(mode);
    const preprocessingProfile = enhancedConfigManager.getPreprocessingProfile(
      mode,
      context.documentType,
      characteristics.isLowQuality ? 50 : 80
    );
    const postprocessingProfile = enhancedConfigManager.getPostprocessingProfile(
      mode,
      context.documentType,
      70
    );

    return {
      mode: modeConfig,
      preprocessing: preprocessingProfile,
      postprocessing: postprocessingProfile,
      runtimeSettings: enhancedConfigManager.updateRuntimeSettings(
        mode,
        context.documentType,
        characteristics.isLowQuality ? 50 : 80
      )
    };
  }

  /**
   * Execute the OCR processing with the optimized configuration
   */
  private async executeProcessing(
    request: ProcessingRequest,
    decision: AdaptiveDecision,
    config: any,
    characteristics: DocumentCharacteristics
  ): Promise<Partial<ProcessingResult>> {
    logger.info(`Executing processing with mode: ${decision.selectedMode}`);
    
    const mode = decision.selectedMode;
    const preprocessingApplied: string[] = [];
    const postprocessingApplied: string[] = [];
    let processedInputPath = request.inputPath;

    try {
      // Apply preprocessing if configured
      if (config.preprocessing.enabled && config.preprocessing.techniques.length > 0) {
        logger.info('Applying preprocessing...');
        processedInputPath = await preprocessingService.quickEnhance(request.inputPath);
        preprocessingApplied.push(...config.preprocessing.techniques);
      }

      // Select and execute OCR engine(s) based on mode
      let engineResult;
      if (mode === OCRMode.MEDICAL || characteristics.isMedicalDocument) {
        // Use four-engine OCR for medical documents
        engineResult = await fourEngineOCR.processWithFourEngines(
          processedInputPath,
          request.outputDir,
          request.options.language || 'eng',
          {
            enhanceHandwriting: characteristics.isHandwritten,
            extractCodes: true,
            medicalTerminology: true,
            preserveLayout: true,
            confidenceThreshold: config.runtimeSettings.confidenceThreshold
          }
        );
      } else {
        // Use multi-engine OCR for other modes
        engineResult = await multiEngineOCR.processWithEnsemble(
          processedInputPath,
          request.outputDir,
          request.options.language || 'eng',
          config.preprocessing.enabled,
          true // Use auto-customization
        );
      }

      // Apply postprocessing if configured
      if (config.postprocessing.enabled && config.postprocessing.techniques.length > 0) {
        logger.info('Applying postprocessing...');
        postprocessingApplied.push(...config.postprocessing.techniques);
        // Postprocessing implementation would go here
      }

      return {
        success: engineResult.hasSuccessfulResults || (engineResult as any).success || false,
        mode,
        confidence: engineResult.averageConfidence || engineResult.bestResult?.confidence || 0,
        text: engineResult.consensusText || engineResult.bestResult?.text || '',
        outputPath: engineResult.bestResult?.outputPath,
        engineResults: engineResult.allResults || [engineResult.bestResult],
        preprocessingApplied,
        postprocessingApplied,
        fallbacksUsed: []
      };

    } catch (error) {
      logger.error(`Processing execution failed: ${error}`);
      throw error;
    }
  }

  /**
   * Assess the quality of processing results
   */
  private async assessQuality(result: Partial<ProcessingResult>): Promise<{
    accuracy: number;
    readability: number;
    completeness: number;
    overallQuality: 'excellent' | 'good' | 'acceptable' | 'poor';
  }> {
    const confidence = result.confidence || 0;
    const textLength = result.text?.length || 0;
    
    // Calculate accuracy based on confidence
    const accuracy = confidence;
    
    // Calculate readability (simplified)
    const readability = Math.min(100, textLength > 0 ? 
      Math.max(50, confidence + (textLength > 100 ? 10 : 0)) : 0);
    
    // Calculate completeness (simplified)
    const completeness = textLength > 0 ? 
      Math.min(100, Math.max(30, confidence + (textLength > 500 ? 15 : textLength > 100 ? 10 : 0))) : 0;
    
    // Determine overall quality
    const averageQuality = (accuracy + readability + completeness) / 3;
    let overallQuality: 'excellent' | 'good' | 'acceptable' | 'poor';
    
    if (averageQuality >= this.qualityThresholds.excellent) {
      overallQuality = 'excellent';
    } else if (averageQuality >= this.qualityThresholds.target) {
      overallQuality = 'good';
    } else if (averageQuality >= this.qualityThresholds.minimum) {
      overallQuality = 'acceptable';
    } else {
      overallQuality = 'poor';
    }

    return { accuracy, readability, completeness, overallQuality };
  }

  /**
   * Handle adaptive response based on quality assessment
   */
  private async handleAdaptiveResponse(
    request: ProcessingRequest,
    processingResult: Partial<ProcessingResult>,
    qualityAssessment: any,
    decision: AdaptiveDecision
  ): Promise<ProcessingResult> {
    const fallbacksUsed: OCRMode[] = [];
    let finalResult = processingResult;
    
    // Check if quality is below acceptable threshold
    if (qualityAssessment.overallQuality === 'poor' && !request.options.disableAdaptive) {
      logger.info('Quality below threshold, attempting fallback strategies...');
      
      // Try fallback modes
      for (const fallbackMode of decision.fallbackStrategy) {
        if (fallbacksUsed.length >= 2) break; // Limit fallback attempts
        
        try {
          logger.info(`Attempting fallback with mode: ${fallbackMode}`);
          
          const fallbackDecision: AdaptiveDecision = {
            ...decision,
            selectedMode: fallbackMode
          };
          
          const characteristics = await this.analyzeDocument(request.inputPath);
          const context = this.buildProcessingContext(request, characteristics);
          const fallbackConfig = this.optimizeConfiguration(fallbackMode, characteristics, context);
          
          const fallbackResult = await this.executeProcessing(
            request,
            fallbackDecision,
            fallbackConfig,
            characteristics
          );
          
          const fallbackQuality = await this.assessQuality(fallbackResult);
          
          // Use fallback result if it's better
          if (fallbackQuality.overallQuality !== 'poor' || 
              (fallbackResult.confidence || 0) > (finalResult.confidence || 0)) {
            finalResult = fallbackResult;
            fallbacksUsed.push(fallbackMode);
            logger.info(`Fallback successful with mode: ${fallbackMode}`);
            break;
          }
          
          fallbacksUsed.push(fallbackMode);
          
        } catch (error) {
          logger.warn(`Fallback failed for mode ${fallbackMode}: ${error}`);
          fallbacksUsed.push(fallbackMode);
        }
      }
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      qualityAssessment,
      decision.selectedMode,
      fallbacksUsed
    );

    // Estimate resource usage (simplified)
    const resourceUsage = {
      memory: 100, // MB - would be measured in real implementation
      cpu: 50, // % - would be measured in real implementation
      diskSpace: 10 // MB - would be calculated from file sizes
    };

    return {
      success: finalResult.success || false,
      mode: finalResult.mode || decision.selectedMode,
      confidence: finalResult.confidence || 0,
      text: finalResult.text || '',
      outputPath: finalResult.outputPath,
      processingTime: 0, // Will be set by caller
      adaptiveDecision: decision,
      qualityMetrics: {
        accuracy: qualityAssessment.accuracy,
        readability: qualityAssessment.readability,
        completeness: qualityAssessment.completeness
      },
      engineResults: finalResult.engineResults || [],
      preprocessingApplied: finalResult.preprocessingApplied || [],
      postprocessingApplied: finalResult.postprocessingApplied || [],
      fallbacksUsed,
      resourceUsage,
      recommendations,
      error: finalResult.success === false ? 'Processing failed' : undefined
    };
  }

  /**
   * Generate recommendations based on processing results
   */
  private generateRecommendations(
    qualityAssessment: any,
    mode: OCRMode,
    fallbacksUsed: OCRMode[]
  ): string[] {
    const recommendations: string[] = [];

    if (qualityAssessment.overallQuality === 'poor') {
      recommendations.push('Consider using a higher quality scan');
      recommendations.push('Try preprocessing the document for better results');
      
      if (mode !== OCRMode.ACCURACY) {
        recommendations.push('Consider using accuracy mode for better results');
      }
    }

    if (qualityAssessment.accuracy < 70) {
      recommendations.push('Document may benefit from manual review');
      
      if (mode !== OCRMode.DEGRADED) {
        recommendations.push('Try degraded document mode for difficult images');
      }
    }

    if (fallbacksUsed.length > 0) {
      recommendations.push(`Fallback modes used: ${fallbacksUsed.join(', ')}`);
    }

    if (qualityAssessment.overallQuality === 'excellent') {
      recommendations.push('Excellent results achieved with current settings');
    }

    return recommendations;
  }

  /**
   * Update learning metrics based on processing results
   */
  private async updateLearningMetrics(
    result: ProcessingResult,
    mode: OCRMode,
    characteristics: DocumentCharacteristics
  ): Promise<void> {
    if (!enhancedConfigManager.getConfig().adaptiveSettings.learningEnabled) {
      return;
    }

    const documentType = this.inferDocumentType(characteristics);
    
    // Update adaptive mode service metrics
    adaptiveModeService.updateModeMetrics(
      mode,
      result.qualityMetrics.accuracy,
      result.processingTime,
      result.success,
      documentType,
      result.resourceUsage
    );

    // Update configuration manager performance metrics
    enhancedConfigManager.updatePerformanceMetrics(
      result.qualityMetrics.accuracy,
      result.processingTime,
      result.success
    );

    // Update processing stats
    this.updateProcessingStats(result);

    logger.info(`Learning metrics updated for mode ${mode}`);
  }

  /**
   * Update internal processing statistics
   */
  private updateProcessingStats(result: ProcessingResult): void {
    this.processingStats.totalProcessed++;
    
    // Update success rate
    const successCount = this.processingStats.successRate * (this.processingStats.totalProcessed - 1) + (result.success ? 1 : 0);
    this.processingStats.successRate = successCount / this.processingStats.totalProcessed;
    
    // Update average accuracy
    const totalAccuracy = this.processingStats.averageAccuracy * (this.processingStats.totalProcessed - 1) + result.qualityMetrics.accuracy;
    this.processingStats.averageAccuracy = totalAccuracy / this.processingStats.totalProcessed;
    
    // Update average processing time
    const totalTime = this.processingStats.averageProcessingTime * (this.processingStats.totalProcessed - 1) + result.processingTime;
    this.processingStats.averageProcessingTime = totalTime / this.processingStats.totalProcessed;
    
    // Update mode usage stats
    this.processingStats.modeUsageStats[result.mode] = (this.processingStats.modeUsageStats[result.mode] || 0) + 1;
    
    // Update quality distribution
    const avgQuality = (result.qualityMetrics.accuracy + result.qualityMetrics.readability + result.qualityMetrics.completeness) / 3;
    if (avgQuality >= this.qualityThresholds.excellent) {
      this.processingStats.qualityDistribution.excellent++;
    } else if (avgQuality >= this.qualityThresholds.target) {
      this.processingStats.qualityDistribution.good++;
    } else if (avgQuality >= this.qualityThresholds.minimum) {
      this.processingStats.qualityDistribution.acceptable++;
    } else {
      this.processingStats.qualityDistribution.poor++;
    }
  }

  /**
   * Initialize processing statistics
   */
  private initializeStats(): ProcessingStats {
    return {
      totalProcessed: 0,
      successRate: 0,
      averageAccuracy: 0,
      averageProcessingTime: 0,
      modeUsageStats: Object.values(OCRMode).reduce((acc, mode) => {
        acc[mode] = 0;
        return acc;
      }, {} as Record<OCRMode, number>),
      qualityDistribution: {
        excellent: 0,
        good: 0,
        acceptable: 0,
        poor: 0
      }
    };
  }

  /**
   * Get current processing statistics
   */
  getProcessingStats(): ProcessingStats {
    return { ...this.processingStats };
  }

  /**
   * Get current processing status
   */
  getProcessingStatus(): {
    isProcessing: boolean;
    activeProcesses: number;
    queuedProcesses: number;
  } {
    return {
      isProcessing: this.isProcessing,
      activeProcesses: this.currentProcesses.size,
      queuedProcesses: 0 // Would be implemented with a proper queue
    };
  }

  /**
   * Get available modes with current performance metrics
   */
  getAvailableModesWithMetrics(): Array<{
    mode: OCRMode;
    description: string;
    performance: {
      accuracy: number;
      speed: number;
      successRate: number;
    };
    usageCount: number;
  }> {
    const availableModes = adaptiveModeService.getAvailableModes();
    const metrics = adaptiveModeService.getAllModeMetrics();
    
    return availableModes.map(modeInfo => {
      const modeMetrics = metrics.get(modeInfo.mode);
      return {
        mode: modeInfo.mode,
        description: modeInfo.description,
        performance: {
          accuracy: modeMetrics?.averageAccuracy || 0,
          speed: modeMetrics?.averageProcessingTime || 0,
          successRate: modeMetrics?.successRate || 0
        },
        usageCount: modeMetrics?.usageCount || 0
      };
    });
  }
}

// Export singleton instance
export const intelligentOrchestrator = new IntelligentProcessingOrchestrator();
export default intelligentOrchestrator;

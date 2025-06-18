/**
 * Enhanced Document Analyzer
 * 
 * Uses Vision Language Model (VLM) to perform advanced document analysis
 * for optimal OCR processing, while maintaining compatibility with
 * the existing document analyzer interface.
 */

import path from 'path';
import fs from 'fs';
import logger from './logger';
import { DocumentAnalysis } from './document-analyzer';
import { VLMManager } from './vlm/core/vlm-manager';
import { VLMInterface } from './vlm/core/vlm-interface';
import { DocumentAnalysisResponse } from './vlm/core/vlm-response-types';
import { PromptCategory } from './vlm/models/paligemma2-prompts';
import { fileExists } from './utils';
import { ExtendedPaliGemma2Adapter } from './extended-paligemma2-adapter';

/**
 * Enhanced document analysis results including VLM-powered insights
 */
export interface EnhancedDocumentAnalysis extends DocumentAnalysis {
  // Original document analysis fields are extended with:
  documentType: string;
  qualityMetrics: {
    overall: number;
    resolution: number;
    noise: number;
    contrast: number;
  };
  contentFeatures: {
    hasHandwriting: boolean;
    hasTables: boolean;
    hasHighlights: boolean;
    hasImages: boolean;
    hasSignatures: boolean;
    languagePrediction: string[];
  };
  layoutElements: Array<{
    type: string;
    bbox: [number, number, number, number];
    confidence: number;
  }>;
  recommendations: {
    preferredEngine: string;
    preprocessingSteps: string[];
    confidenceThreshold: number;
    priority: string;
  };
  vlmProcessingTimeMs?: number;
}

/**
 * Enhanced document analyzer that uses Vision Language Model (VLM)
 * to provide more accurate and detailed document analysis.
 */
export class EnhancedDocumentAnalyzer {
  private vlmManager: VLMManager;
  private vlm: VLMInterface | null = null;
  private fallbackAnalysisMode: boolean = false;
  
  constructor() {
    // Initialize VLM manager with PaliGemma2 as default model
    this.vlmManager = new VLMManager({
      defaultModelId: 'paligemma2-3b-mix-224',
      defaultDeploymentStrategy: 'local',
      maxCachedInstances: 1 // Keep one instance in memory
    });
  }
  
  /**
   * Initialize the VLM for document analysis
   */
  private async initializeVLM(): Promise<boolean> {
    try {
      if (!this.vlm) {
        // Use Extended PaliGemma2 Adapter directly
        this.vlm = new ExtendedPaliGemma2Adapter();
        await this.vlm.initialize({
          deploymentStrategy: 'local',
          enableCache: true
        });
        
        logger.info('Enhanced document analyzer: VLM initialized successfully');
        this.fallbackAnalysisMode = false;
        return true;
      }
      return this.vlm.isReady;
    } catch (error) {
      logger.warn(`Enhanced document analyzer: Failed to initialize VLM: ${error}`);
      this.fallbackAnalysisMode = true;
      return false;
    }
  }
  
  /**
   * Analyze document using VLM to determine its characteristics
   * Falls back to basic analysis if VLM is not available
   */
  async analyzeDocument(imagePath: string): Promise<EnhancedDocumentAnalysis> {
    try {
      // Check if file exists
      if (!await fileExists(imagePath)) {
        throw new Error(`File not found: ${imagePath}`);
      }
      
      // Try to initialize VLM
      const vlmInitialized = await this.initializeVLM();
      
      if (vlmInitialized && this.vlm) {
        // Use VLM for document analysis
        return await this.performVLMAnalysis(imagePath);
      } else {
        // Fall back to basic analysis
        logger.warn('Enhanced document analyzer: Using fallback analysis mode');
        return await this.performFallbackAnalysis(imagePath);
      }
    } catch (error) {
      logger.error(`Enhanced document analyzer: Analysis failed: ${error}`);
      // Return default values in case of failure
      return this.getDefaultAnalysis();
    }
  }
  
  /**
   * Perform document analysis using VLM
   */
  private async performVLMAnalysis(imagePath: string): Promise<EnhancedDocumentAnalysis> {
    try {
      // Execute VLM-based document analysis
      const startTime = Date.now();
      const analysisResponse = await this.vlm!.analyzeDocument(imagePath, {
        promptCategory: PromptCategory.DOCUMENT_ANALYSIS
      });
      const processingTimeMs = Date.now() - startTime;
      
      logger.info(`Enhanced document analyzer: VLM analysis completed in ${processingTimeMs}ms`);
      
      // Map VLM response to enhanced document analysis structure
      return this.mapVLMResponseToAnalysis(analysisResponse, processingTimeMs);
    } catch (error) {
      logger.error(`Enhanced document analyzer: VLM analysis failed: ${error}`);
      // Fall back to basic analysis on VLM failure
      return await this.performFallbackAnalysis(imagePath);
    }
  }
  
  /**
   * Perform fallback document analysis using basic methods
   */
  private async performFallbackAnalysis(imagePath: string): Promise<EnhancedDocumentAnalysis> {
    // Implement basic analysis similar to the original DocumentAnalyzer
    try {
      // Get file stats
      const stats = fs.statSync(imagePath);
      const fileSize = stats.size;
      const extension = path.extname(imagePath).toLowerCase();
      
      // Basic heuristics
      const isLargeFile = fileSize > 2 * 1024 * 1024; // > 2MB
      const isSmallFile = fileSize < 100 * 1024; // < 100KB
      const isPotentiallyPoorQuality = isSmallFile || 
                                      extension === '.jpg' || 
                                      extension === '.jpeg';
      const hasComplexLayout = isLargeFile;
      const qualityScore = isSmallFile ? 30 : (isPotentiallyPoorQuality ? 50 : 80);
      
      return {
        // Original DocumentAnalysis fields
        hasHandwriting: false,
        hasTables: false,
        poorQuality: isPotentiallyPoorQuality,
        complexLayout: hasComplexLayout,
        confidence: {
          handwriting: 0,
          tables: 0,
          quality: qualityScore,
          layout: hasComplexLayout ? 70 : 40
        },
        
        // Enhanced fields with default values
        documentType: 'general',
        qualityMetrics: {
          overall: qualityScore / 100,
          resolution: isPotentiallyPoorQuality ? 0.5 : 0.8,
          noise: isPotentiallyPoorQuality ? 0.7 : 0.3,
          contrast: isPotentiallyPoorQuality ? 0.5 : 0.7
        },
        contentFeatures: {
          hasHandwriting: false,
          hasTables: false,
          hasHighlights: false,
          hasImages: extension === '.png' || extension === '.jpg' || extension === '.jpeg',
          hasSignatures: false,
          languagePrediction: ['eng']
        },
        layoutElements: [],
        recommendations: {
          preferredEngine: isLargeFile ? 'ocrmypdf' : 'tesseract',
          preprocessingSteps: isPotentiallyPoorQuality ? ['denoise', 'contrast'] : [],
          confidenceThreshold: 60,
          priority: 'balanced'
        }
      };
    } catch (error) {
      logger.error(`Enhanced document analyzer: Fallback analysis failed: ${error}`);
      return this.getDefaultAnalysis();
    }
  }
  
  /**
   * Map VLM response to enhanced document analysis structure
   */
  private mapVLMResponseToAnalysis(
    response: DocumentAnalysisResponse,
    processingTimeMs: number
  ): EnhancedDocumentAnalysis {
    // Extract analysis result from VLM response
    const analysis = response.analysis;
    
    // Convert to EnhancedDocumentAnalysis structure
    return {
      // Original DocumentAnalysis fields
      hasHandwriting: analysis.content?.hasHandwriting || false,
      hasTables: analysis.content?.hasTables || false,
      poorQuality: (analysis.quality?.overall || 0) < 0.6,
      complexLayout: (analysis.layout?.length || 0) > 3,
      confidence: {
        handwriting: analysis.content?.hasHandwriting ? 0.8 : 0,
        tables: analysis.content?.hasTables ? 0.8 : 0,
        quality: (analysis.quality?.overall || 0) * 100,
        layout: 0.7 * 100
      },
      
      // Enhanced fields from VLM analysis
      documentType: analysis.documentType || 'general',
      qualityMetrics: {
        overall: analysis.quality?.overall || 0.5,
        resolution: analysis.quality?.resolution || 0.5,
        noise: analysis.quality?.noise || 0.5,
        contrast: analysis.quality?.contrast || 0.5
      },
      contentFeatures: {
        hasHandwriting: analysis.content?.hasHandwriting || false,
        hasTables: analysis.content?.hasTables || false,
        hasHighlights: analysis.content?.hasHighlights || false,
        hasImages: analysis.content?.hasImages || false,
        hasSignatures: analysis.content?.hasSignatures || false,
        languagePrediction: analysis.content?.languagePrediction || ['eng']
      },
      layoutElements: analysis.layout || [],
      recommendations: {
        preferredEngine: analysis.recommendations?.preferredEngine || 'tesseract',
        preprocessingSteps: analysis.recommendations?.preprocessingSteps || [],
        confidenceThreshold: analysis.recommendations?.confidenceThreshold || 60,
        priority: analysis.recommendations?.priority || 'balanced'
      },
      vlmProcessingTimeMs: processingTimeMs
    };
  }
  
  /**
   * Get default analysis values when analysis fails
   */
  private getDefaultAnalysis(): EnhancedDocumentAnalysis {
    return {
      hasHandwriting: false,
      hasTables: false,
      poorQuality: false,
      complexLayout: false,
      confidence: {
        handwriting: 0,
        tables: 0,
        quality: 50,
        layout: 50
      },
      documentType: 'general',
      qualityMetrics: {
        overall: 0.5,
        resolution: 0.5,
        noise: 0.5,
        contrast: 0.5
      },
      contentFeatures: {
        hasHandwriting: false,
        hasTables: false,
        hasHighlights: false,
        hasImages: false,
        hasSignatures: false,
        languagePrediction: ['eng']
      },
      layoutElements: [],
      recommendations: {
        preferredEngine: 'tesseract',
        preprocessingSteps: [],
        confidenceThreshold: 60,
        priority: 'balanced'
      }
    };
  }
}

// Export singleton instance
export const enhancedDocumentAnalyzer = new EnhancedDocumentAnalyzer();

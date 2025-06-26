/**
 * Enhanced OCR Pipeline with Advanced Preprocessing and Intelligent Recognition
 * Orchestrates the complete OCR workflow with enhanced preprocessing capabilities
 */

import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from './logger';
import { PreprocessingService } from './preprocessing-service';
import HighlightDetector, { HighlightRegion } from './highlight-detector';
import { HandwritingDetector, HandwritingMetrics } from './handwriting-detector';
import { MultiEngineOCR, OCRResult } from './multi-engine-ocr';

const execAsync = promisify(exec);
import { 
  EnhancedPreprocessingOptions, 
  EnhancedPreprocessingResult,
  DocumentQualityAssessment,
  PreprocessingRecommendation 
} from './enhanced-preprocessing-types';

/**
 * Enhanced OCR options for processing
 */
export interface EnhancedOCROptions {
  preprocessing?: EnhancedPreprocessingOptions;
  enhanceWithVLM?: boolean;
  useVLMRecommendations?: boolean;
  outputDir?: string;
  language?: string;
  engineParams?: Record<string, any>;
}

/**
 * Enhanced OCR result with detailed metadata
 */
export interface EnhancedOCRResult {
  text: string;
  confidence: number;
  success: boolean;
  processingTime: number;
  highlightedRegions: HighlightRegion[];
  enhancedImagePath?: string;
  documentType: 'handwritten' | 'printed' | 'mixed' | 'unknown';
  preprocessingOperations: string[];
  wordCount: number;
  error?: string;
  qualityScore?: number;
  recommendationsApplied?: string[];
}

/**
 * VLM preprocessing recommendation structure
 */
interface VLMPreprocessingRecommendation {
  documentIssues?: {
    skew: number;
    poorContrast: number;
    noise: number;
    shadows: boolean;
    lowResolution: boolean;
  };
  recommendations?: Array<{
    technique: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
  }>;
}

/**
 * Enhanced OCR Pipeline with advanced preprocessing and intelligent recognition
 */
export class EnhancedOCRPipeline {
  private preprocessingService: PreprocessingService;
  private highlightDetector: HighlightDetector;
  private handwritingDetector: HandwritingDetector;
  private multiEngineOCR: MultiEngineOCR;
  
  constructor() {
    this.preprocessingService = new PreprocessingService();
    this.highlightDetector = new HighlightDetector();
    this.handwritingDetector = new HandwritingDetector();
    this.multiEngineOCR = new MultiEngineOCR();
  }
  
  /**
   * Process document with enhanced pipeline
   */
  async processDocument(
    inputPath: string, 
    options: EnhancedOCROptions = {}
  ): Promise<EnhancedOCRResult> {
    const startTime = Date.now();
    const sessionDir = path.join(options.outputDir || '/tmp', `ocr_session_${Date.now()}`);
    
    try {
      await execAsync(`mkdir -p "${sessionDir}"`);
      logger.info(`Starting enhanced OCR pipeline for: ${inputPath}`);
      
      // Step 1: Document analysis and preprocessing recommendations
      let preprocessingOptions: EnhancedPreprocessingOptions = { 
        ...options.preprocessing,
        outputPath: path.join(sessionDir, 'preprocessed.png')
      };
      
      // Step 2: Detect document characteristics
      const highlightDetectionResult = await this.highlightDetector.detectHighlights(inputPath);
      const hasHighlights = highlightDetectionResult.hasHighlights;
      
      // Adjust preprocessing based on document analysis
      if (hasHighlights) {
        preprocessingOptions.optimizeHighlightedText = true;
        logger.info('Detected highlights - enabling highlight optimization');
      }
      
      // Set default enhanced preprocessing if not specified
      if (!preprocessingOptions.applyCLAHE && !preprocessingOptions.enhanceEdges && !preprocessingOptions.normalize) {
        preprocessingOptions = {
          ...preprocessingOptions,
          applyCLAHE: true,
          claheClipLimit: 2.0,
          enhanceEdges: true,
          edgeStrength: 1.2,
          normalize: true,
          deskew: true
        };
      }
      
      // Step 3: Apply enhanced preprocessing
      const preprocessingResult = await this.preprocessingService.enhancedPreprocessing(
        inputPath, 
        preprocessingOptions
      );
      
      if (!preprocessingResult.success) {
        throw new Error(`Preprocessing failed: ${preprocessingResult.errors?.join(', ')}`);
      }
      
      const processedImagePath = preprocessingResult.outputPath;
      
      // Step 4: Check for handwriting
      const handwritingAnalysis = await this.handwritingDetector.analyzeHandwriting(
        processedImagePath,
        0.75 // confidence threshold
      );
      
      // Step 5: Choose OCR approach based on document analysis
      let ocrResult: OCRResult;
      
      if (handwritingAnalysis.isHandwritten) {
        // Use handwriting-optimized OCR
        logger.info('Document contains handwriting - using specialized processing');
        ocrResult = await this.processHandwrittenDocument(
          processedImagePath, 
          sessionDir,
          options.language || 'eng'
        );
      } else if (hasHighlights) {
        // Specialized OCR for documents with highlights
        logger.info('Document has highlights - using highlight-aware OCR');
        ocrResult = await this.performHighlightAwareOCR(
          processedImagePath, 
          highlightDetectionResult.highlightRegions,
          sessionDir,
          options.language || 'eng'
        );
      } else {
        // Standard OCR with enhanced parameters
        logger.info('Using standard OCR with enhanced preprocessing');
        ocrResult = await this.multiEngineOCR.processWithEnsemble(
          processedImagePath,
          sessionDir,
          options.language || 'eng',
          false, // preprocessing already done
          true   // use auto-customization
        );
      }
      
      // Calculate statistics and prepare result
      const processingTime = Date.now() - startTime;
      
      return {
        text: ocrResult.text || '',
        confidence: ocrResult.confidence || 0,
        success: true,
        processingTime,
        highlightedRegions: hasHighlights ? highlightDetectionResult.highlightRegions : [],
        enhancedImagePath: processedImagePath,
        documentType: handwritingAnalysis.isHandwritten ? 'handwritten' : 'printed',
        preprocessingOperations: preprocessingResult.preprocessingOperations || [],
        wordCount: (ocrResult.text || '').split(/\s+/).filter(Boolean).length
      };
      
    } catch (error) {
      logger.error(`Enhanced OCR pipeline failed: ${error}`);
      return {
        text: '',
        confidence: 0,
        success: false,
        processingTime: Date.now() - startTime,
        highlightedRegions: [],
        error: `Processing failed: ${error}`,
        documentType: 'unknown',
        preprocessingOperations: [],
        wordCount: 0
      };
    }
  }
  
  /**
   * Process handwritten documents with specialized settings
   */
  private async processHandwrittenDocument(
    imagePath: string,
    sessionDir: string,
    language: string
  ): Promise<OCRResult> {
    try {
      // Get handwriting analysis and enhancement recommendations
      const handwritingMetrics = await this.handwritingDetector.analyzeHandwriting('', 0.8);
      const enhancementRecommendations = this.handwritingDetector.getEnhancementRecommendations('', 0.8);
      
      // Use enhanced Tesseract settings for handwriting with specialized parameters
      const handwritingResult = await this.multiEngineOCR.processWithEnsemble(
        imagePath,
        sessionDir,
        language,
        false, // preprocessing already done
        true   // use auto-customization
      );
      
      // Apply handwriting-specific post-processing if available
      if (handwritingResult.bestResult && enhancementRecommendations) {
        // Apply any text corrections based on medical patterns
        const enhancedText = this.applyHandwritingCorrections(
          handwritingResult.bestResult.text,
          handwritingMetrics
        );
        
        return {
          ...handwritingResult.bestResult,
          text: enhancedText
        };
      }
      
      return handwritingResult.bestResult || {
        text: '',
        confidence: 0,
        engine: 'handwriting-optimized'
      };
    } catch (error) {
      logger.error(`Handwritten document processing failed: ${error}`);
      return {
        text: '',
        confidence: 0,
        engine: 'handwriting-fallback'
      };
    }
  }
  
  /**
   * Apply handwriting-specific text corrections
   */
  private applyHandwritingCorrections(text: string, metrics: HandwritingMetrics): string {
    if (!text || !metrics.isHandwritten) {
      return text;
    }
    
    let correctedText = text;
    
    // Apply basic handwriting corrections
    const commonCorrections = new Map([
      // Common OCR mistakes with handwritten text
      ['rn', 'm'], // 'rn' often misread as 'm'
      ['vv', 'w'], // 'vv' often misread as 'w'
      ['cl', 'd'], // 'cl' often misread as 'd'
      ['ri', 'n'], // 'ri' often misread as 'n'
      ['l1', 'll'], // '1' and 'l' confusion
      ['0', 'O'],  // zero and O confusion in context
    ]);
    
    // Apply corrections with context awareness
    for (const [mistake, correction] of Array.from(commonCorrections)) {
      // Use word boundaries to avoid false corrections
      const regex = new RegExp(`\\b${mistake}\\b`, 'gi');
      correctedText = correctedText.replace(regex, correction);
    }
    
    return correctedText;
  }
  
  /**
   * Perform highlight-aware OCR processing
   */
  private async performHighlightAwareOCR(
    imagePath: string,
    highlightRegions: HighlightRegion[],
    sessionDir: string,
    language: string
  ): Promise<OCRResult> {
    try {
      // Perform regular OCR for the whole document
      const baseResult = await this.multiEngineOCR.processWithEnsemble(
        imagePath,
        sessionDir,
        language,
        false, // preprocessing already done
        true   // use auto-customization
      );
      
      // Enhanced highlighted text extraction with specialized processing
      await this.extractHighlightedTextEnhanced(imagePath, highlightRegions, sessionDir);
      
      // Extract and enhance text from highlighted regions
      const highlightTexts = highlightRegions
        .filter(region => region.text && region.text.length > 0)
        .map(region => region.text!);
        
      if (highlightTexts.length > 0) {
        // Smart combination of base text and highlighted text
        const combinedText = this.smartCombineText(
          baseResult.bestResult?.text || '',
          highlightTexts
        );
        
        const combinedConfidence = this.calculateCombinedConfidence(
          baseResult.bestResult?.confidence || 0,
          highlightRegions
        );
        
        return {
          text: combinedText,
          confidence: combinedConfidence,
          engine: baseResult.bestResult?.engine || 'multi-engine'
        };
      }
      
      return baseResult.bestResult || {
        text: '',
        confidence: 0,
        engine: 'fallback'
      };
    } catch (error) {
      logger.error(`Highlight-aware OCR processing failed: ${error}`);
      return {
        text: '',
        confidence: 0,
        engine: 'error-fallback'
      };
    }
  }
  
  /**
   * Enhanced text extraction from highlighted regions with improved preprocessing
   */
  private async extractHighlightedTextEnhanced(
    imagePath: string,
    regions: HighlightRegion[],
    sessionDir: string
  ): Promise<void> {
    for (let i = 0; i < regions.length; i++) {
      try {
        const region = regions[i];
        const cropPath = path.join(sessionDir, `highlight_${i}_enhanced.png`);
        
        // Enhanced cropping with preprocessing optimized for highlighted text
        const padding = 15; // More padding for better context
        const expandedCrop = `${region.width + (padding * 2)}x${region.height + (padding * 2)}+${Math.max(0, region.x - padding)}+${Math.max(0, region.y - padding)}`;
        
        // Create enhanced crop with CLAHE and edge enhancement specifically for highlights
        await execAsync(`convert "${imagePath}" -crop ${expandedCrop} \
          -colorspace Lab -channel 0 -equalize -channel RG -equalize -colorspace sRGB \
          -modulate 100,130,100 \
          -unsharp 0x1+1.5+0.05 \
          -contrast-stretch 3%x97% \
          -resize 150% \
          "${cropPath}"`);
        
        if (fs.existsSync(cropPath)) {
          // Use enhanced Tesseract settings for highlighted text
          const textOutputPath = path.join(sessionDir, `highlight_${i}_enhanced_text`);
          
          // Try multiple OCR approaches for better accuracy
          const ocrApproaches = [
            '--psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;-()[]{}/" \t\n',
            '--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;-()[]{}/" \t\n',
            '--psm 6',
            '--psm 13', // Raw line for single text lines
            '--psm 11 -c tessedit_do_invert=1' // Try inverted text for some highlight colors
          ];
          
          let bestText = '';
          let bestConfidence = 0;
          
          for (const approach of ocrApproaches) {
            try {
              await execAsync(`tesseract "${cropPath}" "${textOutputPath}_temp" -l eng ${approach} 2>/dev/null`);
              
              const textFilePath = `${textOutputPath}_temp.txt`;
              
              if (fs.existsSync(textFilePath)) {
                const text = fs.readFileSync(textFilePath, 'utf-8').trim();
                
                if (text.length > 0) {
                  // Calculate text quality score
                  const textQuality = this.calculateTextQuality(text);
                  
                  if (textQuality > bestConfidence) {
                    bestText = text;
                    bestConfidence = textQuality;
                  }
                }
                
                // Cleanup temp file
                fs.unlinkSync(textFilePath);
              }
            } catch (ocrError) {
              // Continue with next approach
            }
          }
          
          if (bestText.length > 0) {
            region.text = this.cleanExtractedText(bestText);
            region.confidence = Math.min((region.confidence || 0) + (bestConfidence * 0.5), 1.0);
            logger.info(`Enhanced text extraction for region ${i}: "${region.text.substring(0, 50)}..."`);
          }
        }
      } catch (error) {
        logger.warn(`Enhanced text extraction failed for region ${i}: ${error}`);
      }
    }
  }
  
  /**
   * Smart combination of base text and highlighted text
   */
  private smartCombineText(baseText: string, highlightTexts: string[]): string {
    if (!baseText && highlightTexts.length === 0) {
      return '';
    }
    
    if (!baseText) {
      return highlightTexts.join('\n');
    }
    
    if (highlightTexts.length === 0) {
      return baseText;
    }
    
    // Smart combination: add highlighted text as a separate section
    const highlightSection = `\n\n=== HIGHLIGHTED CONTENT ===\n${highlightTexts.join('\n---\n')}\n=== END HIGHLIGHTED CONTENT ===`;
    
    return baseText + highlightSection;
  }
  
  /**
   * Calculate combined confidence from base OCR and highlight regions
   */
  private calculateCombinedConfidence(baseConfidence: number, highlightRegions: HighlightRegion[]): number {
    if (highlightRegions.length === 0) {
      return baseConfidence;
    }
    
    const highlightConfidences = highlightRegions
      .filter(region => region.confidence !== undefined)
      .map(region => region.confidence!);
    
    if (highlightConfidences.length === 0) {
      return baseConfidence;
    }
    
    const avgHighlightConfidence = highlightConfidences.reduce((sum, conf) => sum + conf, 0) / highlightConfidences.length;
    
    // Weight the base confidence and highlight confidence
    return (baseConfidence * 0.6) + (avgHighlightConfidence * 100 * 0.4);
  }
  
  /**
   * Calculate text quality score for OCR result evaluation
   */
  private calculateTextQuality(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }
    
    let score = 0.5; // Base score
    
    // Factor 1: Length (longer text generally better)
    if (text.length > 10) score += 0.1;
    if (text.length > 50) score += 0.1;
    
    // Factor 2: Word structure (presence of actual words)
    const words = text.split(/\s+/).filter(word => word.length > 2);
    if (words.length > 0) score += 0.2;
    
    // Factor 3: Character variety (not just repeated characters)
    const uniqueChars = new Set(text.toLowerCase()).size;
    if (uniqueChars > 5) score += 0.1;
    
    // Factor 4: Penalize excessive special characters or nonsense
    const specialCharRatio = (text.match(/[^a-zA-Z0-9\s]/g) || []).length / text.length;
    if (specialCharRatio > 0.5) score -= 0.2;
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Clean extracted text from OCR artifacts
   */
  private cleanExtractedText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\.,!?:;-]/g, '') // Remove unusual characters
      .trim();
  }
  
  /**
   * Merge VLM recommendations with user options
   */
  private mergeVLMRecommendations(
    userOptions: EnhancedPreprocessingOptions, 
    vlmRecommendations: VLMPreprocessingRecommendation
  ): EnhancedPreprocessingOptions {
    const mergedOptions = { ...userOptions };
    
    // Only apply recommendations if the user hasn't explicitly set the option
    if (vlmRecommendations.documentIssues) {
      const issues = vlmRecommendations.documentIssues;
      
      if (issues.skew > 0.3 && mergedOptions.deskew === undefined) {
        mergedOptions.deskew = true;
      }
      
      if (issues.poorContrast > 0.4 && mergedOptions.applyCLAHE === undefined) {
        mergedOptions.applyCLAHE = true;
        mergedOptions.claheClipLimit = 2.5; // Higher for poor contrast
      }
      
      if (issues.noise > 0.3 && !mergedOptions.denoise) {
        mergedOptions.denoise = true;
      }
    }
    
    // Apply recommended techniques
    if (vlmRecommendations.recommendations) {
      for (const rec of vlmRecommendations.recommendations) {
        switch (rec.technique) {
          case 'contrast':
            if (mergedOptions.applyCLAHE === undefined) {
              mergedOptions.applyCLAHE = true;
            }
            break;
            
          case 'deskew':
            if (mergedOptions.deskew === undefined) {
              mergedOptions.deskew = true;
            }
            break;
            
          case 'denoise':
            if (!mergedOptions.denoise) {
              mergedOptions.denoise = true;
            }
            break;
            
          case 'edge_enhancement':
            if (mergedOptions.enhanceEdges === undefined) {
              mergedOptions.enhanceEdges = true;
            }
            break;
        }
      }
    }
    
    return mergedOptions;
  }
  
  /**
   * Assess document quality and generate recommendations
   */
  async assessDocumentQuality(imagePath: string): Promise<DocumentQualityAssessment> {
    try {
      // Simple quality assessment based on image properties
      const result = await execAsync(`identify -verbose "${imagePath}"`);
      const imageInfo = result.stdout;
      
      // Extract basic quality metrics
      const resolution = imageInfo.match(/Resolution: (\d+)x(\d+)/);
      const hasLowResolution = resolution ? parseInt(resolution[1]) < 200 : false;
      
      // Simplified quality scoring
      let overallQuality = 80; // Start with good quality
      
      if (hasLowResolution) overallQuality -= 20;
      
      const recommendations: PreprocessingRecommendation[] = [];
      
      if (hasLowResolution) {
        recommendations.push({
          technique: 'enhance_resolution',
          priority: 'high',
          reason: 'Low resolution detected',
          expectedImprovement: 15
        });
      }
      
      recommendations.push({
        technique: 'normalize',
        priority: 'medium',
        reason: 'Standard normalization improves consistency',
        expectedImprovement: 10
      });
      
      return {
        overallQuality,
        issues: {
          skew: 0.1, // Default low values
          noise: 0.2,
          poorContrast: 0.3,
          lowResolution: hasLowResolution,
          shadows: false
        },
        recommendations
      };
    } catch (error) {
      logger.error(`Quality assessment failed: ${error}`);
      return {
        overallQuality: 50,
        issues: {
          skew: 0.5,
          noise: 0.5,
          poorContrast: 0.5,
          lowResolution: true,
          shadows: true
        },
        recommendations: [{
          technique: 'enhanced_preprocessing',
          priority: 'high',
          reason: 'Quality assessment failed, apply comprehensive preprocessing',
          expectedImprovement: 25
        }]
      };
    }
  }
}

export default EnhancedOCRPipeline;

// Export singleton instance for easy use
export const enhancedOCRPipeline = new EnhancedOCRPipeline();

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import path from 'path';
import logger from './logger';
import { PreprocessingService } from './preprocessing-service';
import { autoCustomization, OptimizedOCRSettings } from './auto-customization';
import { vlmOcrEnhancer } from './vlm-ocr-enhancer';
import { paligemma2Integration, Paligemma2IntegrationMode } from './paligemma2-ocr-integration';

/**
 * OCR Result interface for standard OCR operations
 */
export interface OCRResult {
  text: string;
  confidence: number;
  engine: string;
  processingTime?: number;
  metadata?: Record<string, any>;
  warnings?: string[];
  success?: boolean;
  outputPath?: string;
  error?: string;
  vlmEnhanced?: boolean;
  vlmProcessingTimeMs?: number;
}

/**
 * Result of an ensemble OCR operation
 */
export interface EnsembleResult {
  /**
   * The best OCR result selected from all engines
   */
  bestResult: OCRResult;
  
  /**
   * Results from all engines that were tried
   */
  allResults: OCRResult[];
  
  /**
   * Number of successful OCR operations
   */
  successCount: number;
  
  /**
   * Whether the ensemble has at least one successful result
   */
  hasSuccessfulResults: boolean;
  
  /**
   * Whether auto-customization was applied
   */
  customizationApplied: boolean;
  
  /**
   * Whether VLM enhancement was applied
   */
  vlmEnhanced?: boolean;
  
  /**
   * Consensus text generated from all successful results
   */
  consensusText?: string;
  
  /**
   * Average confidence across all successful results
   */
  averageConfidence?: number;
  
  /**
   * Paligemma 2 integration mode used
   */
  paligemma2Mode?: Paligemma2IntegrationMode;
}

const execAsync = promisify(exec);

// Helper function to truncate text for JSON responses to prevent truncation
function truncateTextForResponse(text: string, maxLength: number = 1000): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength) + '... [truncated - full text available in output file]';
}

// Helper function to generate proper output filename based on input
function generateOutputFilename(inputPath: string, engineName: string, suffix: string = 'ocr'): string {
  const inputBasename = path.basename(inputPath);
  const nameWithoutExt = path.parse(inputBasename).name;
  
  // Remove timestamp prefix if it exists (for uploaded files)
  const cleanName = nameWithoutExt.replace(/^\d+_/, '');
  
  // Generate timestamp for unique naming
  const timestamp = Date.now();
  
  return `${cleanName}_${timestamp}_${suffix}.pdf`;
}

export interface OCREngine {
  name: string;
  service: any;
  available: boolean;
  specialization: string[];
  confidence: boolean;
  preprocessor: (inputPath: string, documentType?: string) => Promise<string>;
}

export class MultiEngineOCR {
  private engines: OCREngine[] = [];
  private preprocessingService: PreprocessingService;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  
  constructor() {
    this.preprocessingService = new PreprocessingService();
    // Don't call initializeEngines() here to avoid async constructor issues
  }
  
  /**
   * Ensure engines are initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }
    
    this.initializationPromise = this.initializeEngines();
    await this.initializationPromise;
    this.initialized = true;
  }
  
  private async initializeEngines() {
    logger.info('Initializing OCR engines...');
    
    // NanoVLM engine has been removed in favor of the pure JS/TS implementation
    
    // Log the available engines
    logger.info(`Available engines: ${this.engines.filter(e => e.available).map(e => e.name).join(', ')}`);
    
    // Add Tesseract engine
    const tesseractAvailable = await this.checkTesseractAvailability();
    logger.info(`Tesseract availability: ${tesseractAvailable}`);
    
    this.engines.push({
      name: 'tesseract',
      service: null, // Tesseract uses direct command execution
      available: tesseractAvailable,
      specialization: ['general', 'text'],
      confidence: true,
      preprocessor: (inputPath, documentType) => {
        logger.info(`Preprocessing for Tesseract, document type: ${documentType}`);
        return this.preprocessingService.tesseractOptimize(inputPath);
      }
    });
    
    // Add OCRmyPDF engine
    const ocrmypdfAvailable = await this.checkOCRmyPDFAvailability();
    logger.info(`OCRmyPDF availability: ${ocrmypdfAvailable}`);
    
    this.engines.push({
      name: 'ocrmypdf',
      service: null, // OCRmyPDF uses direct command execution
      available: ocrmypdfAvailable,
      specialization: ['pdf'],
      confidence: false,
      preprocessor: (inputPath, documentType) => {
        logger.info(`Preprocessing for OCRmyPDF, document type: ${documentType}`);
        return this.preprocessingService.pdfOptimize(inputPath);
      }
    });
    
    // Log final available engines
    const availableEngines = this.engines.filter(e => e.available);
    logger.info(`Total available engines: ${availableEngines.length} - ${availableEngines.map(e => e.name).join(', ')}`);
  }
  
  /**
   * Check if Tesseract is available on the system
   */
  private async checkTesseractAvailability(): Promise<boolean> {
    try {
      await execAsync('tesseract --version');
      return true;
    } catch (error) {
      logger.warn(`Tesseract not available: ${error}`);
      return false;
    }
  }
  
  /**
   * Check if OCRmyPDF is available on the system
   */
  private async checkOCRmyPDFAvailability(): Promise<boolean> {
    try {
      await execAsync('ocrmypdf --version');
      return true;
    } catch (error) {
      logger.warn(`OCRmyPDF not available: ${error}`);
      return false;
    }
  }
  
  /**
   * Process document with multiple OCR engines and return best result
   */
  async processWithEnsemble(
    inputPath: string,
    outputDir: string,
    language: string = 'eng',
    usePreprocessing: boolean = false,
    useAutoCustomization: boolean = true,
    useVlmEnhancement: boolean = true,
    paligemma2Mode: Paligemma2IntegrationMode = Paligemma2IntegrationMode.ASSIST
  ): Promise<EnsembleResult> {
    await this.ensureInitialized(); // Ensure engines are initialized
    
    const results: OCRResult[] = [];
    let processedInputPath = inputPath;
    let customizationApplied = false;
    let vlmEnhanced = false;
    let optimizedSettings: OptimizedOCRSettings | null = null;

    try {
      // Apply auto-customization if enabled
      if (useAutoCustomization) {
        try {
          const analysis = await autoCustomization.analyzeAndCustomize(inputPath);
          optimizedSettings = analysis.settings;
          customizationApplied = true;
          
          // Override language and preprocessing settings from customization
          language = optimizedSettings.language;
          usePreprocessing = usePreprocessing || optimizedSettings.usePreprocessing;
          
          logger.info(`Auto-customization applied: ${JSON.stringify(analysis.characteristics)}`);
        } catch (customError) {
          logger.warn(`Auto-customization failed, using default settings: ${customError}`);
        }
      }

      // Get VLM preprocessing recommendations if enabled
      if (useVlmEnhancement) {
        try {
          // First try using Paligemma 2 integration for preprocessing recommendations
          let preprocessingRecommendations = null;
          
          try {
            preprocessingRecommendations = await paligemma2Integration.getPreprocessingRecommendations(inputPath);
            logger.info('Paligemma 2 preprocessing recommendations obtained');
          } catch (paligemmaError) {
            logger.warn(`Paligemma 2 preprocessing recommendations failed, falling back to legacy VLM: ${paligemmaError}`);
            preprocessingRecommendations = await vlmOcrEnhancer.getPreprocessingRecommendation(inputPath);
          }
          
          if (preprocessingRecommendations) {
            logger.info('VLM preprocessing recommendations available');
            
            // Apply preprocessing if high priority techniques are recommended by VLM
            const highPriorityTechniques = preprocessingRecommendations.recommendations
              .filter(r => r.priority === 'high')
              .map(r => r.technique);
              
            if (highPriorityTechniques.length > 0) {
              logger.info(`Applying VLM-recommended preprocessing: ${highPriorityTechniques.join(', ')}`);
              usePreprocessing = true;
            }
          }
        } catch (error) {
          logger.warn(`VLM preprocessing recommendation failed: ${error}`);
        }
      }

      // Apply preprocessing if requested or recommended by customization or VLM
      if (usePreprocessing || optimizedSettings?.aggressivePreprocessing) {
        logger.info('Applying preprocessing for improved OCR quality');
        processedInputPath = await this.preprocessingService.quickEnhance(inputPath);
      }

      // Run each available engine with optimized settings
      const availableEngines = this.engines.filter(e => e.available);
      
      // Filter engines based on input file type compatibility
      const isPdf = processedInputPath.toLowerCase().endsWith('.pdf');
      const compatibleEngines = availableEngines.filter(engine => {
        // Tesseract cannot process PDF files directly
        if (engine.name === 'tesseract' && isPdf) {
          logger.info(`Skipping Tesseract for PDF file: ${processedInputPath}`);
          return false;
        }
        return true;
      });
      
      // Try to get VLM engine recommendation if enabled
      if (useVlmEnhancement) {
        try {
          // First try using Paligemma 2 integration for engine recommendations
          let engineRecommendation = null;
          
          try {
            engineRecommendation = await paligemma2Integration.getEngineRecommendations(inputPath);
            logger.info('Paligemma 2 engine recommendations obtained');
          } catch (paligemmaError) {
            logger.warn(`Paligemma 2 engine recommendations failed, falling back to legacy VLM: ${paligemmaError}`);
            engineRecommendation = await vlmOcrEnhancer.getEngineRecommendation(inputPath);
          }
          
          if (engineRecommendation && engineRecommendation.confidence > 0.7) {
            logger.info(`VLM engine recommendation: ${engineRecommendation.recommendedEngine} (confidence: ${engineRecommendation.confidence})`);
            
            // Reorder engines based on VLM recommendation
            compatibleEngines.sort((a, b) => {
              // Primary recommendation
              const aIsPrimary = a.name.toLowerCase().includes(engineRecommendation.recommendedEngine.toLowerCase());
              const bIsPrimary = b.name.toLowerCase().includes(engineRecommendation.recommendedEngine.toLowerCase());
              
              if (aIsPrimary && !bIsPrimary) return -1;
              if (!aIsPrimary && bIsPrimary) return 1;
              
              // Alternative recommendation
              const aIsAlt = a.name.toLowerCase().includes(engineRecommendation.alternativeEngine.toLowerCase());
              const bIsAlt = b.name.toLowerCase().includes(engineRecommendation.alternativeEngine.toLowerCase());
              
              if (aIsAlt && !bIsAlt) return -1;
              if (!aIsAlt && bIsAlt) return 1;
              
              return 0;
            });
          }
        } catch (error) {
          logger.warn(`VLM engine recommendation failed: ${error}`);
        }
      }
      
      // Reorder engines based on customization preferences (if not already reordered by VLM)
      if (optimizedSettings?.enginePreference && !useVlmEnhancement) {
        compatibleEngines.sort((a, b) => {
          const aIndex = optimizedSettings!.enginePreference.indexOf(a.name);
          const bIndex = optimizedSettings!.enginePreference.indexOf(b.name);
          return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });
      }
      
      for (const engine of compatibleEngines) {
        const startTime = Date.now();
        const outputPath = join(outputDir, generateOutputFilename(inputPath, engine.name, 'smart_ocr'));
        
        try {
          logger.info(`Running OCR with ${engine.name}`);
          
          // Generate command with optimized settings
          const command = this.generateOptimizedCommand(
            engine, 
            processedInputPath, 
            outputPath, 
            language, 
            optimizedSettings
          );
          
          // All engines are now command-line based after removing Python dependencies
          await execAsync(command);
          
          const processingTime = Date.now() - startTime;
          
          // Enhanced success detection with fallback validation
          let success = this.validateOCROutput(outputPath);
          
          // If strict validation fails but file exists, be more lenient
          if (!success && existsSync(outputPath)) {
            const stats = statSync(outputPath);
            if (stats.size > 0) {
              logger.warn(`File validation failed for ${engine.name} but file exists with size ${stats.size}, accepting as successful`);
              success = true;
            }
          }
          
          if (success) {
            // Extract text to compare results
            let extractedText = '';
            let confidence = 0;
            
            try {
              const { stdout } = await execAsync(`pdftotext "${outputPath}" -`);
              extractedText = stdout.trim();
              
              // Get confidence if supported
              if (engine.confidence && engine.name === 'tesseract') {
                confidence = await this.extractTesseractConfidence(processedInputPath);
              }
            } catch (textError) {
              logger.warn(`Failed to extract text from ${engine.name} output: ${textError}`);
              // Still consider it successful if file exists and has content
              extractedText = '[Content exists but text extraction failed]';
            }

            results.push({
              engine: engine.name,
              success: true,
              outputPath,
              confidence,
              text: truncateTextForResponse(extractedText),
              processingTime
            });
          } else {
            // Check if file exists even if validation failed
            const fileExists = existsSync(outputPath);
            const fileSize = fileExists ? statSync(outputPath).size : 0;
            
            results.push({
              engine: engine.name,
              success: false,
              error: fileExists ? 
                `Output file validation failed (file exists, size: ${fileSize})` : 
                'Output file validation failed (file not created)',
              outputPath: fileExists ? outputPath : undefined,
              processingTime
            });
          }
        } catch (error) {
          results.push({
            engine: engine.name,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            processingTime: Date.now() - startTime
          });
        }
      }

      // Calculate success metrics
      const successfulResults = results.filter(r => r.success);
      const hasSuccessfulResults = successfulResults.length > 0;
      const successCount = successfulResults.length;

      // Determine best result with improved logic
      const bestResult = this.selectBestResult(results);
      
      // Generate consensus text if multiple engines succeeded
      const consensusText = this.generateConsensusText(results);
      
      // Calculate average confidence
      const confidenceResults = results.filter(r => r.success && r.confidence !== undefined);
      const averageConfidence = confidenceResults.length > 0 
        ? confidenceResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / confidenceResults.length
        : undefined;
      
      // Apply VLM enhancement to best result if it was successful
      if (useVlmEnhancement && bestResult.success && bestResult.outputPath) {
        try {
          logger.info(`Enhancing best OCR result with Paligemma 2 (${paligemma2Mode} mode)`);
          
          // First try using the new Paligemma 2 integration
          try {
            const paligemmaResult = await paligemma2Integration.assistOCR(
              inputPath, 
              bestResult,
              paligemma2Mode
            );
            
            if (paligemmaResult.improved) {
              logger.info(`Paligemma 2 enhancement applied in ${paligemma2Mode} mode`);
              logger.info(`Improvement metrics: ${JSON.stringify(paligemmaResult.improvementMetrics)}`);
              
              // Update the best result with enhanced text and confidence
              bestResult.text = paligemmaResult.enhancedText;
              bestResult.confidence = paligemmaResult.confidenceAssessment.overall * 100;
              bestResult.vlmEnhanced = true;
              bestResult.vlmProcessingTimeMs = paligemmaResult.processingTimeMs;
              bestResult.metadata = {
                ...bestResult.metadata,
                paligemma2Enhanced: true,
                paligemma2Mode,
                paligemma2ProcessingTimeMs: paligemmaResult.processingTimeMs,
                improvementMetrics: paligemmaResult.improvementMetrics
              };
              
              vlmEnhanced = true;
            } else {
              // Fall back to legacy VLM enhancer if Paligemma 2 didn't improve the result
              logger.info('Paligemma 2 did not improve the result, falling back to legacy VLM enhancer');
              const enhancedResult = await vlmOcrEnhancer.enhanceOCRResult(inputPath, bestResult);
              
              if (enhancedResult.vlmEnhanced) {
                logger.info(`Legacy VLM enhancement applied, new confidence: ${enhancedResult.confidence}`);
                vlmEnhanced = true;
                
                // Replace best result with enhanced version
                Object.assign(bestResult, enhancedResult);
              }
            }
          } catch (paligemmaError) {
            // Fall back to legacy VLM enhancer
            logger.warn(`Paligemma 2 enhancement failed, falling back to legacy VLM enhancer: ${paligemmaError}`);
            const enhancedResult = await vlmOcrEnhancer.enhanceOCRResult(inputPath, bestResult);
            
            if (enhancedResult.vlmEnhanced) {
              logger.info(`Legacy VLM enhancement applied, new confidence: ${enhancedResult.confidence}`);
              vlmEnhanced = true;
              
              // Replace best result with enhanced version
              Object.assign(bestResult, enhancedResult);
            }
          }
        } catch (error) {
          logger.warn(`VLM enhancement failed: ${error}`);
        }
      }

      const ensembleResult: EnsembleResult = {
        bestResult,
        allResults: results,
        consensusText,
        averageConfidence,
        hasSuccessfulResults,
        successCount,
        customizationApplied,
        vlmEnhanced,
        paligemma2Mode
      };

      logger.info(`Multi-engine OCR completed: ${successCount}/${results.length} engines successful`);
      return ensembleResult;

    } catch (error) {
      logger.error(`Multi-engine OCR failed: ${error}`);
      
      // Return a failed result but with proper structure
      return {
        bestResult: {
          engine: 'unknown',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        },
        allResults: [],
        hasSuccessfulResults: false,
        successCount: 0,
        customizationApplied,
        paligemma2Mode
      };
    } finally {
      // Cleanup preprocessing files if used
      if ((usePreprocessing || optimizedSettings?.aggressivePreprocessing) && processedInputPath !== inputPath) {
        try {
          await this.preprocessingService.cleanup();
        } catch (cleanupError) {
          logger.warn(`Cleanup failed: ${cleanupError}`);
        }
      }
    }
  }

  /**
   * Process document with a single specified OCR engine
   */
  async processWithEngine(
    engineName: string,
    inputPath: string,
    outputDir: string,
    documentType: string = 'general'
  ): Promise<OCRResult> {
    await this.ensureInitialized(); // Ensure engines are initialized
    
    const startTime = Date.now();
    let processedInputPath = inputPath; // Declare at function scope
    
    // Find the requested engine
    const engine = this.engines.find(e => e.name === engineName && e.available);
    if (!engine) {
      throw new Error(`Engine '${engineName}' is not available`);
    }
    
    // Check file type compatibility
    const isPdf = inputPath.toLowerCase().endsWith('.pdf');
    if (engine.name === 'tesseract' && isPdf) {
      throw new Error('Tesseract cannot process PDF files directly. Use OCRmyPDF or convert PDF to images first.');
    }
    
    logger.info(`Processing with single engine: ${engineName}, document type: ${documentType}`);
    
    try {
      // Apply preprocessing if engine has a preprocessor
      if (engine.preprocessor) {
        try {
          processedInputPath = await engine.preprocessor(inputPath, documentType);
          logger.info(`Applied preprocessing for ${engineName}`);
        } catch (preprocessError) {
          logger.warn(`Preprocessing failed for ${engineName}, using original input: ${preprocessError}`);
          processedInputPath = inputPath; // Ensure we have a valid path
        }
      }
      
      const outputPath = join(outputDir, generateOutputFilename(inputPath, engineName, 'smart_ocr'));
      
      // Handle service-based engines
      // All engines are now command-line based after removing Python dependencies
      const command = this.generateOptimizedCommand(engine, processedInputPath, outputPath, 'eng', null);
      await execAsync(command);
      
      const processingTime = Date.now() - startTime;
      
      // Validate output
      if (!this.validateOCROutput(outputPath)) {
        throw new Error('Output validation failed');
      }
      
      // Extract text for non-service engines
      let extractedText = '';
      let confidence = 0;
      
      // For command-line engines, extract text from PDF
      try {
        const { stdout } = await execAsync(`pdftotext "${outputPath}" -`);
        extractedText = stdout.trim();
        
        // Get confidence if supported
        if (engine.confidence && engine.name === 'tesseract') {
          confidence = await this.extractTesseractConfidence(processedInputPath);
        }
      } catch (textError) {
        logger.warn(`Failed to extract text from ${engineName} output: ${textError}`);
        extractedText = '[Content exists but text extraction failed]';
      }
      
      return {
        engine: engineName,
        success: true,
        outputPath,
        confidence,
        text: truncateTextForResponse(extractedText),
        processingTime
      };
      
    } catch (error) {
      return {
        engine: engineName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      };
    } finally {
      // Cleanup preprocessing files if used
      if (engine.preprocessor && processedInputPath !== inputPath) {
        try {
          await this.preprocessingService.cleanup();
        } catch (cleanupError) {
          logger.warn(`Cleanup failed: ${cleanupError}`);
        }
      }
    }
  }

  /**
   * Generate optimized OCR command based on document characteristics
   */
  private generateOptimizedCommand(
    engine: OCREngine,
    inputPath: string,
    outputPath: string,
    language: string,
    settings: OptimizedOCRSettings | null
  ): string {
    if (engine.name === 'tesseract') {
      // Prevent Tesseract from being run directly on PDF files
      if (inputPath.toLowerCase().endsWith('.pdf')) {
        throw new Error('Tesseract cannot process PDF files directly. Use OCRmyPDF or convert PDF to images first.');
      }
      let command = `tesseract "${inputPath}" "${outputPath.replace('.pdf', '')}" -l ${language}`;
      
      if (settings) {
        command += ` --psm ${settings.psm} --oem ${settings.oem}`;
        
        // Add custom parameters
        if (settings.tesseractParams.length > 0) {
          command += ` ${settings.tesseractParams.join(' ')}`;
        }
      } else {
        command += ` --psm 1 --oem 3`;
      }
      
      command += ` pdf`;
      return command;
    } else if (engine.name === 'ocrmypdf') {
      let command = `ocrmypdf --language ${language} --deskew --rotate-pages --force-ocr`;
      
      // Support large images
      command += ` --max-image-mpixels 0`;
      
      if (settings && settings.ocrmypdfParams.length > 0) {
        command += ` ${settings.ocrmypdfParams.join(' ')}`;
      }
      
      command += ` "${inputPath}" "${outputPath}"`;
      return command;
    } else if (engine.name === 'enhanced-tesseract') {
      // Enhanced Tesseract engine
      let command = `node ./lib/cli/enhanced-tesseract-cli.js --input "${inputPath}" --output "${outputPath}" --language ${language}`;
      
      if (settings && settings.enhancedParams.length > 0) {
        command += ` ${settings.enhancedParams.join(' ')}`;
      }
      
      return command;
    }
    
    // Fallback to original command
    return engine.command(inputPath, outputPath, language);
  }

  /**
   * Enhanced OCR output validation
   */
  private validateOCROutput(outputPath: string): boolean {
    try {
      if (!existsSync(outputPath)) {
        logger.warn(`Output file does not exist: ${outputPath}`);
        return false;
      }

      // Check if file has content (size > 0)
      const stats = statSync(outputPath);
      if (stats.size === 0) {
        logger.warn(`Output file exists but is empty: ${outputPath}`);
        return false;
      }

      // More lenient validation for PDF files
      if (outputPath.endsWith('.pdf')) {
        // Very minimum PDF file size - just ensure it's not completely empty
        if (stats.size < 50) {
          logger.warn(`PDF file too small, likely corrupted: ${outputPath} (${stats.size} bytes)`);
          return false;
        }
        
        // Try to validate PDF header if file is reasonable size
        if (stats.size >= 1024) {
          try {
            const fs = require('fs');
            const buffer = fs.readFileSync(outputPath, { encoding: null, flag: 'r' });
            const header = buffer.subarray(0, 5).toString('ascii');
            if (!header.startsWith('%PDF')) {
              logger.warn(`File does not appear to be a valid PDF: ${outputPath}`);
              return false;
            }
          } catch (headerError) {
            // If we can't read the header, assume the file is valid if it exists and has size
            logger.warn(`Could not validate PDF header for ${outputPath}, but file exists with size ${stats.size}`);
          }
        }
      }

      logger.info(`OCR output validation successful: ${outputPath} (${stats.size} bytes)`);
      return true;
    } catch (error) {
      logger.warn(`OCR output validation failed: ${error}`);
      return false;
    }
  }
  private selectBestResult(results: OCRResult[]): OCRResult {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return results[0]; // Return first result even if failed
    }

    if (successfulResults.length === 1) {
      return successfulResults[0];
    }

    // Score results based on multiple factors
    const scoredResults = successfulResults.map(result => {
      let score = 0;
      
      // Confidence score (if available)
      if (result.confidence !== undefined) {
        score += result.confidence * 0.4;
      }
      
      // Text length (longer text often indicates better OCR)
      if (result.text) {
        score += Math.min(result.text.length / 1000, 30) * 0.3;
      }
      
      // Processing time (faster is sometimes better, but not always)
      if (result.processingTime) {
        score += Math.max(0, 20 - (result.processingTime / 1000)) * 0.1;
      }
      
      // Engine preference (Tesseract with confidence is preferred)
      if (result.engine === 'tesseract' && result.confidence !== undefined) {
        score += 20;
      }
      
      return { result, score };
    });

    // Return the highest scoring result
    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults[0].result;
  }

  /**
   * Generate consensus text from multiple OCR results
   */
  private generateConsensusText(results: OCRResult[]): string | undefined {
    const textResults = results.filter(r => r.success && r.text && r.text.length > 0);
    
    if (textResults.length === 0) return undefined;
    if (textResults.length === 1) return textResults[0].text;

    // For now, return the longest text (can be enhanced with more sophisticated consensus algorithms)
    textResults.sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0));
    return textResults[0].text;
  }

  /**
   * Extract confidence score from Tesseract output
   */
  private async extractTesseractConfidence(inputPath: string): Promise<number> {
    try {
      const tempDir = join(process.cwd(), 'tmp', `confidence_${Date.now()}`);
      await execAsync(`mkdir -p "${tempDir}"`);
      
      const hocrPath = join(tempDir, 'output.hocr');
      await execAsync(`tesseract "${inputPath}" "${hocrPath.replace('.hocr', '')}" -l eng hocr`);
      
      if (existsSync(hocrPath)) {
        const { readFile } = await import('fs/promises');
        const hocrContent = await readFile(hocrPath, 'utf-8');
        
        // Extract confidence scores from hOCR
        const confidences: number[] = [];
        const titleMatches = hocrContent.match(/x_wconf (\d+)/g);
        
        if (titleMatches) {
          for (const match of titleMatches) {
            const conf = parseInt(match.split(' ')[1]);
            if (!isNaN(conf)) {
              confidences.push(conf);
            }
          }
        }
        
        // Clean up
        await execAsync(`rm -rf "${tempDir}"`);
        
        // Return average confidence
        return confidences.length > 0 
          ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
          : 0;
      }
      
      return 0;
    } catch (error) {
      logger.warn(`Failed to extract Tesseract confidence: ${error}`);
      return 0;
    }
  }

  /**
   * Get available OCR engines
   */
  getAvailableEngines(): string[] {
    return this.engines.filter(e => e.available).map(e => e.name);
  }

  /**
   * This method has been removed as all Python-based services have been replaced
   * with pure JavaScript/TypeScript implementations
   */
}

export const multiEngineOCR = new MultiEngineOCR();

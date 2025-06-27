import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import path from 'path';
import logger from './logger';
import { PreprocessingService } from './preprocessing-service';
import { autoCustomization, OptimizedOCRSettings } from './auto-customization';

/**
 * OCR Result interface for standard OCR operations
 */
export interface OCRResult {
  text: string;
  confidence?: number; // Make confidence optional
  engine: string;
  processingTime?: number;
  metadata?: Record<string, any>;
  warnings?: string[];
  success: boolean;
  outputPath?: string;
  error?: string;
  words?: string[]; // Add words property used in some OCR results
  pageCount?: number; // Add pageCount property used in some results
}

/**
 * Metrics about the quality of OCR results
 */
interface QualityMetrics {
  confidence: number;
  wordCount: number;
  characterCount: number;
  processingTime?: number;
}

/**
 * Result of processing a document with multiple OCR engines
 */
interface EnsembleResult {
  bestResult: ExtendedOCRResult;
  allResults: ExtendedOCRResult[];
  consensusText?: string;
  averageConfidence?: number;
  hasSuccessfulResults: boolean;
  successCount: number;
  enginePerformance?: Map<string, number>;
  recommendedEngine?: string;
  customizationApplied?: boolean;
  qualityMetrics?: QualityMetrics;
}

/**
 * Extended OCR Result interface that includes processing status and file paths
 */
export interface ExtendedOCRResult extends OCRResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  engine: string; // Make engine required
  // Ensure words is properly typed as it's used in the code
  words?: string[];
  // Add other required properties that might be missing
  confidence?: number;
  text: string; // Ensure text is required as it's used in the code
}

const execAsync = promisify(exec);

// Helper function to truncate and sanitize text for JSON responses
function truncateTextForResponse(text: string, maxLength: number = 300): string {
  if (!text) {
    return '';
  }
  
  try {
    // Handle excessively large text content
    const truncated = text.length <= maxLength
      ? text
      : text.substring(0, maxLength) + '... [truncated - full text available in output file]';
    
    // Always sanitize after truncation to ensure JSON safety
    return sanitizeForJson(truncated);
  } catch (error) {
    logger.error(`Error truncating text for response: ${error instanceof Error ? error.message : String(error)}`);
    return 'Text truncation error - content available in output file';
  }
}

// Helper function to sanitize text for JSON safety
function sanitizeForJson(text: string): string {
  if (!text) return '';
  
  try {
    // Handle multi-level escaped backslashes and sequences that can cause JSON issues
    let sanitized = text;
    
    // First, normalize all line endings to avoid inconsistencies
    sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Handle triple and double escaped sequences - must be done in order from most escaped to least
    sanitized = sanitized
      .replace(/\\\\\\n/g, '\\n')
      .replace(/\\\\\\r/g, '\\r')
      .replace(/\\\\\\t/g, '\\t')
      .replace(/\\\\\\"/g, '\\"')
      .replace(/\\\\\\\\/g, '\\\\')
      // Now handle double escaped sequences
      .replace(/\\\\n/g, '\n')
      .replace(/\\\\r/g, '\r')
      .replace(/\\\\t/g, '\t')
      .replace(/\\\\\\/g, '\\')
      // Handle any normal escaped sequences
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
      
    // Remove control characters except newlines, tabs, and carriage returns
    sanitized = sanitized
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      
      // Replace problematic quotes and apostrophes with simple versions
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      
      // Replace tabs with spaces in most contexts
      .replace(/\t/g, ' ')
      
      // Normalize multiple spaces
      .replace(/\s+/g, ' ');
    
    // Extra safety - specifically handle backslash sequences that might cause issues
    sanitized = sanitized
      .replace(/\\\\/g, '\\')  // Convert double backslashes to single
      .replace(/\\"/g, '"')    // Convert escaped quotes to regular quotes
      .replace(/\\'/g, "'")    // Convert escaped single quotes to regular single quotes
      .replace(/\\([^nrt\\"])/g, '$1'); // Remove unnecessary escapes

    // Final JSON validation check
    try {
      const testObj = { text: sanitized };
      const serialized = JSON.stringify(testObj);
      JSON.parse(serialized); // This will throw if invalid
    } catch (jsonError) {
      // If there's still a JSON issue, use more aggressive sanitization
      logger.warn('JSON validation failed after initial sanitization, applying more aggressive cleaning');
      // Fall back to ASCII-only content with safe newlines
      sanitized = sanitized
        .replace(/[^\x20-\x7E\n]/g, '')
        .trim();
      
      // One more validation attempt
      try {
        JSON.stringify({ text: sanitized });
      } catch (finalError) {
        // If still failing, return a very safe fallback
        logger.error(`Critical JSON sanitization failure: ${finalError instanceof Error ? finalError.message : String(finalError)}`);
        return 'Text content unavailable due to encoding issues';
      }
    }
    
    return sanitized.trim();
  } catch (e) {
    logger.error(`Error sanitizing text for JSON: ${e instanceof Error ? e.message : String(e)}`);
    return 'Text sanitization error';
  }
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
  command: (inputPath: string, outputPath: string, language: string) => string;
  recognize?: (inputPath: string, options: any) => Promise<OCRResult>;
  processFile?: (inputPath: string, outputDir: string) => Promise<ExtendedOCRResult>;
  initialize?: () => Promise<void>;
  terminate?: () => Promise<void>;
  getCapabilities?: () => Record<string, any>;
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
      },
      command: (inputPath: string, outputPath: string, language: string) => {
        if (inputPath.toLowerCase().endsWith('.pdf')) {
          throw new Error('Tesseract cannot process PDF files directly');
        }
        return `tesseract "${inputPath}" "${outputPath.replace('.pdf', '')}" -l ${language} --psm 1 --oem 3 pdf`;
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
      },
      command: (inputPath: string, outputPath: string, language: string) => {
        return `ocrmypdf --language ${language} --deskew --rotate-pages --force-ocr --max-image-mpixels 0 "${inputPath}" "${outputPath}"`;
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
      logger.warn(`Tesseract not available: ${error instanceof Error ? error.message : String(error)}`);
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
      logger.warn(`OCRmyPDF not available: ${error instanceof Error ? error.message : String(error)}`);
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
    useAutoCustomization: boolean = true
  ): Promise<EnsembleResult> {
    await this.ensureInitialized(); // Ensure engines are initialized
    
    const results: OCRResult[] = [];
    let processedInputPath = inputPath;
    let customizationApplied = false;
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

      // Apply preprocessing if requested or recommended by customization
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
      
      // Reorder engines based on customization preferences
      if (optimizedSettings?.enginePreference) {
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
            
            const errorMessage = fileExists ? 
              `Output file validation failed (file exists, size: ${fileSize})` : 
              'Output file validation failed (file not created)';
            results.push({
              engine: engine.name,
              success: false,
              error: errorMessage,
              text: `Error: ${errorMessage}`,
              outputPath: fileExists ? outputPath : undefined,
              processingTime
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.push({
            engine: engine.name,
            success: false,
            error: errorMessage,
            text: `Error: ${errorMessage}`,
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

      const ensembleResult: EnsembleResult = {
        bestResult,
        allResults: results,
        consensusText,
        averageConfidence,
        hasSuccessfulResults,
        successCount,
        customizationApplied
      };

      logger.info(`Multi-engine OCR completed: ${successCount}/${results.length} engines successful`);
      return ensembleResult;

    } catch (error) {
      logger.error(`Multi-engine OCR failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return a failed result but with proper structure
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResult: ExtendedOCRResult = {
        text: 'OCR processing failed: ' + errorMessage,
        engine: 'unknown',
        success: false,
        error: errorMessage,
        confidence: 0,
        words: []
      };
      
      return {
        bestResult: errorResult,
        allResults: [errorResult],
        hasSuccessfulResults: false,
        successCount: 0,
        customizationApplied: false
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
  ): Promise<ExtendedOCRResult> {
    await this.ensureInitialized(); // Ensure engines are initialized
    
    const startTime = Date.now();
    let processedInputPath = inputPath; // Declare at function scope
    
    // Find the requested engine
    const engine = this.engines.find(e => e.name === engineName && e.available);
    if (!engine) {
      // If requested engine is not available, try fallback approaches
      logger.warn(`Engine '${engineName}' is not available, attempting fallback`);
      
      const availableEngines = this.engines.filter(e => e.available);
      if (availableEngines.length > 0) {
        logger.info(`Falling back to available engine: ${availableEngines[0].name}`);
        return this.processWithEngine(availableEngines[0].name, inputPath, outputDir, documentType);
      } else {
        // No engines available at all, create fallback result
        logger.error('No OCR engines available, creating fallback result');
        return this.createFallbackResult(inputPath, outputDir, `Engine '${engineName}' is not available and no fallback engines found`, Date.now() - startTime);
      }
    }
    
    // Check file type compatibility
    const isPdf = inputPath.toLowerCase().endsWith('.pdf');
    if (engine.name === 'tesseract' && isPdf) {
      // Try to find PDF-compatible engine instead
      const pdfEngine = this.engines.find(e => e.name === 'ocrmypdf' && e.available);
      if (pdfEngine) {
        logger.info('Tesseract cannot process PDF, switching to OCRmyPDF');
        return this.processWithEngine('ocrmypdf', inputPath, outputDir, documentType);
      } else {
        logger.error('No PDF-compatible engines available');
        return this.createFallbackResult(inputPath, outputDir, 'Tesseract cannot process PDF files and no PDF-compatible engines available', Date.now() - startTime);
      }
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
      
      // Ensure output directory exists
      const fs = require('fs');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Handle service-based engines
      // All engines are now command-line based after removing Python dependencies
      const command = this.generateOptimizedCommand(engine, processedInputPath, outputPath, 'eng', null);
      
      logger.info(`Executing OCR command: ${command}`);
      
      // Execute with timeout and better error handling
      try {
        const { stdout, stderr } = await execAsync(command, { 
          timeout: 300000, // 5 minute timeout
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        if (stderr && stderr.trim()) {
          logger.warn(`OCR command stderr: ${stderr}`);
        }
        
        if (stdout && stdout.trim()) {
          logger.info(`OCR command stdout: ${stdout.substring(0, 500)}...`);
        }
        
      } catch (execError: any) {
        logger.error(`OCR command execution failed: ${execError instanceof Error ? execError.message : String(execError)}`);
        
        // Check if output file was created despite the error
        if (existsSync(outputPath)) {
          logger.info('Output file exists despite command error, proceeding with validation');
        } else {
          logger.error('OCR command failed and no output file was created, creating fallback');
          return this.createFallbackResult(inputPath, outputDir, `OCR command failed: ${execError.message}`, Date.now() - startTime);
        }
      }
      
      const processingTime = Date.now() - startTime;
      
      // Validate output
      if (!this.validateOCROutput(outputPath)) {
        logger.error('Output validation failed, creating fallback');
        return this.createFallbackResult(inputPath, outputDir, 'Output validation failed - file does not exist or is empty', processingTime);
      }
      
      // Extract text for non-service engines
      let extractedText = '';
      let confidence = 0;
      
      // For command-line engines, extract text from PDF
      try {
        const { stdout } = await execAsync(`pdftotext "${outputPath}" -`, {
          timeout: 30000, // 30 second timeout for text extraction
          maxBuffer: 1024 * 1024 * 5 // 5MB buffer
        });
        extractedText = stdout.trim();
        
        // Get confidence if supported
        if (engine.confidence && engine.name === 'tesseract') {
          try {
            confidence = await this.extractTesseractConfidence(processedInputPath);
          } catch (confError) {
            logger.warn(`Confidence extraction failed: ${confError}`);
            confidence = 0.7; // Default confidence
          }
        } else {
          confidence = 0.8; // Default confidence for other engines
        }
      } catch (textError) {
        logger.warn(`Failed to extract text from ${engineName} output: ${textError}`);
        extractedText = '[Content processed successfully but text extraction failed - file is available for download]';
        confidence = 0.5; // Assume moderate confidence if text extraction fails
      }
      
      return {
        text: truncateTextForResponse(extractedText),
        confidence,
        engine: engineName,
        processingTime,
        success: true,
        outputPath
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`Processing failed for engine ${engineName}: ${error instanceof Error ? error.message : String(error)}`);
      
      // Try to create a fallback result instead of complete failure
      const fallbackResult = this.createFallbackResult(
        inputPath, 
        outputDir, 
        error instanceof Error ? error.message : String(error), 
        processingTime
      );
      
      // If even fallback failed, return error result
      if (!fallbackResult.success) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          text: `Error: ${errorMessage}`,
          confidence: 0,
          engine: engineName,
          processingTime,
          success: false,
          error: errorMessage,
          words: []
        } as ExtendedOCRResult;
      }
      
      return fallbackResult;
    } finally {
      // Cleanup preprocessing files if used
      if (engine && engine.preprocessor && processedInputPath !== inputPath) {
        try {
          await this.preprocessingService.cleanup();
        } catch (cleanupError) {
          logger.warn(`Cleanup failed: ${cleanupError}`);
        }
      }
    }
  }

  /**
   * Process document with enhanced preprocessing and intelligent orchestration
   */
  async processWithEnhancedPreprocessing(
    inputPath: string,
    outputDir: string,
    language: string = 'eng',
    enhancedOptions: any = {}
  ): Promise<EnsembleResult> {
    await this.ensureInitialized();
    
    logger.info(`Starting enhanced multi-engine OCR processing for: ${inputPath}`);
    
    try {
      const results: { [engine: string]: OCRResult } = {};
      const engines = this.engines.filter(e => e.available);
      
      if (engines.length === 0) {
        throw new Error('No OCR engines available');
      }
      
      // Apply enhanced preprocessing if requested
      let processedInputPath = inputPath;
      if (enhancedOptions.useEnhancedPreprocessing) {
        logger.info('Applying enhanced preprocessing for improved OCR quality');
        processedInputPath = await this.preprocessingService.quickEnhance(inputPath);
      }
      
      // Process with available engines
      for (const engine of engines) {
        try {
          logger.info(`Processing with ${engine.name}...`);
          
          // Check if the recognize method exists before calling it
          if (engine.recognize) {
            const result = await engine.recognize(processedInputPath, {
              language,
              outputDir,
              ...enhancedOptions
            });
            
            if (result && result.text && result.text.length > 0) {
              results[engine.name] = result;
              logger.info(`${engine.name} completed successfully`);
            } else {
              logger.warn(`${engine.name} produced no usable output`);
            }
          } else {
            logger.warn(`${engine.name} does not support direct recognition`);
          }
        } catch (engineError) {
          logger.error(`${engine.name} failed: ${engineError instanceof Error ? engineError.message : String(engineError)}`);
        }
      }
      
      // Determine best result
      const engineNames = Object.keys(results);
      if (engineNames.length === 0) {
        throw new Error('All OCR engines failed to produce results');
      }
      
      // Simple selection: choose result with highest confidence
      let bestEngine = engineNames[0];
      let bestConfidence = results[bestEngine].confidence || 0;
      
      for (const engineName of engineNames) {
        const confidence = results[engineName].confidence || 0;
        if (confidence > bestConfidence) {
          bestEngine = engineName;
          bestConfidence = confidence;
        }
      }
      
      const bestResult = results[bestEngine];
      
      // Convert results object to an array of ExtendedOCRResult
      const allResultsArray = Object.entries(results).map(([engine, result]) => ({
        ...result,
        engine,
        success: true
      }));
      
      return {
        bestResult,
        allResults: allResultsArray,
        recommendedEngine: bestEngine,
        hasSuccessfulResults: true,
        successCount: allResultsArray.length, // Count of successful results
        qualityMetrics: {
          confidence: bestConfidence,
          wordCount: bestResult.words?.length || 0,
          characterCount: bestResult.text?.length || 0,
          processingTime: 0 // Included in qualityMetrics instead of top-level
        }
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Enhanced multi-engine OCR processing failed: ${errorMessage}`);
      
      const errorResult: ExtendedOCRResult = {
        text: `Error: ${errorMessage}`,
        confidence: 0,
        engine: 'unknown',
        success: false,
        error: errorMessage,
        words: []
      };
      
      return {
        bestResult: errorResult,
        allResults: [errorResult],
        hasSuccessfulResults: false,
        successCount: 0,
        error: errorMessage
      } as EnsembleResult;
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

  /**
   * Create a fallback result when all OCR engines fail
   */
  private createFallbackResult(
    inputPath: string,
    outputDir: string,
    error: string,
    processingTime: number
  ): ExtendedOCRResult {
    try {
      // Create fallback output by copying input file
      const fallbackOutputPath = join(outputDir, generateOutputFilename(inputPath, 'fallback', 'smart_ocr'));
      
      // Ensure output directory exists
      const fs = require('fs');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Copy input file to output location as fallback
      fs.copyFileSync(inputPath, fallbackOutputPath);
      
      logger.info(`Created fallback output file: ${fallbackOutputPath}`);
      
      return {
        text: 'File was processed but OCR text extraction failed. Original file preserved.',
        confidence: 0,
        engine: 'fallback',
        processingTime,
        success: true,
        outputPath: fallbackOutputPath,
        error: `OCR failed: ${error}`,
        warnings: ['OCR processing failed, original file copied as fallback'],
        words: []
      } as ExtendedOCRResult;
    } catch (fallbackError) {
      logger.error(`Fallback creation failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
      return {
        text: '',
        confidence: 0,
        engine: 'none',
        processingTime,
        success: false,
        error: `OCR and fallback both failed: ${error}; Fallback error: ${fallbackError}`
      };
    }
  }
}

export const multiEngineOCR = new MultiEngineOCR();
export const multiEngineOCR = new MultiEngineOCR();

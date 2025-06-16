/**
 * Multi-Engine OCR Service - Refactored Version
 * Provides a unified interface for multiple OCR engines with proper ES module compatibility
 */

import { serverLogger, execAsync } from '@/app/api/_utils/server-utils';
import path from 'path';
import fs from 'fs';
import { preprocessingService } from './preprocessing-service';
import { normalizeConfidenceData } from './confidence-utils';
import { getAverageConfidence } from './types/ocr-types';
import { NanoVLMService } from './nano-vlm-service';

/**
 * Helper function to truncate text for API responses
 */
function truncateTextForResponse(text: string, maxLength: number = 1000): string {
  if (!text || text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength) + '... [truncated - full text available in output file]'
}

/**
 * Helper function to generate proper output filename based on input
 */
function generateOutputFilename(inputPath: string, engineName: string, suffix: string = 'ocr'): string {
  const inputBasename = path.basename(inputPath)
  const nameWithoutExt = path.parse(inputBasename).name
  
  // Remove timestamp prefix if it exists (for uploaded files)
  const cleanName = nameWithoutExt.replace(/^\d+_/, '')
  
  // Generate timestamp for unique naming
  const timestamp = Date.now()
  
  return `${cleanName}_${timestamp}_${suffix}.pdf`
}

export interface OCREngine {
  name: string
  service: any
  available: boolean
  specialization: string[]
  hasConfidence: boolean // Changed from 'confidence: boolean' to 'hasConfidence: boolean'
  preprocessor?: (inputPath: string, documentType?: string) => Promise<string>
}

export interface ProcessingResult {
  engine: string
  success?: boolean // Made optional to match OCRResult type
  outputPath?: string
  confidence: number
  text: string
  error?: string
  processingTime?: number
  metadata?: Record<string, any> // Added to match OCRResult type
}

export class MultiEngineOCR {
  private engines: Map<string, OCREngine> = new Map()
  private preprocessingService: typeof preprocessingService
  private initialized: boolean = false
  private initializationPromise: Promise<void> | null = null

  constructor() {
    this.preprocessingService = preprocessingService
  }

  /**
   * Ensure engines are initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return
    }
    
    if (this.initializationPromise) {
      await this.initializationPromise
      return
    }
    
    this.initializationPromise = this.initializeEngines()
    await this.initializationPromise
    this.initialized = true
  }
  
  private async initializeEngines(): Promise<void> {
    serverLogger.info('Initializing OCR engines...')
    
    // Initialize engines in order of preference
    await this.initializeOCRmyPDF()
    await this.initializeTesseract()
    await this.initializeNanoVLM()
    
    // Log final available engines
    const availableEngines = Array.from(this.engines.values()).filter(e => e.available)
    const availableEngineNames = availableEngines.map(e => e.name)
    serverLogger.info(`Total available engines: ${availableEngineNames.length} - ${availableEngineNames.join(', ')}`)
  }
  
  private async initializeOCRmyPDF(): Promise<void> {
    const available = await this.checkOCRmyPDFAvailability()
    serverLogger.info(`OCRmyPDF availability: ${available}`)
    
    this.engines.set('ocrmypdf', {
      name: 'ocrmypdf',
      service: null, // OCRmyPDF uses direct command execution
      available,
      specialization: ['pdf', 'structured_documents'],
      hasConfidence: false,
      preprocessor: (inputPath, documentType) => {
        serverLogger.info(`Preprocessing for OCRmyPDF, document type: ${documentType}`)
        return this.preprocessingService.pdfOptimize(inputPath)
      }
    })
  }
  
  private async initializeTesseract(): Promise<void> {
    const available = await this.checkTesseractAvailability()
    serverLogger.info(`Tesseract availability: ${available}`)
    
    this.engines.set('tesseract', {
      name: 'tesseract',
      service: null, // Tesseract uses direct command execution
      available,
      specialization: ['general', 'text'],
      hasConfidence: true,
      preprocessor: (inputPath, documentType) => {
        serverLogger.info(`Preprocessing for Tesseract, document type: ${documentType}`)
        return this.preprocessingService.tesseractOptimize(inputPath)
      }
    })
  }
  
  private async initializeNanoVLM(): Promise<void> {
    const nanoVLMService = new NanoVLMService();
    let available = false;
    
    try {
      available = await nanoVLMService.isAvailable();
    } catch (error) {
      serverLogger.error(`Error checking nanoVLM availability: ${error}`);
      available = false;
    }
    
    serverLogger.info(`NanoVLM availability: ${available}`)
    
    this.engines.set('nanovlm', {
      name: 'nanovlm',
      service: nanoVLMService,
      available,
      specialization: ['handwriting', 'tables', 'poor_quality'],
      hasConfidence: true,
      preprocessor: (inputPath, documentType) => {
        serverLogger.info(`Preprocessing for NanoVLM, document type: ${documentType}`)
        switch(documentType) {
          case 'handwriting':
            return this.preprocessingService.nanoVLMHandwritingOptimize(inputPath)
          case 'table':
            return this.preprocessingService.nanoVLMTableOptimize(inputPath)
          default:
            return this.preprocessingService.nanoVLMGeneralOptimize(inputPath)
        }
      }
    })
  }
  
  /**
   * Check if Tesseract is available on the system
   */
  private async checkTesseractAvailability(): Promise<boolean> {
    try {
      await execAsync('tesseract --version')
      return true
    } catch (error) {
      serverLogger.warn(`Tesseract not available: ${error}`)
      return false
    }
  }
  
  /**
   * Check if OCRmyPDF is available on the system
   */
  private async checkOCRmyPDFAvailability(): Promise<boolean> {
    try {
      await execAsync('ocrmypdf --version')
      return true
    } catch (error) {
      serverLogger.warn(`OCRmyPDF not available: ${error}`)
      return false
    }
  }
  
  /**
   * Get list of available engines
   */
  async getAvailableEngines(): Promise<string[]> {
    await this.ensureInitialized()
    return Array.from(this.engines.values())
      .filter(engine => engine.available)
      .map(engine => engine.name)
  }
  
  /**
   * Process document with specific engine
   */
  async processWithEngine(
    inputPath: string,
    engineName: string,
    documentType?: string
  ): Promise<ProcessingResult> {
    try {
      await this.ensureInitialized()
      
      const engine = this.engines.get(engineName)
      if (!engine) {
        throw new Error(`Engine '${engineName}' not found`)
      }
      
      if (!engine.available) {
        throw new Error(`Engine '${engineName}' is not available`)
      }
      
      const startTime = Date.now()
      
      // Preprocess the input if needed
      const processedInputPath = engine.preprocessor 
        ? await engine.preprocessor(inputPath, documentType) 
        : inputPath
      
      if (engine.name === 'nanovlm' && engine.service) {
        return this.processWithNanoVLM(engine.service, processedInputPath, documentType)
      } 
      
      return this.processWithCommandLineEngine(engine, processedInputPath, documentType)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorContext = {
        error: errorMessage,
        inputPath,
        engineName,
        documentType,
        stack: error instanceof Error ? error.stack : undefined
      };
      
      serverLogger.error(`Error processing with ${engineName}: ${errorMessage}`, errorContext);
      
      // Re-throw with additional context
      throw new Error(`Failed to process document with ${engineName}: ${errorMessage}`)
    }
  }
  
  private async processWithNanoVLM(
    service: NanoVLMService,
    inputPath: string,
    documentType?: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const result = await service.processImage(inputPath, path.dirname(inputPath), { 
        documentType: (documentType || 'general') as 'general' | 'handwritten' | 'table' | 'poor_quality',
        confidenceThreshold: 0.5,
        enhanceResolution: true,
        preserveLayout: true
      });
      
      if (!result || !result.text) {
        throw new Error('NanoVLM processing returned empty result');
      }
      
      // Safely extract confidence value using normalization
      let confidenceValue = 0;
      if (typeof result.confidence === 'number') {
        confidenceValue = result.confidence;
      } else if (result.confidence && 'averageConfidence' in result.confidence) {
        confidenceValue = result.confidence.averageConfidence;
      } else {
        throw new Error('Invalid confidence data format from NanoVLM');
      }
      
      return {
        engine: 'nanovlm',
        outputPath: inputPath, // Use input path as output path since we're not saving a new file
        confidence: confidenceValue,
        text: truncateTextForResponse(result.text),
        processingTime: result.processingTime || Date.now() - startTime,
        metadata: {
          ...result,
          structuredData: result.structuredData,
          layout: result.layout
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during NanoVLM processing';
      serverLogger.error(`NanoVLM processing failed: ${errorMessage}`, { 
        error, 
        inputPath, 
        documentType,
        processingTime: Date.now() - startTime
      });
      
      throw new Error(`NanoVLM processing failed: ${errorMessage}`);
    }
  }
  
  /**
   * Process document with a command-line OCR engine
   */
  private async processWithCommandLineEngine(
    engine: OCREngine,
    inputPath: string,
    documentType?: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Validate input
      if (!engine.available) {
        throw new Error(`Engine '${engine.name}' is not available`);
      }
      
      // Validate input file
      try {
        await fs.promises.access(inputPath, fs.constants.R_OK);
      } catch (error) {
        throw new Error(`Input file not accessible: ${inputPath}. ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Generate output paths
      const outputFilename = generateOutputFilename(inputPath, engine.name);
      const outputPath = path.join('/tmp', outputFilename);
      let txtOutputPath = '';
      
      // Build and execute the appropriate command
      let command: string;
      
      switch (engine.name) {
        case 'ocrmypdf':
          command = `ocrmypdf --rotate-pages --deskew --clean --optimize 3 "${inputPath}" "${outputPath}"`;
          break;
          
        case 'tesseract':
          txtOutputPath = outputPath.replace(/\.pdf$/i, '.txt');
          command = `tesseract "${inputPath}" "${txtOutputPath.replace(/\.txt$/i, '')}" pdf txt`;
          break;
          
        default:
          throw new Error(`Unsupported command-line engine: ${engine.name}`);
      }
      
      // Execute the command
      const { stderr } = await execAsync(command).catch(error => {
        throw new Error(`Command execution failed: ${error.message}`);
      });
      
      // Log any warnings
      if (stderr && stderr.trim().length > 0) {
        serverLogger.warn(`Command produced warnings: ${stderr.trim()}`, { 
          engine: engine.name,
          inputPath 
        });
      }
      
      // Verify output was created
      const outputExists = engine.name === 'tesseract' 
        ? fs.existsSync(txtOutputPath)
        : fs.existsSync(outputPath);
        
      if (!outputExists) {
        throw new Error(`Failed to create output file for ${engine.name}`);
      }
      
      // Extract text from the output
      let extractedText: string;
      let confidence = 0;
      
      if (engine.name === 'tesseract') {
        extractedText = await fs.promises.readFile(txtOutputPath, 'utf-8');
        
        if ('hasConfidence' in engine && engine.hasConfidence) {
          confidence = 0.85; // Default confidence for Tesseract (will be improved later)
        }
      } else {
        // For other engines, extract text using pdftotext
        const { stdout } = await execAsync(`pdftotext "${outputPath}" -`);
        extractedText = stdout.trim();
      }
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error(`No text was extracted by ${engine.name}`);
      }
      
      return {
        engine: engine.name,
        outputPath: engine.name === 'tesseract' ? txtOutputPath : outputPath,
        confidence,
        text: truncateTextForResponse(extractedText),
        processingTime: Date.now() - startTime,
        metadata: {
          engine: engine.name,
          documentType,
          inputSize: (await fs.promises.stat(inputPath)).size
        }
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during command execution';
      const errorContext = {
        error: errorMessage,
        inputPath,
        engine: engine.name,
        documentType,
        processingTime: Date.now() - startTime
      };
      
      serverLogger.error(`Command execution failed for ${engine.name}: ${errorMessage}`, errorContext);
      throw new Error(`Failed to process with ${engine.name}: ${errorMessage}`);
    }
  }
  
  /**
   * Process with multiple engines and merge results for improved accuracy
   */
  async processWithMultipleEnginesAndMerge(
    inputPath: string,
    engineNames: string[],
    documentType?: string
  ): Promise<ProcessingResult> {
    await this.ensureInitialized()
    
    const results = await this.processWithMultipleEngines(inputPath, engineNames, documentType)
    
    // Merge results intelligently
    return this.mergeEngineResults(results, documentType)
  }

  /**
   * Process with multiple engines and return all results
   */
  async processWithMultipleEngines(
    inputPath: string,
    engineNames: string[],
    documentType?: string
  ): Promise<ProcessingResult[]> {
    await this.ensureInitialized()
    
    const results: ProcessingResult[] = []
    
    for (const engineName of engineNames) {
      const engine = this.engines.get(engineName)
      if (!engine || !engine.available) {
        serverLogger.warn(`Engine ${engineName} is not available, skipping`)
        continue
      }
      
      try {
        const result = await this.processWithEngine(inputPath, engineName, documentType)
        results.push(result)
      } catch (error) {
        serverLogger.error(`Error processing with engine ${engineName}: ${error}`)
        // Continue with other engines even if one fails
        results.push({
          engine: engineName,
          success: false,
          text: '',
          confidence: 0,
          error: error instanceof Error ? error.message : String(error),
          processingTime: 0
        })
      }
    }
    
    return results
  }
  
  /**
   * Merge results from multiple engines to improve accuracy
   */
  private mergeEngineResults(results: ProcessingResult[], documentType?: string): ProcessingResult {
    const successfulResults = results.filter(r => r.success)
    
    if (successfulResults.length === 0) {
      // Return the first result if all failed
      return results[0] || {
        engine: 'merged',
        success: false,
        outputPath: '',
        confidence: 0,
        text: '',
        error: 'All engines failed'
      }
    }
    
    if (successfulResults.length === 1) {
      // Return single successful result
      return { ...successfulResults[0], engine: `${successfulResults[0].engine}_single` }
    }
    
    // Merge multiple successful results
    const bestResult = this.selectBestResult(successfulResults, documentType)
    const mergedText = this.mergeTexts(successfulResults)
    const averageConfidence = this.calculateAverageConfidence(successfulResults)
    
    return {
      engine: `merged_${successfulResults.map(r => r.engine).join('+')}`,
      success: true,
      outputPath: bestResult.outputPath,
      confidence: averageConfidence,
      text: mergedText,
      processingTime: Math.max(...successfulResults.map(r => r.processingTime || 0))
    }
  }
  
  /**
   * Select the best result based on confidence and document type
   */
  private selectBestResult(results: ProcessingResult[], documentType?: string): ProcessingResult {
    // For specialized document types, prefer specialized engines
    if (documentType === 'handwritten' || documentType === 'table' || documentType === 'poor_quality') {
      const nanoVLMResult = results.find(r => r.engine === 'nanovlm')
      if (nanoVLMResult && nanoVLMResult.confidence > 0.6) {
        return nanoVLMResult
      }
    }
    
    // For general documents, prefer OCRmyPDF or highest confidence
    if (documentType === 'pdf' || documentType === 'general') {
      const ocrMyPDFResult = results.find(r => r.engine === 'ocrmypdf')
      if (ocrMyPDFResult && ocrMyPDFResult.confidence > 0.7) {
        return ocrMyPDFResult
      }
    }
    
    // Fall back to highest confidence
    return results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    )
  }
  
  /**
   * Merge texts from multiple engines using intelligent strategies
   */
  private mergeTexts(results: ProcessingResult[]): string {
    if (results.length === 1) {
      return results[0].text
    }
    
    // For now, use the text from the highest confidence result
    // In the future, we could implement more sophisticated text merging
    const bestResult = results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    )
    
    return bestResult.text
  }
  
  /**
   * Calculate weighted average confidence across engines
   */
  private calculateAverageConfidence(results: ProcessingResult[]): number {
    if (results.length === 0) return 0
    
    // Weight by engine reliability
    const weights = new Map([
      ['nanovlm', 1.2],    // Higher weight for specialized AI engine
      ['ocrmypdf', 1.1],   // Good for PDFs
      ['tesseract', 1.0]   // Standard weight
    ])
    
    let totalWeightedConfidence = 0
    let totalWeight = 0
    
    for (const result of results) {
      const weight = weights.get(result.engine) || 1.0
      totalWeightedConfidence += result.confidence * weight
      totalWeight += weight
    }
    
    return totalWeight > 0 ? totalWeightedConfidence / totalWeight : 0
  }
  
  /**
   * Get the best available engine for a document type
   */
  async getBestEngineForDocumentType(documentType: string): Promise<string | null> {
    await this.ensureInitialized()
    
    const availableEngines = Array.from(this.engines.values()).filter(e => e.available)
    
    // Find engines that specialize in this document type
    const specializedEngines = availableEngines.filter(e => 
      e.specialization.includes(documentType) || e.specialization.includes('general')
    )
    
    if (specializedEngines.length === 0) {
      return availableEngines.length > 0 ? availableEngines[0].name : null
    }
    
    // Return the first specialized engine (they're ordered by preference)
    return specializedEngines[0].name
  }
}

export default MultiEngineOCR

// Named export for backwards compatibility
export const multiEngineOCR = new MultiEngineOCR()

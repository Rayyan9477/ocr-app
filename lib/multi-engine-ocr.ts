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
  success: boolean
  outputPath?: string
  confidence: number
  text: string
  error?: string
  processingTime?: number
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
    await this.ensureInitialized()
    
    const engine = this.engines.get(engineName)
    if (!engine) {
      throw new Error(`Engine '${engineName}' not found`)
    }
    
    if (!engine.available) {
      throw new Error(`Engine '${engineName}' is not available`)
    }
    
    const startTime = Date.now()
    
    try {
      // Preprocess the input if needed
      const processedInputPath = engine.preprocessor ? await engine.preprocessor(inputPath, documentType) : inputPath
      
      let result: ProcessingResult
      
      if (engine.name === 'nanovlm' && engine.service) {
        result = await this.processWithNanoVLM(engine.service, processedInputPath, documentType)
      } else {
        result = await this.processWithCommandLineEngine(engine, processedInputPath, documentType)
      }
      
      result.processingTime = Date.now() - startTime
      return result
      
    } catch (error) {
      serverLogger.error(`Error processing with ${engineName}: ${error}`)
      return {
        engine: engineName,
        success: false,
        outputPath: '',
        confidence: 0,
        text: '',
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
  
  private async processWithNanoVLM(
    service: NanoVLMService,
    inputPath: string,
    documentType?: string
  ): Promise<ProcessingResult> {
    try {
      const result = await service.processImage(inputPath, path.dirname(inputPath), { documentType: (documentType || 'general') as 'general' | 'handwritten' | 'table' | 'poor_quality',
        confidenceThreshold: 0.5,
        enhanceResolution: true,
        preserveLayout: true
      })
      
      // Safely extract confidence value using normalization
      let confidenceValue = 0;
      if (typeof result.confidence === 'number') {
        confidenceValue = normalizeConfidenceData(result.confidence).averageConfidence;
      } else if (result.confidence && typeof result.confidence === 'object') {
        confidenceValue = normalizeConfidenceData(result.confidence).averageConfidence;
      }
      
      return {
        engine: 'nanovlm',
        success: result.success,
        outputPath: result.outputPath || '',
        confidence: confidenceValue,
        text: truncateTextForResponse(result.text || ''),
        processingTime: 0 // Will be set by caller
      }
    } catch (error) {
      serverLogger.error(`NanoVLM processing failed: ${error}`);
      return {
        engine: 'nanovlm',
        success: false,
        outputPath: '',
        confidence: 0,
        text: '',
        processingTime: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private async processWithCommandLineEngine(
    engine: OCREngine,
    inputPath: string,
    documentType?: string
  ): Promise<ProcessingResult> {
    const outputFilename = generateOutputFilename(inputPath, engine.name)
    const outputPath = path.join('/tmp', outputFilename)
    
    let command: string
    
    switch (engine.name) {
      case 'ocrmypdf':
        command = `ocrmypdf --rotate-pages --deskew --clean --optimize 3 "${inputPath}" "${outputPath}"`
        break
      case 'tesseract':
        const txtOutput = outputPath.replace('.pdf', '.txt')
        command = `tesseract "${inputPath}" "${txtOutput.replace('.txt', '')}" pdf txt`
        break
      default:
        throw new Error(`Unknown command-line engine: ${engine.name}`)
    }
    
    await execAsync(command)
    
    // Extract text from the output
    let extractedText = ''
    let confidence = 0
    
    try {
      if (engine.name === 'tesseract') {
        const txtFile = outputPath.replace('.pdf', '.txt')
        extractedText = await fs.promises.readFile(txtFile, 'utf-8')
        
        if (engine.hasConfidence) {
          confidence = await this.extractTesseractConfidence(inputPath)
        }
      } else {
        // For other engines, extract text using pdftotext
        const { stdout } = await execAsync(`pdftotext "${outputPath}" -`)
        extractedText = stdout.trim()
      }
    } catch (textError) {
      serverLogger.warn(`Failed to extract text from ${engine.name} output: ${textError}`)
      extractedText = '[Content exists but text extraction failed]'
    }
    
    return {
      engine: engine.name,
      success: true,
      outputPath,
      confidence,
      text: truncateTextForResponse(extractedText),
      processingTime: 0 // Will be set by caller
    }
  }
  
  private async extractTesseractConfidence(inputPath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`tesseract "${inputPath}" - --psm 3 -c tessedit_create_tsv=1`)
      const lines = stdout.split('\n')
      let totalConfidence = 0
      let wordCount = 0
      
      for (const line of lines) {
        if (line.trim() && !line.startsWith('level')) {
          const columns = line.split('\t')
          if (columns.length >= 11) {
            const conf = parseFloat(columns[10])
            if (!isNaN(conf) && conf >= 0) {
              totalConfidence += conf
              wordCount++
            }
          }
        }
      }
      
      return wordCount > 0 ? Math.round(totalConfidence / wordCount) : 0
    } catch (error) {
      serverLogger.warn(`Failed to extract Tesseract confidence: ${error}`)
      return 0
    }
  }
  
  /**
   * Process document with multiple engines for comparison
   */
  async processWithMultipleEngines(
    inputPath: string,
    engineNames: string[],
    documentType?: string
  ): Promise<ProcessingResult[]> {
    await this.ensureInitialized()
    
    const results: ProcessingResult[] = []
    
    for (const engineName of engineNames) {
      try {
        const result = await this.processWithEngine(inputPath, engineName, documentType)
        results.push(result)
      } catch (error) {
        serverLogger.error(`Failed to process with ${engineName}: ${error}`)
        results.push({
          engine: engineName,
          success: false,
          outputPath: '',
          confidence: 0,
          text: '',
          processingTime: 0,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    
    return results
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

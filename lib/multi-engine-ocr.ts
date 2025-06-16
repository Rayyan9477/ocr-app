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
import { existsSync } from 'fs';

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

interface EngineStrengths {
  general_text: number;
  handwritten: number;
  tables: number;
  poor_quality: number;
  layout_preservation: number;
  pdf_handling: number;
}

export interface OCREngine {
  name: string
  service: any
  available: boolean
  specialization: string[]
  hasConfidence: boolean // Changed from 'confidence: boolean' to 'hasConfidence: boolean'
  preprocessor?: (inputPath: string, documentType?: string) => Promise<string>
}

export interface EnhancedOCREngine extends OCREngine {
  strengths: EngineStrengths;
  priority: number;
  weightForDocType?: { [key: string]: number };
}

export interface ProcessingResult {
  engine: string;
  outputPath: string;
  confidence: number;
  text: string;
  processingTime?: number;
  metadata?: any;
  success?: boolean;
  error?: string;
  regions?: Array<{
    text: string;
    confidence: number;
    type?: string;
    bbox?: [number, number, number, number];
  }>;
}

export class MultiEngineOCR {
  private engines: Map<string, EnhancedOCREngine>;
  private preprocessingService: PreprocessingService;

  constructor() {
    this.engines = new Map();
    this.preprocessingService = new PreprocessingService();
    this.initializeEngines().catch(error => {
      serverLogger.error('Failed to initialize OCR engines:', error);
    });
  }

  private async initializeEngines(): Promise<void> {
    // Initialize engines with their strengths and specializations
    await Promise.all([
      this.initializeOCRmyPDF(),
      this.initializeTesseract(),
      this.initializeNanoVLM()
    ]);

    // Configure engine strengths
    this.configureEngineStrengths();
  }

  private configureEngineStrengths(): void {
    // NanoVLM configuration
    if (this.engines.has('nanovlm')) {
      this.engines.set('nanovlm', {
        ...this.engines.get('nanovlm')!,
        strengths: {
          general_text: 0.8,
          handwritten: 0.9,
          tables: 0.85,
          poor_quality: 0.9,
          layout_preservation: 0.9,
          pdf_handling: 0.7
        },
        priority: 3,
        weightForDocType: {
          'handwritten': 1.2,
          'table': 1.1,
          'poor_quality': 1.2
        }
      });
    }

    // OCRmyPDF configuration
    if (this.engines.has('ocrmypdf')) {
      this.engines.set('ocrmypdf', {
        ...this.engines.get('ocrmypdf')!,
        strengths: {
          general_text: 0.9,
          handwritten: 0.6,
          tables: 0.7,
          poor_quality: 0.7,
          layout_preservation: 0.8,
          pdf_handling: 0.95
        },
        priority: 2,
        weightForDocType: {
          'pdf': 1.2,
          'general': 1.1
        }
      });
    }

    // Tesseract configuration
    if (this.engines.has('tesseract')) {
      this.engines.set('tesseract', {
        ...this.engines.get('tesseract')!,
        strengths: {
          general_text: 0.85,
          handwritten: 0.6,
          tables: 0.7,
          poor_quality: 0.65,
          layout_preservation: 0.7,
          pdf_handling: 0.7
        },
        priority: 1,
        weightForDocType: {
          'general': 1.0
        }
      });
    }
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
  
  async processWithAllEngines(
    inputPath: string,
    documentType?: string
  ): Promise<ProcessingResult[]> {
    if (!inputPath || !fs.existsSync(inputPath)) {
      throw new Error('Invalid input path');
    }

    const availableEngines = Array.from(this.engines.values())
      .filter(engine => engine.available)
      .sort((a, b) => {
        // Calculate weighted priority based on document type
        const aWeight = this.calculateEngineWeight(a, documentType);
        const bWeight = this.calculateEngineWeight(b, documentType);
        return bWeight - aWeight;
      });

    if (availableEngines.length === 0) {
      throw new Error('No OCR engines are available');
    }

    // Process with all engines in parallel
    const results = await Promise.all(
      availableEngines.map(engine => 
        this.processWithEngine(inputPath, engine.name, documentType)
          .catch(error => ({
            engine: engine.name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            confidence: 0,
            text: '',
            outputPath: inputPath
          }))
      )
    );

    // Filter and enhance results
    const validResults = results.filter(result => result.success !== false);
    if (validResults.length === 0) {
      throw new Error('All OCR engines failed to process the document');
    }

    // Merge and enhance results
    return this.enhanceResults(validResults, documentType);
  }

  private calculateEngineWeight(engine: EnhancedOCREngine, documentType?: string): number {
    let weight = engine.priority;
    
    if (documentType && engine.weightForDocType?.[documentType]) {
      weight *= engine.weightForDocType[documentType];
    }

    // Add strength-based weighting
    if (documentType === 'handwritten') weight *= engine.strengths.handwritten;
    else if (documentType === 'table') weight *= engine.strengths.tables;
    else if (documentType === 'poor_quality') weight *= engine.strengths.poor_quality;
    else weight *= engine.strengths.general_text;

    return weight;
  }

  private async enhanceResults(results: ProcessingResult[], documentType?: string): Promise<ProcessingResult[]> {
    // Sort results by confidence and engine priority
    const enhancedResults = results.map(result => {
      const engine = this.engines.get(result.engine);
      const weight = engine ? this.calculateEngineWeight(engine, documentType) : 1;
      
      return {
        ...result,
        confidence: result.confidence * weight
      };
    });

    // Sort by weighted confidence
    enhancedResults.sort((a, b) => b.confidence - a.confidence);

    // Use the best result as base and enhance it with others
    const baseResult = enhancedResults[0];
    if (enhancedResults.length > 1) {
      // Combine results based on region confidence
      const combinedRegions = this.combineRegions(enhancedResults);
      baseResult.regions = combinedRegions;
      
      // Update text based on combined regions
      baseResult.text = this.reconstructTextFromRegions(combinedRegions);
    }

    return enhancedResults;
  }

  private combineRegions(results: ProcessingResult[]): ProcessingResult['regions'] {
    // Implement sophisticated region combination logic
    const allRegions: ProcessingResult['regions'] = [];
    
    results.forEach(result => {
      if (result.regions) {
        result.regions.forEach(region => {
          // Find overlapping regions from other results
          const overlaps = allRegions.filter(existing => 
            this.regionsOverlap(existing.bbox, region.bbox)
          );

          if (overlaps.length === 0) {
            // No overlap, add new region
            allRegions.push(region);
          } else {
            // Use region with highest confidence
            const bestRegion = [...overlaps, region]
              .reduce((best, current) => 
                current.confidence > best.confidence ? current : best
              );
            
            // Update or add the best region
            const index = allRegions.indexOf(overlaps[0]);
            if (index >= 0) {
              allRegions[index] = bestRegion;
            } else {
              allRegions.push(bestRegion);
            }
          }
        });
      }
    });

    return allRegions;
  }

  private regionsOverlap(bbox1?: number[], bbox2?: number[]): boolean {
    if (!bbox1 || !bbox2) return false;
    
    const [x1, y1, w1, h1] = bbox1;
    const [x2, y2, w2, h2] = bbox2;
    
    return !(x1 + w1 < x2 || x2 + w2 < x1 || y1 + h1 < y2 || y2 + h2 < y1);
  }

  private reconstructTextFromRegions(regions?: ProcessingResult['regions']): string {
    if (!regions || regions.length === 0) return '';

    // Sort regions by position (top to bottom, left to right)
    const sortedRegions = [...regions].sort((a, b) => {
      if (!a.bbox || !b.bbox) return 0;
      
      const [, y1] = a.bbox;
      const [, y2] = b.bbox;
      
      if (Math.abs(y1 - y2) < 10) { // Same line threshold
        const [x1] = a.bbox;
        const [x2] = b.bbox;
        return x1 - x2;
      }
      
      return y1 - y2;
    });

    // Reconstruct text with proper spacing and line breaks
    return sortedRegions.reduce((text, region, i) => {
      const nextRegion = sortedRegions[i + 1];
      let separator = ' ';

      if (nextRegion && nextRegion.bbox && region.bbox) {
        const [, y1, , h1] = region.bbox;
        const [, y2] = nextRegion.bbox;
        
        // Add line break if vertical distance is significant
        if (y2 - (y1 + h1) > h1 * 0.5) {
          separator = '\n';
        }
      }

      return text + region.text + separator;
    }, '').trim();
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
  
  private async processWithEngine(
    inputPath: string,
    engineName: string,
    documentType?: string
  ): Promise<ProcessingResult> {
    const engine = this.engines.get(engineName);
    if (!engine) {
      throw new Error(`Engine ${engineName} not found`);
    }

    if (!engine.available) {
      throw new Error(`Engine ${engineName} is not available`);
    }

    // Apply engine-specific preprocessing if available
    let processedPath = inputPath;
    try {
      if (engine.preprocessor) {
        processedPath = await engine.preprocessor(inputPath, documentType);
      }
    } catch (error) {
      serverLogger.warn(`Preprocessing failed for ${engineName}:`, error);
      // Continue with original file if preprocessing fails
    }

    if (engineName === 'nanovlm') {
      return this.processWithNanoVLM(engine.service as NanoVLMService, processedPath, documentType);
    } else {
      return this.processWithCommandLineEngine(engine, processedPath, documentType);
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
        preserveLayout: true,
        preserveFullText: true,
        skipTruncation: true
      });

      if (!result || !result.text) {
        throw new Error('NanoVLM processing returned empty result');
      }

      // Extract confidence value
      const confidenceValue = typeof result.confidence === 'number' 
        ? result.confidence 
        : result.confidence.averageConfidence || 0;

      return {
        engine: 'nanovlm',
        outputPath: inputPath,
        confidence: confidenceValue,
        text: result.text,
        processingTime: result.processingTime || Date.now() - startTime,
        success: true,
        metadata: {
          ...result,
          structuredData: result.structuredData,
          layout: result.layout,
          fullTextAvailable: true,
          textLength: result.text.length
        }
      };
    } catch (error) {
      throw new Error(`NanoVLM processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    const outputPath = path.join(
      path.dirname(inputPath),
      `${path.parse(inputPath).name}_${engine.name}_${Date.now()}.pdf`
    );

    try {
      // Ensure output directory exists
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

      const command = engine.command(inputPath, outputPath, 'eng', {
        medicalTerminology: documentType === 'medical',
        preserveFullText: true
      });

      await execAsync(command);

      if (!fs.existsSync(outputPath)) {
        throw new Error(`Engine failed to create output file: ${outputPath}`);
      }

      // Extract text using pdftotext
      const { stdout: extractedText } = await execAsync(`pdftotext "${outputPath}" -`);

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error(`No text was extracted by ${engine.name}`);
      }

      // Get confidence if engine supports it
      let confidence = 0;
      if ('hasConfidence' in engine && engine.hasConfidence) {
        confidence = await this.extractEngineConfidence(engine, outputPath);
      }

      return {
        engine: engine.name,
        outputPath,
        confidence,
        text: extractedText,
        processingTime: Date.now() - startTime,
        success: true,
        metadata: {
          fullTextAvailable: true,
          textLength: extractedText.length
        }
      };

    } catch (error) {
      throw new Error(`${engine.name} processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractEngineConfidence(engine: OCREngine, outputPath: string): Promise<number> {
    // Implementation depends on specific engine
    if (engine.name === 'tesseract') {
      return this.extractTesseractConfidence(outputPath);
    }
    return 0;
  }

  async processDocument(inputPath: string, outputPath: string, options: ProcessingOptions = {}): Promise<ProcessingResult> {
    const startTime = Date.now();
    const results: ProcessingResult[] = [];
    let lastError: Error | null = null;

    // Try each engine in sequence
    const engines = ['nanovlm', 'ocrmypdf', 'tesseract'];
    
    for (const engineName of engines) {
      try {
        const engine = this.engines.get(engineName);
        if (!engine || !engine.available) {
          serverLogger.warn(`Engine ${engineName} not available, skipping...`);
          continue;
        }

        serverLogger.info(`Processing with ${engineName} engine...`);
        
        let result: ProcessingResult;
        
        if (engineName === 'nanovlm' && engine.service) {
          result = await this.processWithNanoVLM(engine.service, inputPath, options.documentType);
        } else if (engineName === 'ocrmypdf') {
          result = await this.processWithOCRmyPDF(inputPath, outputPath, options);
        } else if (engineName === 'tesseract') {
          result = await this.processWithTesseract(inputPath, outputPath, options);
        } else {
          continue;
        }

        results.push(result);
        
        // If we got a good result (confidence > 0.7), we can stop
        if (result.confidence > 0.7) {
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        serverLogger.warn(`Error processing with ${engineName}: ${lastError.message}`);
        continue;
      }
    }

    // If we have results, return the best one
    if (results.length > 0) {
      const bestResult = results.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      
      return {
        ...bestResult,
        processingTime: Date.now() - startTime,
        metadata: {
          ...bestResult.metadata,
          enginesUsed: results.map(r => r.engine),
          confidence: bestResult.confidence
        }
      };
    }

    // If we got here, all engines failed
    throw lastError || new Error('All OCR engines failed to process the document');
  }

  private async processWithOCRmyPDF(
    inputPath: string,
    outputPath: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Build OCRmyPDF command with enhanced options
      const command = [
        'ocrmypdf',
        '--language', options.language || 'eng',
        '--deskew',
        '--rotate-pages',
        '--force-ocr',
        '--skip-text',
        '--redo-ocr',
        '--output-type', 'pdf',
        '--max-image-mpixels', '0',  // No limit on image size
        '--jbig2-lossy',  // Better compression
        '--png-quality', '100',  // Maximum quality for PNG
        '--jpeg-quality', '100',  // Maximum quality for JPEG
        '--tesseract-config', 'tessedit_char_whitelist=0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,;:!?@#$%^&*()_+-=[]{}|\\/<>"\' ',
        '--tesseract-pagesegmode', '1',  // Automatic page segmentation with OSD
        '--tesseract-oem', '1',  // Use LSTM only
        '--tesseract-thresholding', 'adaptive',  // Use adaptive thresholding
        '--tesseract-dpi', '300',  // Set DPI for better quality
        '--tesseract-timeout', '0',  // No timeout
        '--tesseract-max-pages', '0',  // No page limit
        '--tesseract-max-pixels', '0',  // No pixel limit
        '--tesseract-max-memory', '0',  // No memory limit
        '--tesseract-max-cpus', '0',  // Use all available CPUs
        '--tesseract-max-threads', '0',  // Use all available threads
        '--tesseract-max-batch-size', '0',  // No batch size limit
        '--tesseract-max-batch-time', '0',  // No batch time limit
        '--tesseract-max-batch-items', '0',  // No batch items limit
        '--tesseract-max-batch-memory', '0',  // No batch memory limit
        '--tesseract-max-batch-cpus', '0',  // No batch CPU limit
        '--tesseract-max-batch-threads', '0',  // No batch thread limit
        '--tesseract-max-batch-batch-size', '0',  // No batch batch size limit
        '--tesseract-max-batch-batch-time', '0',  // No batch batch time limit
        '--tesseract-max-batch-batch-items', '0',  // No batch batch items limit
        '--tesseract-max-batch-batch-memory', '0',  // No batch batch memory limit
        '--tesseract-max-batch-batch-cpus', '0',  // No batch batch CPU limit
        '--tesseract-max-batch-batch-threads', '0',  // No batch batch thread limit
        inputPath,
        outputPath
      ].join(' ');

      // Execute OCRmyPDF
      const { stdout, stderr } = await execAsync(command);
      
      // Check if output file exists and has content
      if (!existsSync(outputPath)) {
        throw new Error('OCRmyPDF did not produce output file');
      }
      
      // Extract text from the processed PDF
      const text = await this.extractTextFromPDF(outputPath);
      
      // Calculate confidence based on OCRmyPDF output
      const confidence = this.calculateOCRmyPDFConfidence(stdout, stderr);
      
      return {
        engine: 'ocrmypdf',
        outputPath,
        confidence,
        text,
        processingTime: Date.now() - startTime,
        metadata: {
          stdout,
          stderr,
          pagesProcessed: this.extractPageCount(stdout),
          layoutPreserved: true
        }
      };
    } catch (error) {
      throw new Error(`OCRmyPDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private calculateOCRmyPDFConfidence(stdout: string, stderr: string): number {
    // Extract confidence from OCRmyPDF output
    const confidenceMatch = stdout.match(/Confidence: (\d+\.?\d*)/);
    if (confidenceMatch) {
      return parseFloat(confidenceMatch[1]) / 100;
    }
    
    // If no confidence found, estimate based on output
    if (stdout.includes('Successfully processed')) {
      return 0.8;  // High confidence if successful
    } else if (stdout.includes('Warning')) {
      return 0.6;  // Medium confidence if warnings
    } else {
      return 0.4;  // Low confidence otherwise
    }
  }

  private extractPageCount(output: string): number {
    const pageMatch = output.match(/Processed (\d+) pages/);
    return pageMatch ? parseInt(pageMatch[1], 10) : 0;
  }

  private async extractTextFromPDF(outputPath: string): Promise<string> {
    // Implementation of extractTextFromPDF method
    // This is a placeholder and should be implemented based on your specific requirements
    throw new Error('Method not implemented');
  }

  private async processWithTesseract(
    inputPath: string,
    outputPath: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Convert PDF to images if needed
      const imagePaths = await this.convertToImages(inputPath);
      
      // Process each image with Tesseract
      const results = await Promise.all(imagePaths.map(async (imagePath) => {
        const command = [
          'tesseract',
          imagePath,
          outputPath.replace('.pdf', ''),
          '--oem', '1',  // Use LSTM only
          '--psm', '1',  // Automatic page segmentation with OSD
          '-l', options.language || 'eng',
          '--dpi', '300',
          '--tessdata-dir', '/usr/share/tesseract-ocr/4.00/tessdata',
          '--user-words', '/usr/share/tesseract-ocr/4.00/tessdata/eng.user-words',
          '--user-patterns', '/usr/share/tesseract-ocr/4.00/tessdata/eng.user-patterns',
          '--config', 'tessedit_char_whitelist=0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,;:!?@#$%^&*()_+-=[]{}|\\/<>"\' ',
          'pdf'
        ].join(' ');

        const { stdout, stderr } = await execAsync(command);
        return { stdout, stderr, imagePath };
      }));
      
      // Combine results
      const text = await this.combineTesseractResults(results);
      const confidence = this.calculateTesseractConfidence(results);
      
      return {
        engine: 'tesseract',
        outputPath,
        confidence,
        text,
        processingTime: Date.now() - startTime,
        metadata: {
          pagesProcessed: imagePaths.length,
          layoutPreserved: true
        }
      };
    } catch (error) {
      throw new Error(`Tesseract processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async convertToImages(inputPath: string): Promise<string[]> {
    // Implementation for converting PDF to images
    // This should use pdf2image or similar library
    throw new Error('Method not implemented');
  }

  private async combineTesseractResults(results: Array<{ stdout: string; stderr: string; imagePath: string }>): Promise<string> {
    // Implementation for combining Tesseract results
    // This should merge the text from all pages
    throw new Error('Method not implemented');
  }

  private calculateTesseractConfidence(results: Array<{ stdout: string; stderr: string; imagePath: string }>): number {
    // Calculate average confidence from all pages
    const confidences = results.map(result => {
      const confidenceMatch = result.stdout.match(/Confidence: (\d+\.?\d*)/);
      return confidenceMatch ? parseFloat(confidenceMatch[1]) / 100 : 0.5;
    });
    
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }
}

export default MultiEngineOCR

// Named export for backwards compatibility
export const multiEngineOCR = new MultiEngineOCR()

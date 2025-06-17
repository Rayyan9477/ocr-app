import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import logger from './logger';
import { OCREngine } from './multi-engine-ocr';
import { engineRegistry } from './ocr-engine-registry';
import { engineSelectionService, EngineSelectionResult } from './engine-selection';
import { tfvlmService } from './tf-vlm-service';
import { initializeDirectories } from './initialize-dirs';

const execAsync = promisify(exec);

export interface ProcessingOptions {
  engine?: string;
  language?: string;
  enhanceImage?: boolean;
  confidenceThreshold?: number;
  outputFormat?: string;
  documentType?: string;
  preserveLayout?: boolean;
  extractStructuredData?: boolean;
}

export interface ProcessingResult {
  text: string;
  confidence: number;
  outputPath: string;
  processingTime: number;
  engine: string;
  metadata?: any;
}

/**
 * Processing Pipeline - Coordinates OCR processing workflow
 * Pure TypeScript replacement for the mixed Python/JS pipeline
 */
export class ProcessingPipeline {
  constructor() {
    // Ensure directories exist
    initializeDirectories();
  }

  /**
   * Process a document with the optimal OCR engine
   */
  async processDocument(
    inputPath: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    logger.info(`Processing document: ${inputPath}`);
    
    try {
      // Validate input file
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }
      
      // Select optimal engine
      const selection = await engineSelectionService.selectEngineForDocument(
        inputPath,
        options.engine
      );
      
      // Get the selected engine
      const engine = engineRegistry.getEngine(selection.primaryEngine);
      if (!engine) {
        throw new Error(`Selected engine not available: ${selection.primaryEngine}`);
      }
      
      // Prepare output directory
      const outputDir = path.join(process.cwd(), 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Process with selected engine
      let result;
      if (selection.primaryEngine === 'tf-vlm') {
        // Process with TF-VLM service
        result = await this.processWithTFVLM(inputPath, outputDir, options);
      } else {
        // Process with other engines
        result = await engine.processFile(inputPath, outputDir);
      }
      
      // Add metadata to the result
      result.processingTime = (Date.now() - startTime) / 1000;
      result.metadata = {
        ...result.metadata,
        selectionConfidence: selection.confidence,
        selectionCriteria: selection.criteria,
        originalPath: inputPath
      };
      
      logger.info(`Document processed successfully in ${result.processingTime}s: ${result.outputPath}`);
      return result;
    } catch (error) {
      const errorMessage = `Document processing failed: ${error}`;
      logger.error(errorMessage);
      
      // Try fallback processing if available
      return this.handleProcessingError(inputPath, options, startTime, error);
    }
  }

  /**
   * Process with TF-VLM service
   */
  private async processWithTFVLM(
    inputPath: string,
    outputDir: string,
    options: ProcessingOptions
  ): Promise<ProcessingResult> {
    // Process with TF-VLM
    const result = await tfvlmService.processImage(inputPath, {
      documentType: options.documentType as any,
      confidenceThreshold: options.confidenceThreshold,
      enhanceResolution: options.enhanceImage,
      preserveLayout: options.preserveLayout,
      enableStructuredDataExtraction: options.extractStructuredData
    });
    
    // Generate output filename
    const outputPath = path.join(outputDir, this.generateOutputFilename(inputPath, 'tf-vlm'));
    
    // Save text to output file
    fs.writeFileSync(outputPath, result.text);
    
    return {
      text: result.text,
      confidence: result.confidence,
      outputPath,
      processingTime: result.processingTime,
      engine: 'tf-vlm',
      metadata: result.metadata
    };
  }

  /**
   * Handle processing errors by trying fallback engines
   */
  private async handleProcessingError(
    inputPath: string,
    options: ProcessingOptions,
    startTime: number,
    originalError: any
  ): Promise<ProcessingResult> {
    logger.warn(`Attempting fallback processing for ${inputPath}`);
    
    try {
      // Get selection with fallback
      const selection = await engineSelectionService.selectEngineForDocument(inputPath);
      
      // Try fallback engine if available
      if (selection.fallbackEngine) {
        const fallbackEngine = engineRegistry.getEngine(selection.fallbackEngine);
        if (fallbackEngine) {
          logger.info(`Using fallback engine: ${selection.fallbackEngine}`);
          
          const outputDir = path.join(process.cwd(), 'output');
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Process with fallback engine
          let result;
          if (selection.fallbackEngine === 'tf-vlm') {
            result = await this.processWithTFVLM(inputPath, outputDir, options);
          } else {
            result = await fallbackEngine.processFile(inputPath, outputDir);
          }
          
          result.processingTime = (Date.now() - startTime) / 1000;
          result.metadata = {
            ...result.metadata,
            isFallback: true,
            originalError: originalError.message,
            fallbackReason: 'Primary engine failed'
          };
          
          logger.info(`Fallback processing successful in ${result.processingTime}s: ${result.outputPath}`);
          return result;
        }
      }
      
      // If no fallback engine available or fallback failed, use enhanced-tesseract as last resort
      const lastResortEngine = engineRegistry.getEngine('enhanced-tesseract');
      if (lastResortEngine) {
        logger.info('Using enhanced-tesseract as last resort');
        
        const outputDir = path.join(process.cwd(), 'output');
        const result = await lastResortEngine.processFile(inputPath, outputDir);
        
        result.processingTime = (Date.now() - startTime) / 1000;
        result.metadata = {
          ...result.metadata,
          isLastResort: true,
          originalError: originalError.message,
          fallbackReason: 'No fallback engine available or fallback failed'
        };
        
        logger.info(`Last resort processing successful in ${result.processingTime}s: ${result.outputPath}`);
        return result;
      }
      
      // If all else fails, throw the original error
      throw originalError;
    } catch (fallbackError) {
      logger.error(`Fallback processing failed: ${fallbackError}`);
      throw originalError; // Throw the original error to preserve the root cause
    }
  }

  /**
   * Generate output filename for processed document
   */
  private generateOutputFilename(inputPath: string, engineName: string): string {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const timestamp = Date.now();
    return `${baseName}_${engineName}_${timestamp}.txt`;
  }

  /**
   * Process a batch of documents
   */
  async processBatch(
    inputPaths: string[],
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult[]> {
    logger.info(`Processing batch of ${inputPaths.length} documents`);
    
    const results: ProcessingResult[] = [];
    
    for (const inputPath of inputPaths) {
      try {
        const result = await this.processDocument(inputPath, options);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to process ${inputPath}: ${error}`);
        
        // Add error result
        results.push({
          text: '',
          confidence: 0,
          outputPath: '',
          processingTime: 0,
          engine: 'error',
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            inputPath
          }
        });
      }
    }
    
    logger.info(`Batch processing completed: ${results.length} documents processed`);
    return results;
  }
}

// Create singleton instance
export const processingPipeline = new ProcessingPipeline();
export default processingPipeline;

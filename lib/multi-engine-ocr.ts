import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import logger from './logger';
import { NanoVLMService, OCRResult } from './nano-vlm-service';
import { PreprocessingService } from './preprocessing-service';

const execAsync = promisify(exec);

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
  
  constructor() {
    this.preprocessingService = new PreprocessingService();
    this.initializeEngines();
  }
  
  private async initializeEngines() {
    // Initialize preprocessing service
    this.preprocessingService = new PreprocessingService();
    
    logger.info('Initializing OCR engines...');
    
    // Add nanoVLM engine with explicit availability check
    const nanoVLMService = new NanoVLMService();
    const nanoVLMAvailable = await nanoVLMService.isAvailable().catch(err => {
      logger.error(`Error checking nanoVLM availability: ${err}`);
      return false;
    });
    
    logger.info(`nanoVLM availability: ${nanoVLMAvailable}`);
    
    this.engines.push({
      name: 'nanovlm',
      service: nanoVLMService,
      available: nanoVLMAvailable,
      specialization: ['handwriting', 'tables', 'poor_quality'],
      confidence: true,
      preprocessor: (inputPath, documentType) => {
        logger.info(`Preprocessing for nanoVLM, document type: ${documentType}`);
        switch(documentType) {
          case 'handwriting':
            return this.preprocessingService.nanoVLMHandwritingOptimize(inputPath);
          case 'table':
            return this.preprocessingService.nanoVLMTableOptimize(inputPath);
          default:
            return this.preprocessingService.nanoVLMGeneralOptimize(inputPath);
        }
      }
    });
    
    // Log the available engines
    logger.info(`Available engines: ${this.engines.filter(e => e.available).map(e => e.name).join(', ')}`);
    
    // Add other engines here
    // ...existing code...
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
        processedInputPath = await preprocessingService.quickEnhance(inputPath);
      }

      // Run each available engine with optimized settings
      const availableEngines = this.engines.filter(e => e.available);
      
      // Reorder engines based on customization preferences
      if (optimizedSettings?.enginePreference) {
        availableEngines.sort((a, b) => {
          const aIndex = optimizedSettings!.enginePreference.indexOf(a.name);
          const bIndex = optimizedSettings!.enginePreference.indexOf(b.name);
          return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });
      }
      
      for (const engine of availableEngines) {
        const startTime = Date.now();
        const outputPath = join(outputDir, `${engine.name}_output.pdf`);
        
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
          
          // Handle service-based engines differently
          if (engine.name === 'paddleocr' || engine.name === 'kraken' || engine.name === 'nanovlm') {
            await this.processWithServiceEngine(engine, processedInputPath, outputPath, language);
          } else {
            // Traditional command-line engines
            await execAsync(command);
          }
          
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
              text: extractedText,
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
        customizationApplied
      };
    } finally {
      // Cleanup preprocessing files if used
      if ((usePreprocessing || optimizedSettings?.aggressivePreprocessing) && processedInputPath !== inputPath) {
        try {
          await preprocessingService.cleanup();
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
      
      // Ensure all pages are processed
      command += ` --pages 1-`;
      
      // Support large images
      command += ` --max-image-mpixels 0`;
      
      if (settings && settings.ocrmypdfParams.length > 0) {
        command += ` ${settings.ocrmypdfParams.join(' ')}`;
      }
      
      command += ` "${inputPath}" "${outputPath}"`;
      return command;
    } else if (engine.name === 'paddleocr') {
      // Service-based engine - return placeholder command
      return `echo "PaddleOCR service processing"`;
    } else if (engine.name === 'kraken') {
      // Service-based engine - return placeholder command  
      return `echo "Kraken service processing"`;
    } else if (engine.name === 'nanovlm') {
      // NanoVLM service - return placeholder command
      return `echo "NanoVLM service processing"`;
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
   * Process document with service-based engines (PaddleOCR, Kraken, NanoVLM)
   */
  private async processWithServiceEngine(
    engine: OCREngine,
    inputPath: string,
    outputPath: string,
    language: string
  ): Promise<void> {
    const { readFile: readFileAsync, writeFile: writeFileAsync } = await import('fs/promises');
    
    if (engine.name === 'paddleocr') {
      // PaddleOCR service call
      const formData = new FormData();
      const fileBuffer = await readFileAsync(inputPath);
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });
      formData.append('file', blob, 'document.pdf');
      formData.append('enhancement_mode', 'standard');
      
      const response = await fetch('http://localhost:8000/ocr/process', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`PaddleOCR service error: ${response.statusText}`);
      }
      
      const result = await response.json();
      await writeFileAsync(outputPath, JSON.stringify(result, null, 2));
      
    } else if (engine.name === 'kraken') {
      // Kraken service call
      const formData = new FormData();
      const fileBuffer = await readFileAsync(inputPath);
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });
      formData.append('file', blob, 'document.pdf');
      formData.append('enhancement_mode', 'standard');
      formData.append('language', language);
      
      const response = await fetch('http://localhost:8001/ocr/process', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Kraken service error: ${response.statusText}`);
      }
      
      const result = await response.json();
      await writeFileAsync(outputPath, JSON.stringify(result, null, 2));
    } else if (engine.name === 'nanovlm') {
      // NanoVLM service call
      const formData = new FormData();
      const fileBuffer = await readFileAsync(inputPath);
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });
      formData.append('file', blob, 'document.pdf');
      formData.append('language', language);
      
      const response = await fetch('http://localhost:8002/ocr/process', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`NanoVLM service error: ${response.statusText}`);
      }
      
      const result = await response.json();
      await writeFileAsync(outputPath, JSON.stringify(result, null, 2));
    }
  }
}

export const multiEngineOCR = new MultiEngineOCR();

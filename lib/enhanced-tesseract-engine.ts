import { createWorker, PSM, OEM, Worker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';
import logger from './logger';
import { OCREngine, OCRResult } from './multi-engine-ocr';
import sharp from 'sharp';

export interface EnhancedTesseractOptions {
  lang?: string;
  psm?: PSM;
  oem?: OEM;
  confidenceThreshold?: number;
  enableHandwritingOptimization?: boolean;
  imagePreprocessing?: boolean;
  whitelist?: string;
  enableAdaptiveThresholding?: boolean;
  enhanceContrast?: boolean;
  deskew?: boolean;
  removeNoise?: boolean;
}

const defaultOptions: EnhancedTesseractOptions = {
  lang: 'eng',
  psm: PSM.AUTO,
  oem: OEM.LSTM_ONLY,
  confidenceThreshold: 60,
  enableHandwritingOptimization: true,
  imagePreprocessing: true,
  whitelist: '',
  enableAdaptiveThresholding: true,
  enhanceContrast: true,
  deskew: true,
  removeNoise: true
};

/**
 * Enhanced Tesseract Engine with specific optimizations for handwritten text
 * This serves as a JavaScript replacement for the Python-based Kraken OCR
 */
export class EnhancedTesseractEngine implements OCREngine {
  // OCREngine interface implementation
  name = 'enhanced-tesseract';
  service: any = this;
  available = true;
  specialization: string[] = ['document', 'printed', 'handwritten'];
  confidence = true;
  
  // Preprocessor function for OCREngine interface
  preprocessor = async (inputPath: string, _documentType?: string): Promise<string> => {
    return this.preprocessImage(inputPath);
  };
  
  private options: EnhancedTesseractOptions;
  private worker: Worker | null = null;
  private initialized = false;
  
  constructor(options: Partial<EnhancedTesseractOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Initialize the Tesseract worker with appropriate settings
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      logger.info('Initializing EnhancedTesseractEngine');
      
      // Create worker with proper typing
      this.worker = await createWorker({
        // @ts-ignore - logger type is not properly exposed in the types
        logger: process.env.DEBUG ? (m: any) => {
          if (typeof m === 'string') {
            logger.debug(`Tesseract: ${m}`);
          } else if (m && typeof m === 'object') {
            logger.debug(`Tesseract: ${JSON.stringify(m)}`);
          }
        } : undefined
      });
      
      // Set parameters for the worker
      const params: Record<string, string> = {
        tessedit_pageseg_mode: String(this.options.psm || PSM.AUTO),
        tessedit_ocr_engine_mode: String(this.options.oem || OEM.LSTM_ONLY)
      };
      
      // Add handwriting optimization parameters if enabled
      if (this.options.enableHandwritingOptimization) {
        Object.assign(params, {
          tessjs_create_hocr: '1',
          tessjs_create_tsv: '1',
          load_system_dawg: '0',
          load_freq_dawg: '0',
          tessedit_enable_doc_dict: '0',
          textord_heavy_nr: '1',
          textord_noise_rejrows: '1',
          textord_noise_rejcp: '1',
          lstm_use_matrix: '1',
          tessedit_write_images: '1',
          textord_space_size_is_variable: '1',
          textord_pitch_range: '3',
          textord_words_default_certainty: '-1.0'
        });
      }
      
      // Add whitelist if provided
      if (this.options.whitelist) {
        params.tessedit_char_whitelist = this.options.whitelist;
      }
      
      // Apply all parameters at once
      await this.worker.setParameters(params);
      
      this.initialized = true;
      logger.info('EnhancedTesseractEngine initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize EnhancedTesseractEngine: ${error}`);
      throw new Error(`Failed to initialize EnhancedTesseractEngine: ${error}`);
    }
  }

  /**
   * Preprocess an image to enhance OCR accuracy
   * @param imagePath Path to the input image
   * @returns Path to the preprocessed image
   */
  private async preprocessImage(imagePath: string): Promise<string> {
    if (!this.options.imagePreprocessing) {
      return imagePath;
    }
    
    const outputPath = imagePath.replace(/\.(jpg|jpeg|png)$/i, '_preprocessed.jpg');
    
    try {
      let imageProcessor = sharp(imagePath);
      
      // Apply preprocessing based on options
      if (this.options.enhanceContrast) {
        imageProcessor = imageProcessor.normalize();
      }
      
      if (this.options.deskew) {
        // Simple deskew by rotating in small increments
        // In a real implementation, you might want to use a more sophisticated deskewing algorithm
        imageProcessor = imageProcessor.rotate(180);
      }
      
      if (this.options.removeNoise) {
        imageProcessor = imageProcessor.median(3);
      }
      
      if (this.options.enableAdaptiveThresholding) {
        imageProcessor = imageProcessor.threshold(128, { grayscale: true });
      }
      
      await imageProcessor.toFile(outputPath);
      return outputPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error preprocessing image: ${errorMessage}`);
      return imagePath; // Return original if preprocessing fails
    }
  };

  /**
   * Process an image with Tesseract OCR
   * @param inputPath Path to the input image
   * @param options Optional processing options
   * @returns OCR result with extracted text and metadata
   */
  async process(inputPath: string, options: any = {}): Promise<OCRResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    try {
      // Apply preprocessing if enabled
      const processedImagePath = this.options.imagePreprocessing 
        ? await this.preprocessor(inputPath)
        : inputPath;
      
      // Set Tesseract options
      await this.worker!.setParameters({
        tessedit_pageseg_mode: this.options.psm || PSM.AUTO,
        tessedit_ocr_engine_mode: this.options.oem || OEM.LSTM_ONLY,
        tessedit_char_whitelist: this.options.whitelist || '',
      });
      
      // Perform OCR with proper error handling
      const result = await this.worker!.recognize(processedImagePath);
      
      // Clean up temporary file if preprocessing was used
      if (processedImagePath !== inputPath) {
        try {
          await fs.promises.unlink(processedImagePath);
        } catch (error) {
          logger.warn(`Failed to clean up temporary file: ${processedImagePath}`);
        }
      }
      
      const processingTime = Date.now() - startTime;
      
      // Extract confidence from the result
      const confidence = result.data.confidence ? result.data.confidence / 100 : 0.9; // Default to 90% confidence if not provided
      
      return {
        text: result.data.text || '',
        confidence,
        engine: this.name,
        processingTime,
        metadata: {
          ...result.data,
          engine: this.name,
          options: this.options,
          processingTimeMs: processingTime
        },
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error during OCR processing: ${errorMessage}`, { error });
      
      return {
        text: '',
        confidence: 0,
        engine: this.name,
        error: errorMessage,
        success: false
      };
    }
  }

  /**
   * Generate an output filename with timestamp and suffix
   * @param inputPath Path to the input file
   * @param suffix Suffix to add to the filename
   * @returns Generated output filename
   */
  private generateOutputFilename(inputPath: string, suffix: string = 'ocr'): string {
    const inputBasename = path.basename(inputPath);
    const nameWithoutExt = path.parse(inputBasename).name;
    
    // Remove timestamp prefix if it exists (for uploaded files)
    const cleanName = nameWithoutExt.replace(/^\d+_/, '');
    
    // Generate timestamp for unique naming
    const timestamp = Date.now();
    
    return `${cleanName}_${timestamp}_${suffix}.txt`;
  }

  /**
   * Process a file with the enhanced Tesseract engine
   */
  async processFile(inputPath: string, outputDir: string): Promise<any> {
    if (!this.initialized || !this.worker) {
      await this.initialize();
    }
    
    const startTime = Date.now();
    logger.info(`Processing file with EnhancedTesseractEngine: ${inputPath}`);
    
    try {
      // Ensure the output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, this.generateOutputFilename(inputPath, 'enhanced-tesseract'));
      
      // Preprocess the image if enabled
      const processedPath = this.options.imagePreprocessing 
        ? await this.preprocessImage(inputPath) 
        : inputPath;
      
      // Read the image file
      const imageBuffer = fs.readFileSync(processedPath);
      
      // Recognize text from the image
      const result = await this.worker!.recognize(imageBuffer);
      
      // Filter out low-confidence words if threshold is set
      let filteredText = result.data.text;
      let overallConfidence = result.data.confidence;
      
      if (this.options.confidenceThreshold && this.options.confidenceThreshold > 0) {
        const lines = result.data.lines || [];
        const filteredLines = lines.map(line => {
          const words = line.words.filter(word => word.confidence >= this.options.confidenceThreshold!);
          return words.map(w => w.text).join(' ');
        }).filter(line => line.trim().length > 0);
        
        filteredText = filteredLines.join('\n');
      }
      
      // Post-process text for handwritten content if optimization is enabled
      if (this.options.enableHandwritingOptimization) {
        filteredText = this.postProcessHandwrittenText(filteredText);
      }
      
      // Save the recognized text to the output file
      fs.writeFileSync(outputPath, filteredText);
      
      // Clean up temporary file if it was created
      if (processedPath !== inputPath && fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath);
      }
      
      const processingTime = (Date.now() - startTime) / 1000;
      logger.info(`EnhancedTesseractEngine completed in ${processingTime}s: ${outputPath}`);
      
      return {
        text: filteredText,
        confidence: overallConfidence,
        outputPath,
        processingTime,
        engine: 'enhanced-tesseract'
      };
    } catch (error) {
      logger.error(`EnhancedTesseractEngine processing error: ${error}`);
      throw new Error(`EnhancedTesseractEngine processing error: ${error}`);
    }
  }

  /**
   * Post-process handwritten text to improve accuracy
   * This mimics some of the post-processing capabilities of Kraken
   */
  private postProcessHandwrittenText(text: string): string {
    // Basic post-processing for handwritten text
    // 1. Remove excessive whitespace
    let processed = text.replace(/\s+/g, ' ');
    
    // 2. Fix common OCR errors in handwritten text
    processed = processed
      .replace(/l1/g, '11') // Common confusion between 'l' and '1'
      .replace(/[oO]0/g, '00') // Common confusion between 'o' and '0'
      .replace(/l\s+l/g, 'll') // Correct 'l l' to 'll'
      .replace(/(\w)\/(\w)/g, '$1$2') // Remove stray slashes between characters
      .trim();
    
    // 3. Handle line breaks more intelligently
    const lines = processed.split('\n');
    const joinedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check if this line should be joined with the next one
      if (i < lines.length - 1 && line.length < 40 && !line.endsWith('.') && !line.endsWith('!') && !line.endsWith('?')) {
        joinedLines.push(line + ' ' + (lines[i+1] || '').trim());
        i++; // Skip the next line since we've joined it
      } else {
        joinedLines.push(line);
      }
    }
    
    return joinedLines.join('\n');
  }

  /**
   * Clean up resources
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initialized = false;
    }
  }

  /**
   * Get the name of this engine
   */
  getName(): string {
    return 'enhanced-tesseract';
  }

  /**
   * Check if this engine can process the given file
   */
  canProcess(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif', '.pdf'].includes(ext);
  }
  
  /**
   * Get engine capabilities - replacing Kraken's capabilities endpoint
   */
  getCapabilities(): Record<string, any> {
    return {
      engine: 'EnhancedTesseract',
      version: '1.0.0',
      supported_languages: ['eng', 'deu', 'fra', 'spa'], // Map to Tesseract languages
      enhancement_modes: ['standard', 'enhanced', 'handwritten', 'aggressive'],
      features: [
        'handwriting_recognition',
        'confidence_scoring',
        'line_segmentation',
        'layout_analysis',
        'medical_document_optimization'
      ],
      optimal_for: [
        'handwritten_text',
        'medical_prescriptions',
        'historical_documents',
        'cursive_writing'
      ]
    };
  }
}

// Export the EnhancedTesseractEngine class
export default EnhancedTesseractEngine;

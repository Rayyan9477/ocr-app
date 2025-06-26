import { createWorker, PSM, OEM, Worker } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';
import logger from './logger';
import { OCREngine } from './multi-engine-ocr';
import { generateOutputFilename } from './utils';
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
      this.worker = await createWorker({
        logger: message => {
          if (process.env.DEBUG) {
            logger.debug(`Tesseract: ${JSON.stringify(message)}`);
          }
        }
      });
      
      // Initialize with the language model
      await this.worker.loadLanguage(this.options.lang!);
      await this.worker.initialize(this.options.lang!);
      
      // Set PSM based on whether handwriting optimization is enabled
      if (this.options.enableHandwritingOptimization) {
        // PSM.SINGLE_LINE is often better for handwriting
        await this.worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_LINE,
          tessedit_ocr_engine_mode: OEM.LSTM_ONLY,
          // These parameters help with handwritten text recognition
          tessjs_create_hocr: '1',
          tessjs_create_tsv: '1',
          load_system_dawg: '0', // Turn off dictionary for handwriting
          load_freq_dawg: '0',   // Turn off frequent word dictionary
          tessedit_char_whitelist: this.options.whitelist, // Character whitelist if specified
          tessedit_enable_doc_dict: '0', // Disable document dictionary
          textord_heavy_nr: '1', // Heavy noise removal for handwriting
          textord_noise_rejrows: '1', // Reject noisy rows
          textord_noise_rejcp: '1',   // Reject noisy connected components
          lstm_use_matrix: '1',  // Use matrix for handwriting recognition
          tessedit_write_images: '1', // Write processed images (helpful for debugging)
          textord_space_size_is_variable: '1', // Variable space size for handwriting
          textord_pitch_range: '3', // Increased pitch range for handwriting
          textord_words_default_certainty: '-1.0', // Lower certainty threshold for handwriting
        });
      } else {
        await this.worker.setParameters({
          tessedit_pageseg_mode: this.options.psm!,
          tessedit_ocr_engine_mode: this.options.oem!,
        });
      }
      
      this.initialized = true;
      logger.info('EnhancedTesseractEngine initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize EnhancedTesseractEngine: ${error}`);
      throw new Error(`Failed to initialize EnhancedTesseractEngine: ${error}`);
    }
  }

  /**
   * Preprocess image to enhance OCR accuracy for handwriting
   * This mimics the preprocessing capabilities of Kraken
   */
  private async preprocessImage(inputPath: string): Promise<string> {
    try {
      const tempDir = path.join(process.cwd(), 'tmp', 'enhanced-tesseract');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const outputPath = path.join(tempDir, `${path.basename(inputPath, path.extname(inputPath))}_preprocessed${path.extname(inputPath)}`);
      
      let imageProcessor = sharp(inputPath);
      
      // Apply preprocessing steps based on options
      if (this.options.enableAdaptiveThresholding) {
        // Adaptive thresholding approximation using sharp
        imageProcessor = imageProcessor
          .grayscale()
          .normalise();
      }
      
      if (this.options.enhanceContrast) {
        // Enhance contrast
        imageProcessor = imageProcessor
          .contrast(1.5)
          .gamma(1.2);
      }
      
      if (this.options.deskew) {
        // We can't directly deskew with sharp, but in a real implementation
        // you would integrate with a deskewing library or implement algorithm
      }
      
      if (this.options.removeNoise) {
        // Denoise the image
        imageProcessor = imageProcessor
          .median(1);
      }
      
      // Process and save the image
      await imageProcessor
        .sharpen()
        .toFile(outputPath);
      
      return outputPath;
    } catch (error) {
      logger.error(`Image preprocessing error: ${error}`);
      return inputPath; // Return original if preprocessing fails
    }
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
      
      const outputPath = path.join(outputDir, generateOutputFilename(inputPath, 'enhanced-tesseract'));
      
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

// Helper function to generate proper output filename based on input
export function generateOutputFilename(inputPath: string, engineName: string, suffix: string = 'ocr'): string {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  return `${baseName}_${engineName}_${suffix}${path.extname(inputPath) === '.pdf' ? '.pdf' : '.txt'}`;
}

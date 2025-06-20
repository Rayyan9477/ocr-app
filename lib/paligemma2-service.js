/**
 * PaliGemma2 Service (JavaScript version)
 * Service for document analysis and text extraction using the PaliGemma2 model
 */

import fs from 'fs';
import path from 'path';
import PaliGemma2Simple from './paligemma2-simple.js';

// Simple logger implementation
const logger = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
    error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`)
};

/**
 * PaliGemma2 Vision Language Model Service
 * Service for document analysis and text extraction using the PaliGemma2 model
 */
export class Paligemma2VLService {
  constructor(options = {}) {
    this.options = {
      modelPath: options.modelPath || path.join(process.cwd(), 'models', 'paligemma2'),
      documentType: options.documentType || 'general',
      confidenceThreshold: options.confidenceThreshold || 0.7,
      enhanceResolution: options.enhanceResolution ?? true,
      preserveLayout: options.preserveLayout ?? true,
      enableStructuredDataExtraction: options.enableStructuredDataExtraction ?? true,
      ...options
    };
    
    this.modelPath = this.options.modelPath;
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize the PaliGemma2 service
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing PaliGemma2 VLM Service...');
      
      // Create model directory if it doesn't exist
      if (!fs.existsSync(this.options.modelPath)) {
        fs.mkdirSync(this.options.modelPath, { recursive: true });
        logger.info(`Created model directory: ${this.options.modelPath}`);
      }

      // Initialize PaliGemma2 client using the simple implementation
      this.client = new PaliGemma2Simple();
      await this.client.initialize();

      this.initialized = true;
      logger.info('PaliGemma2 VLM Service initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize PaliGemma2 VLM Service: ${error}`);
      throw new Error(`Failed to initialize PaliGemma2 VLM Service: ${error}`);
    }
  }

  /**
   * Process an image and extract text using PaliGemma2
   */
  async processImage(imagePath, options = {}) {
    if (!this.initialized || !this.client) {
      throw new Error('PaliGemma2 VLM Service is not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Check if image exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file does not exist: ${imagePath}`);
      }

      // Preprocess image if needed (currently just returns the path)
      const processedImagePath = await this.preprocessImage(imagePath, options);

      // Process with PaliGemma2
      const prompt = this.buildExtractionPrompt(options);
      
      const result = await this.client.processImage(processedImagePath, prompt);
      
      // Process the result
      const processingTime = Date.now() - startTime;
      
      return {
        text: result.text || '',
        confidence: result.confidence || 0.9,
        processingTime: processingTime / 1000,
        metadata: {
          model: 'PaliGemma2-VLService',
          documentType: this.options.documentType,
          modelType: result.modelType || 'PaliGemma2Simple',
          enhancedService: true
        }
      };
    } catch (error) {
      logger.error(`Error processing image with PaliGemma2: ${error}`);
      throw new Error(`Failed to process image: ${error}`);
    }
  }

  /**
   * Build extraction prompt based on options
   */
  buildExtractionPrompt(options) {
    let prompt = 'Extract all text from this document with high accuracy. ';
    
    if (options.preserveLayout || this.options.preserveLayout) {
      prompt += 'Preserve formatting, line breaks, and document structure. ';
    }
    
    if (options.documentType === 'handwritten') {
      prompt += 'Pay special attention to handwritten text. ';
    } else if (options.documentType === 'table') {
      prompt += 'Focus on extracting table data with proper structure. ';
    } else if (options.documentType === 'form') {
      prompt += 'Extract form fields and their values. ';
    }
    
    prompt += 'Include all visible text including headers, footers, and page numbers.';
    
    return `<image>${prompt}`;
  }

  /**
   * Analyze document characteristics
   */
  async analyzeDocument(imagePath) {
    if (!this.initialized || !this.client) {
      throw new Error('PaliGemma2 VLM Service is not initialized');
    }

    try {
      const prompt = '<image>Analyze this document and provide details about its characteristics. ' +
                   'Describe if it has handwriting, tables, poor quality, complex layout, and estimate confidence scores.';
      
      const result = await this.client.processImage(imagePath, prompt);
      
      // Parse the response into structured format
      return this.parseDocumentAnalysis(result.text);
      
    } catch (error) {
      logger.error(`Error analyzing document: ${error}`);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Parse document analysis response into structured format
   */
  parseDocumentAnalysis(responseText) {
    if (!responseText) {
      return this.getDefaultAnalysis();
    }
    
    const text = responseText.toLowerCase();
    
    // Simple heuristics to extract information
    const hasHandwriting = text.includes('handwrit') || text.includes('manuscript') || text.includes('cursive');
    const hasTables = text.includes('table') || text.includes('grid') || text.includes('column');
    const poorQuality = text.includes('poor') || text.includes('blurry') || text.includes('low quality') || text.includes('noise');
    const complexLayout = text.includes('complex') || text.includes('multiple column') || text.includes('layout');
    
    // Estimate confidence scores
    const handwritingConfidence = hasHandwriting ? 0.8 : 0.2;
    const tablesConfidence = hasTables ? 0.8 : 0.2;
    const qualityConfidence = poorQuality ? 0.3 : 0.8;
    const layoutConfidence = complexLayout ? 0.6 : 0.8;
    
    return {
      hasHandwriting,
      hasTables,
      poorQuality,
      complexLayout,
      documentType: this.determineDocumentType(text),
      confidence: {
        handwriting: handwritingConfidence,
        tables: tablesConfidence,
        quality: qualityConfidence,
        layout: layoutConfidence,
        overall: (handwritingConfidence + tablesConfidence + qualityConfidence + layoutConfidence) / 4
      },
      metadata: {
        analysisText: responseText,
        service: 'PaliGemma2VLService'
      }
    };
  }

  /**
   * Determine document type from analysis text
   */
  determineDocumentType(text) {
    if (text.includes('form') || text.includes('field')) return 'form';
    if (text.includes('table') || text.includes('spreadsheet')) return 'table';
    if (text.includes('handwrit') || text.includes('manuscript')) return 'handwritten';
    if (text.includes('medical') || text.includes('prescription')) return 'medical';
    if (text.includes('invoice') || text.includes('bill')) return 'invoice';
    if (text.includes('letter') || text.includes('correspondence')) return 'letter';
    return 'general';
  }

  /**
   * Get default document analysis
   */
  getDefaultAnalysis() {
    return {
      hasHandwriting: false,
      hasTables: false,
      poorQuality: false,
      complexLayout: false,
      documentType: 'general',
      confidence: {
        handwriting: 0.7,
        tables: 0.7,
        quality: 0.8,
        layout: 0.8,
        overall: 0.75
      },
      metadata: {
        fallback: true,
        service: 'PaliGemma2VLService'
      }
    };
  }

  /**
   * Preprocess image before processing
   */
  async preprocessImage(imagePath, options = {}) {
    // For now, just return the original path
    // In the future, we could add image enhancement here
    return imagePath;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasClient: !!this.client,
      modelPath: this.modelPath,
      options: this.options
    };
  }

  /**
   * Clean up resources
   */
  async dispose() {
    if (this.client) {
      // PaliGemma2Simple doesn't have a dispose method
      this.client = null;
    }
    this.initialized = false;
    logger.info('PaliGemma2 VLM Service disposed');
  }
}

// Create singleton instance
export const paligemma2Service = new Paligemma2VLService();
export default paligemma2Service;

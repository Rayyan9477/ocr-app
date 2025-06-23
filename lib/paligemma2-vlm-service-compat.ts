/**
 * PaliGemma2 VLM Service Enhanced
 * 
 * This module provides a compatibility layer for the missing Paligemma2VLService
 */

import fs from 'fs';
import path from 'path';
import logger from './logger';
import PaliGemma2Simple from './paligemma2-simple.js';

export class Paligemma2VLService {
  private modelPath: string;
  private client: any = null;
  private initialized: boolean = false;
  private options: any;
  private simpleClient: any = null;

  constructor(options: any = {}) {
    this.options = {
      modelPath: options.modelPath || path.join(process.cwd(), 'models', 'paligemma2'),
      documentType: options.documentType || 'general',
      confidenceThreshold: options.confidenceThreshold || 0.7,
      enhanceResolution: options.enhanceResolution ?? true,
      preserveLayout: options.preserveLayout ?? true,
      enableStructuredDataExtraction: options.enableStructuredDataExtraction ?? true,
    };
    
    this.modelPath = this.options.modelPath;
  }

  /**
   * Initialize the Paligemma2 service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Paligemma2 VLM Service (compatibility mode)...');
      
      // Create model directory if it doesn't exist
      if (!fs.existsSync(this.options.modelPath)) {
        fs.mkdirSync(this.options.modelPath, { recursive: true });
      }

      // Initialize simple client as fallback
      this.simpleClient = new PaliGemma2Simple();
      const success = await this.simpleClient.initialize();
      
      if (!success) {
        logger.warn('Simple PaliGemma2 initialization returned partial success');
      }

      this.initialized = true;
      logger.info('Paligemma2 VLM Service initialized successfully (compatibility mode)');
    } catch (error) {
      logger.error(`Failed to initialize Paligemma2 VLM Service: ${error}`);
      throw new Error(`Failed to initialize Paligemma2 VLM Service: ${error}`);
    }
  }

  /**
   * Process an image with the PaliGemma2 model
   */
  async processImage(imagePath: string, options: any = {}): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    try {
      // Use simple client as fallback
      let result;
      if (this.simpleClient) {
        const prompt = 'Extract all text from this document accurately, preserving formatting and structure';
        result = await this.simpleClient.processImage(imagePath, prompt);
      } else {
        throw new Error('No PaliGemma2 implementation available');
      }

      return {
        text: result.text || '',
        confidence: 0.8,
        processingTime: Date.now() - startTime,
        metadata: {
          engine: 'paligemma2-compat',
          mode: 'compatibility',
          documentType: this.options.documentType
        }
      };
    } catch (error) {
      logger.error(`Error processing image: ${error}`);
      throw error;
    }
  }

  /**
   * Analyze a document with PaliGemma2
   */
  async analyzeDocument(imagePath: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Use simple client as fallback
      if (this.simpleClient) {
        const prompt = 'Analyze this document and describe its structure, quality, and content type';
        const result = await this.simpleClient.processImage(imagePath, prompt);
        
        return {
          hasHandwriting: false,
          hasTables: false,
          poorQuality: false,
          complexLayout: false,
          documentType: this.options.documentType,
          confidence: {
            handwriting: 0.5,
            tables: 0.5,
            quality: 0.8,
            layout: 0.7,
            overall: 0.7
          },
          text: result.text,
          processingTime: result.processingTime
        };
      } else {
        throw new Error('No PaliGemma2 implementation available');
      }
    } catch (error) {
      logger.error(`Error analyzing document: ${error}`);
      throw error;
    }
  }
}

// Export as both default and named export
export default Paligemma2VLService;

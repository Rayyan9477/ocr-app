import { PaliGemma2Client, PaliGemma2ClientOptions } from './vlm/models/paligemma2-client';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import logger from './logger';
import { compatibilityMonitor } from './paligemma2-compatibility-monitor.js';

export interface VLMOptions {
  modelPath?: string;
  documentType?: 'general' | 'handwritten' | 'table' | 'poor_quality' | 'medical';
  confidenceThreshold?: number;
  enhanceResolution?: boolean;
  preserveLayout?: boolean;
  enableStructuredDataExtraction?: boolean;
}

export interface VLMResult {
  text: string;
  confidence: number;
  structuredData?: any;
  processingTime: number;
  layout?: any[];
  metadata?: Record<string, any>;
}

export interface DocumentAnalysis {
  hasHandwriting: boolean;
  hasTables: boolean;
  poorQuality: boolean;
  complexLayout: boolean;
  documentType: string;
  confidence: {
    handwriting: number;
    tables: number;
    quality: number;
    layout: number;
    overall: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Paligemma2 Vision Language Model Service
 * Service for document analysis and text extraction using the Paligemma2 model
 */
export class Paligemma2VLService {
  private modelPath: string;
  private client: PaliGemma2Client | null = null;
  private initialized: boolean = false;
  private options: VLMOptions;
  private processorOnlyMode: boolean = true;

  constructor(options: VLMOptions = {}) {
    this.options = {
      modelPath: options.modelPath || path.join(process.cwd(), 'models', 'paligemma2'),
      documentType: options.documentType || 'general',
      confidenceThreshold: options.confidenceThreshold || 0.7,
      enhanceResolution: options.enhanceResolution ?? true,
      preserveLayout: options.preserveLayout ?? true,
      enableStructuredDataExtraction: options.enableStructuredDataExtraction ?? true,
    };
    
    // Get initial compatibility status
    const compatStatus = compatibilityMonitor.getStatus();
    this.processorOnlyMode = compatStatus.processorOnlyMode;
  }

  /**
   * Initialize the Paligemma2 service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Paligemma2 VLM Service...');
      
      // Check compatibility with transformers.js
      const compatStatus = await compatibilityMonitor.checkCompatibility();
      this.processorOnlyMode = compatStatus.processorOnlyMode;
      
      if (this.processorOnlyMode) {
        logger.warn(`Running in processor-only mode due to transformers.js compatibility issue.`);
        logger.info(`Upgrade instructions: ${compatStatus.upgradeInstructions}`);
      }
      
      // Create model directory if it doesn't exist
      if (!fs.existsSync(this.options.modelPath)) {
        fs.mkdirSync(this.options.modelPath, { recursive: true });
      }

      // Initialize Paligemma2 client
      const clientOptions: PaliGemma2ClientOptions = {
        modelId: 'google/paligemma2-3b-pt-224',
        deploymentStrategy: 'local',
        maxLength: 2048,
        temperature: 0.2,
        topK: 50,
        repetitionPenalty: 1.2,
        numBeams: 3,
        promptTemplate: 'Analyze this document and extract text with high accuracy. Pay attention to details and preserve formatting.\n\nDOCUMENT:\n{image}\n\nTEXT:'
      };

      this.client = new PaliGemma2Client(clientOptions);
      await this.client.initialize();

      this.initialized = true;
      logger.info('Paligemma2 VLM Service initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize Paligemma2 VLM Service: ${error}`);
      throw new Error(`Failed to initialize Paligemma2 VLM Service: ${error}`);
    }
  }
  
  /**
   * Get the current status of the service
   */
  getStatus() {
    return {
      initialized: this.initialized,
      processorOnly: this.processorOnlyMode,
      documentType: this.options.documentType,
      modelPath: this.options.modelPath,
      compatibilityStatus: compatibilityMonitor.getStatus()
    };
  }

  /**
   * Process an image and extract text using Paligemma2
   */
  async processImage(imagePath: string, options?: VLMOptions): Promise<VLMResult> {
    if (!this.initialized || !this.client) {
      throw new Error('Paligemma2 VLM Service is not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Check if image exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      // Preprocess image if needed
      const processedImagePath = await this.preprocessImage(imagePath, options);

      // Process with Paligemma2
      const prompt = 'Extract all text from this document with high accuracy. ' +
                   'Preserve formatting, line breaks, and document structure. ' +
                   'Include all visible text including headers, footers, and page numbers.';
      
      const result = await this.client.process(processedImagePath, prompt);
      
      // Process the result
      const processingTime = (Date.now() - startTime) / 1000;
      
      return {
        text: result.text || '',
        confidence: 0.9, // Paligemma2 doesn't provide confidence, using high default
        processingTime,
        metadata: {
          model: 'google/paligemma2-3b-pt-224',
          documentType: this.options.documentType,
          ...result.metadata
        }
      };
    } catch (error) {
      logger.error(`Error processing image with Paligemma2: ${error}`);
      throw new Error(`Failed to process image: ${error}`);
    }
  }

  /**
   * Analyze document characteristics
   */
  async analyzeDocument(imagePath: string): Promise<DocumentAnalysis> {
    if (!this.initialized || !this.client) {
      throw new Error('Paligemma2 VLM Service is not initialized');
    }

    try {
      const prompt = 'Analyze this document and provide details about its characteristics. ' +
                   'Respond in JSON format with the following structure: ' +
                   '{"hasHandwriting": boolean, "hasTables": boolean, ' +
                   '"poorQuality": boolean, "complexLayout": boolean, ' +
                   '"documentType": string, ' +
                   '"confidence": {"handwriting": number, "tables": number, ' +
                   '"quality": number, "layout": number, "overall": number}}';
      
      const result = await this.client.process(imagePath, prompt);
      
      // Parse the JSON response
      let analysis;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = result.text.match(/```(?:json\n)?([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : result.text;
        analysis = JSON.parse(jsonString);
      } catch (e) {
        logger.warn('Failed to parse document analysis JSON, using defaults');
        analysis = this.getDefaultAnalysis();
      }

      return {
        hasHandwriting: analysis.hasHandwriting || false,
        hasTables: analysis.hasTables || false,
        poorQuality: analysis.poorQuality || false,
        complexLayout: analysis.complexLayout || false,
        documentType: analysis.documentType || 'general',
        confidence: {
          handwriting: analysis.confidence?.handwriting || 0.7,
          tables: analysis.confidence?.tables || 0.7,
          quality: analysis.confidence?.quality || 0.8,
          layout: analysis.confidence?.layout || 0.8,
          overall: analysis.confidence?.overall || 0.8
        },
        metadata: analysis.metadata || {}
      };
    } catch (error) {
      logger.error(`Error analyzing document: ${error}`);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Get default document analysis
   */
  private getDefaultAnalysis(): DocumentAnalysis {
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
        overall: 0.8
      },
      metadata: {}
    };
  }

  /**
   * Preprocess image before processing
   */
  private async preprocessImage(imagePath: string, options?: VLMOptions): Promise<string> {
    const outputPath = path.join(
      path.dirname(imagePath),
      `${path.basename(imagePath, path.extname(imagePath))}_processed${path.extname(imagePath)}`
    );

    const enhanceOptions = {
      enhanceResolution: options?.enhanceResolution ?? this.options.enhanceResolution,
    };

    try {
      let image = sharp(imagePath);
      const metadata = await image.metadata();

      // Only process if needed
      if (enhanceOptions.enhanceResolution && metadata.width && metadata.width < 2048) {
        // Enhance resolution if needed
        image = image.resize({
          width: Math.min(2048, metadata.width * 2),
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Apply additional processing if needed
      image = image
        .normalise()
        .modulate({
          brightness: 1.1,
          saturation: 1.1
        })
        .sharpen();

      await image.toFile(outputPath);
      return outputPath;
    } catch (error) {
      logger.error(`Error preprocessing image: ${error}`);
      // Return original path if processing fails
      return imagePath;
    }
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    if (this.client) {
      await this.client.dispose();
      this.client = null;
    }
    this.initialized = false;
  }
}

// Create singleton instance
export const paligemma2Service = new Paligemma2VLService();
export default paligemma2Service;

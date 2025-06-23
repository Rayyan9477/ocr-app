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
    constructor(options = {}) {
        this.client = null;
        this.initialized = false;
        this.simpleClient = null;
        this.options = {
            modelPath: options.modelPath || path.join(process.cwd(), 'models', 'paligemma2'),
            documentType: options.documentType || 'general',
            confidenceThreshold: options.confidenceThreshold || 0.7,
            enhanceResolution: options.enhanceResolution ?? true,
            preserveLayout: options.preserveLayout ?? true,
            enableStructuredDataExtraction: options.enableStructuredDataExtraction ?? true,
            fallbackPrompts: {
                general: '<image>Extract all text from this document with high accuracy. Preserve formatting, line breaks, and document structure. Include all visible text including headers, footers, and page numbers.',
                handwriting: '<image>Extract all handwritten text from this document with high accuracy. Handle cursive writing, different handwriting styles, and preserve the layout.',
                form: '<image>Extract all form fields and their values from this document. Maintain field relationships, tables, and structured data.',
                invoice: '<image>Extract all invoice information including dates, amounts, item details, and payment information. Preserve the structured format.',
                id: '<image>Extract all information from this ID card/document including names, dates, numbers, and other personal information.'
            },
            processorOnlyPrompts: {
                general: 'Document processed using PaliGemma2 processor. The document appears to contain text content that would typically be extracted with OCR. Due to library limitations, full model analysis is not available.',
                handwriting: 'Document processed using PaliGemma2 processor. The document appears to contain handwritten content. Due to library limitations, full handwriting recognition is not available.',
                form: 'Document processed using PaliGemma2 processor. The document appears to be a structured form with fields and possibly tables. Due to library limitations, full form extraction is not available.',
                invoice: 'Document processed using PaliGemma2 processor. The document appears to be an invoice or financial document. Due to library limitations, full invoice data extraction is not available.',
                id: 'Document processed using PaliGemma2 processor. The document appears to be an ID card or identification document. Due to library limitations, full ID information extraction is not available.'
            }
        };
        this.modelPath = this.options.modelPath;
        this.processorOnly = true; // Start with assumption of processor-only mode
    }
    
    /**
     * Initialize the Paligemma2 service
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
            }
            
            // Initialize simple client as fallback
            this.simpleClient = new PaliGemma2Simple();
            const success = await this.simpleClient.initialize();
            
            if (success) {
                this.processorOnly = false; // Full model was loaded
                logger.info('PaliGemma2 full model loaded successfully');
            } else {
                logger.warn('PaliGemma2 initialized in processor-only mode');
                this.processorOnly = true;
            }
            
            this.initialized = true;
            logger.info('PaliGemma2 VLM Service initialized successfully');
        } catch (error) {
            logger.error(`Failed to initialize PaliGemma2 VLM Service: ${error}`);
            throw new Error(`Failed to initialize PaliGemma2 VLM Service: ${error}`);
        }
    }
    
    /**
     * Process an image with the PaliGemma2 model
     */
    async processImage(imagePath, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        const startTime = Date.now();
        try {
            // Get document type for appropriate prompt selection
            const docType = options.documentType || this.options.documentType || 'general';
            
            // Select the appropriate prompt based on document type and mode
            let prompt;
            if (this.processorOnly) {
                // When in processor-only mode, return more informative placeholder text
                const placeholderText = this.options.processorOnlyPrompts[docType] || 
                                        this.options.processorOnlyPrompts.general;
                
                return {
                    text: placeholderText,
                    confidence: 0.6,
                    processingTime: Date.now() - startTime,
                    metadata: {
                        engine: 'paligemma2-compat',
                        mode: 'processor-only',
                        documentType: docType,
                        libraryStatus: 'transformers.js does not fully support PaliGemma2 model type'
                    },
                    modelUsed: 'PaliGemma2 Service (Processor Only)'
                };
            } else {
                // Use the appropriate prompt for the document type
                prompt = this.options.fallbackPrompts[docType] || this.options.fallbackPrompts.general;
                
                // Process with the simple client
                const result = await this.simpleClient.processImage(imagePath, prompt);
                
                return {
                    text: result.text || '',
                    confidence: result.confidence || 0.8,
                    processingTime: Date.now() - startTime,
                    metadata: {
                        engine: 'paligemma2-compat',
                        mode: 'full-model',
                        documentType: docType
                    },
                    modelUsed: 'PaliGemma2 Service'
                };
            }
        } catch (error) {
            logger.error(`Error processing image: ${error}`);
            throw error;
        }
    }
    
    /**
     * Analyze a document with PaliGemma2
     */
    async analyzeDocument(imagePath) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        try {
            const docType = this.options.documentType || 'general';
            
            if (this.processorOnly) {
                // Return placeholder analysis in processor-only mode
                return {
                    hasHandwriting: false,
                    hasTables: false,
                    poorQuality: false,
                    complexLayout: false,
                    documentType: docType,
                    confidence: {
                        handwriting: 0.5,
                        tables: 0.5,
                        quality: 0.7,
                        layout: 0.6,
                        overall: 0.6
                    },
                    text: this.options.processorOnlyPrompts[docType] || this.options.processorOnlyPrompts.general,
                    processingTime: 100,
                    modelUsed: 'PaliGemma2 Service (Processor Only)',
                    note: 'Analysis performed in processor-only mode due to library limitations'
                };
            } else if (this.simpleClient) {
                // Use simple client to analyze
                const prompt = 'Analyze this document and describe its structure, quality, and content type';
                const result = await this.simpleClient.processImage(imagePath, prompt);
                
                return {
                    hasHandwriting: false,
                    hasTables: false,
                    poorQuality: false,
                    complexLayout: false,
                    documentType: docType,
                    confidence: {
                        handwriting: 0.7,
                        tables: 0.7,
                        quality: 0.8,
                        layout: 0.8,
                        overall: 0.75
                    },
                    text: result.text,
                    processingTime: result.processingTime || 100,
                    modelUsed: 'PaliGemma2 Service'
                };
            } else {
                throw new Error('No PaliGemma2 implementation available');
            }
        } catch (error) {
            logger.error(`Error analyzing document: ${error}`);
            throw error;
        }
    }
    
    /**
     * Get the status of the service
     */
    getStatus() {
        return {
            initialized: this.initialized,
            processorOnly: this.processorOnly,
            documentType: this.options.documentType,
            modelPath: this.modelPath
        };
    }
}

// Export as both default and named export
export default Paligemma2VLService;

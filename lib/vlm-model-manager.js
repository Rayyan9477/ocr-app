/**
 * VLM Model Manager
 * Enhanced with comprehensive PaliGemma2 integration
 * Now with OLMOCR support for extractable PDFs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PaliGemma2Simple from './paligemma2-simple.js';
import os from 'os';
import { execSync } from 'child_process';
import pdfHandler from './pdf-handler.js';

// Import OLMOCR integration
import OLMOCRIntegration from './olmocr-integration.js';
import ExtractablePdfProcessor from './extractable-pdf-processor.js';

// Try to import the enhanced PaliGemma2 integration if available
let Paligemma2OCRIntegration = null;
try {
  const module = await import('./paligemma2-ocr-integration.js');
  Paligemma2OCRIntegration = module.default || module.Paligemma2OCRIntegration;
} catch (error) {
  console.warn('Enhanced PaliGemma2 integration not available, using simple version');
}

// Try to import PaliGemma2 service if available
let Paligemma2VLService = null;
try {
  const module = await import('./paligemma2-service.js');
  Paligemma2VLService = module.default || module.Paligemma2VLService;
} catch (error) {
  console.warn('PaliGemma2 service not available, using simple version');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enhanced model configurations with no fallback strategies
const MODELS = {
  paligemma2: {
    id: 'NSTiwari/paligemma2-3b-mix-224-onnx',
    type: 'PaliGemma2Enhanced',
    description: 'PaliGemma2 3B vision-language model for OCR and document understanding (ONNX optimized)',
    capabilities: ['text_extraction', 'document_analysis', 'handwriting_recognition', 'structured_data'],
    deploymentStrategies: ['local']
  },
  olmocr: {
    id: 'allenai/olmocr',
    type: 'OLMOCR',
    description: 'OLMOCR for high-quality extractable PDF processing',
    capabilities: ['pdf_extraction', 'text_extraction', 'ocr', 'extractable_pdf'],
    deploymentStrategies: ['local']
  }
};

const MODEL_CACHE_DIR = path.join(__dirname, '..', 'models');
const TEMP_DIR = path.join(os.tmpdir(), 'paligemma-temp');

class VLMModelManager {
  constructor(options = {}) {
    this.options = {
      useEnhancedIntegration: true,
      fallbackToSimple: false, // Disable fallback to simple version
      enableCloudFallback: false, // Disable cloud fallback
      maxRetries: 3,
      timeout: 60000,
      modelPaths: [path.join(process.cwd(), 'models', 'paligemma2', 'google')],
      enableOLMOCR: true,
      ...options
    };
    
    this.paligemma2 = null;
    this.enhancedPaligemma2 = null;
    this.paligemma2Service = null;
    this.olmocr = null;
    this.extractablePdfProcessor = null;
    this.modelHealthStatus = new Map();
    this.initializationAttempts = new Map();
    
    this.ensureModelDir();
    this.ensureTempDir();
  }

  ensureModelDir() {
    if (!fs.existsSync(MODEL_CACHE_DIR)) {
      fs.mkdirSync(MODEL_CACHE_DIR, { recursive: true });
    }
  }
  
  ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  }
  
  /**
   * Checks if a file is a PDF by its extension and magic number
   * @param {string} filePath - Path to the file
   * @returns {boolean} - True if the file is a PDF
   */
  isPdf(filePath) {
    return pdfHandler.isPdfFile(filePath);
  }
  
  /**
   * Converts a PDF to an image that can be processed by PaliGemma2
   * @param {string} pdfPath - Path to the PDF file
   * @returns {Promise<string>} - Path to the converted first page image
   */
  async convertPdfToImage(pdfPath) {
    try {
      return pdfHandler.convertPdfToImage(pdfPath, TEMP_DIR);
    } catch (error) {
      console.error(`Error converting PDF to image: ${error.message}`);
      throw new Error(`PDF conversion failed: ${error.message}`);
    }
  }
  
  /**
   * Ensures the file is in a format that can be processed by PaliGemma2
   * @param {string} filePath - Path to the file
   * @returns {Promise<string>} - Path to a processable image
   */
  async ensureProcessableImage(filePath) {
    if (this.isPdf(filePath)) {
      return await this.convertPdfToImage(filePath);
    }
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    // For non-PDF files, return the original path
    return filePath;
  }

  async loadModel(modelKey = 'paligemma2') {
    if (modelKey !== 'paligemma2' && modelKey !== 'olmocr') {
      throw new Error(`Only 'paligemma2' and 'olmocr' models are supported. Requested: ${modelKey}`);
    }

    // If requesting OLMOCR model
    if (modelKey === 'olmocr') {
      return await this.loadOLMOCRModel();
    }

    const modelConfig = MODELS[modelKey];
    console.log(`Loading PaliGemma2 model: ${modelConfig.id}`);
    console.log(`Description: ${modelConfig.description}`);

    // Track initialization attempts
    const attempts = this.initializationAttempts.get(modelKey) || 0;
    this.initializationAttempts.set(modelKey, attempts + 1);

    try {
      // Strategy 1: Try enhanced PaliGemma2 integration first
      if (this.options.useEnhancedIntegration && Paligemma2OCRIntegration && !this.enhancedPaligemma2) {
        console.log('🚀 Attempting enhanced PaliGemma2 integration...');
        try {
          this.enhancedPaligemma2 = new Paligemma2OCRIntegration({
            mode: 'adaptive' // Use adaptive mode for best results
          });
          
          const enhancedSuccess = await this.enhancedPaligemma2.initialize();
          if (enhancedSuccess) {
            this.modelHealthStatus.set(modelKey, 'healthy');
            console.log(`✅ Enhanced PaliGemma2 integration loaded successfully`);
            return this.enhancedPaligemma2;
          }
        } catch (enhancedError) {
          console.warn('Enhanced PaliGemma2 integration failed:', enhancedError.message);
          this.enhancedPaligemma2 = null;
        }
      }

      // Strategy 2: Try PaliGemma2 service
      if (Paligemma2VLService && !this.paligemma2Service) {
        console.log('🔧 Attempting PaliGemma2 service initialization...');
        try {
          // Use the first model path from options or fallback to default
          const modelPath = this.options.modelPaths && this.options.modelPaths.length > 0 
            ? this.options.modelPaths[0] 
            : path.join(MODEL_CACHE_DIR, 'paligemma2', 'google');
            
          this.paligemma2Service = new Paligemma2VLService({
            modelPath: modelPath,
            documentType: 'general',
            confidenceThreshold: 0.7,
            enhanceResolution: true,
            preserveLayout: true
          });
          
          await this.paligemma2Service.initialize();
          this.modelHealthStatus.set(modelKey, 'healthy');
          console.log(`✅ PaliGemma2 service loaded successfully`);
          return this.paligemma2Service;
        } catch (serviceError) {
          console.warn('PaliGemma2 service failed:', serviceError.message);
          this.paligemma2Service = null;
        }
      }

      // Strategy 3: Try simple PaliGemma2 (original working version)
      if (!this.paligemma2) {
        console.log('⚡ Attempting simple PaliGemma2 initialization...');
        try {
          this.paligemma2 = new PaliGemma2Simple();
          const success = await this.paligemma2.initialize();
          
          if (success) {
            this.modelHealthStatus.set(modelKey, 'healthy');
            console.log(`✅ Simple PaliGemma2 model loaded successfully`);
            return this.paligemma2;
          } else {
            // Partial success (processor only)
            this.modelHealthStatus.set(modelKey, 'partial');
            console.log(`⚠️ PaliGemma2 partially loaded (processor only)`);
            return this.paligemma2;
          }
        } catch (simpleError) {
          console.warn('Simple PaliGemma2 failed:', simpleError.message);
          this.paligemma2 = null;
        }
      }

      // If all strategies failed
      this.modelHealthStatus.set(modelKey, 'failed');
      const errorMsg = `All PaliGemma2 initialization strategies failed after ${attempts} attempts`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);

    } catch (error) {
      this.modelHealthStatus.set(modelKey, 'failed');
      console.error(`❌ Failed to load PaliGemma2 model:`, error.message);
      throw error;
    }
  }

  /**
   * Get the best available model instance
   */
  getAvailableModel() {
    if (this.enhancedPaligemma2) return this.enhancedPaligemma2;
    if (this.paligemma2Service) return this.paligemma2Service;
    if (this.paligemma2) return this.paligemma2;
    if (this.olmocr) return this.olmocr;
    return null;
  }

  async processImage(imagePath, prompt = '<image>caption en', modelKey = 'paligemma2') {
    if (modelKey !== 'paligemma2') {
      throw new Error(`Only 'paligemma2' model is supported. Requested: ${modelKey}`);
    }

    await this.loadModel(modelKey);
    
    try {
      console.log(`Processing image with PaliGemma2: ${imagePath}`);
      console.log(`Using prompt: ${prompt}`);
      
      // Convert PDF to image if needed
      const processablePath = await this.ensureProcessableImage(imagePath);
      
      // Get the best available model
      const model = this.getAvailableModel();
      if (!model) {
        throw new Error('No PaliGemma2 model is available');
      }
      
      let result;
      
      // Use enhanced integration if available
      if (this.enhancedPaligemma2 && model === this.enhancedPaligemma2) {
        console.log('🚀 Using enhanced PaliGemma2 integration');
        
        // Determine the best processing mode based on prompt
        const mode = this.determineProcessingMode(prompt);
        
        if (mode === 'text_extraction') {
          result = await this.enhancedPaligemma2.process({
            imagePath: processablePath,
            task: 'text_extraction',
            options: { preserveLayout: true, confidenceThreshold: 0.8 }
          });
        } else if (mode === 'document_analysis') {
          result = await this.enhancedPaligemma2.process({
            imagePath: processablePath,
            task: 'document_analysis',
            options: { includeStructure: true }
          });
        } else {
          // Generic processing
          result = await this.enhancedPaligemma2.processImage(processablePath, prompt);
        }
      }
      // Use PaliGemma2 service if available
      else if (this.paligemma2Service && model === this.paligemma2Service) {
        console.log('🔧 Using PaliGemma2 service');
        
        if (prompt.includes('extract') || prompt.includes('text')) {
          result = await this.paligemma2Service.processImage(processablePath, {
            documentType: 'general',
            preserveLayout: true
          });
        } else if (prompt.includes('analyz')) {
          const analysis = await this.paligemma2Service.analyzeDocument(processablePath);
          result = {
            text: JSON.stringify(analysis, null, 2),
            confidence: analysis.confidence?.overall || 0.8,
            processingTime: 1000,
            modelType: 'PaliGemma2Service'
          };
        } else {
          result = await this.paligemma2Service.processImage(processablePath);
        }
      }
      // Use simple PaliGemma2 as fallback
      else if (this.paligemma2) {
        console.log('⚡ Using simple PaliGemma2');
        result = await this.paligemma2.processImage(processablePath, prompt);
      } else {
        throw new Error('No working PaliGemma2 model available');
      }
      
      // Clean up temp file if created
      if (processablePath !== imagePath && processablePath.startsWith(TEMP_DIR)) {
        try {
          fs.unlinkSync(processablePath);
        } catch (cleanupError) {
          console.warn(`Failed to clean up temp file: ${cleanupError.message}`);
        }
      }
      
      // Enhance result with model information
      return {
        ...result,
        modelUsed: this.getModelType(model),
        enhancedIntegration: model === this.enhancedPaligemma2,
        serviceIntegration: model === this.paligemma2Service
      };
      
    } catch (error) {
      console.error(`Error processing image with PaliGemma2:`, error);
      throw error;
    }
  }

  /**
   * Determine the best processing mode based on prompt
   */
  determineProcessingMode(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('extract') && lowerPrompt.includes('text')) {
      return 'text_extraction';
    } else if (lowerPrompt.includes('analyz') || lowerPrompt.includes('structure')) {
      return 'document_analysis';
    } else if (lowerPrompt.includes('table') || lowerPrompt.includes('form')) {
      return 'structured_data';
    } else if (lowerPrompt.includes('highlight')) {
      return 'highlight_detection';
    } else if (lowerPrompt.includes('handwrit')) {
      return 'handwriting_recognition';
    }
    
    return 'generic';
  }

  /**
   * Get model type identifier
   */
  getModelType(model) {
    if (model === this.enhancedPaligemma2) return 'Enhanced PaliGemma2 Integration';
    if (model === this.paligemma2Service) return 'PaliGemma2 Service';
    if (model === this.paligemma2) return 'Simple PaliGemma2';
    return 'Unknown';
  }

  async extractText(imagePath, modelKey = 'paligemma2') {
    try {
      // Convert PDF to image if needed
      const processablePath = await this.ensureProcessableImage(imagePath);
      
      // Make sure model is loaded
      await this.loadModel(modelKey);
      
      // Get the best available model
      const model = this.getAvailableModel();
      if (!model) {
        throw new Error('No PaliGemma2 model is available');
      }
      
      let result;
      
      if (this.paligemma2) {
        result = await this.paligemma2.extractText(processablePath);
      } else {
        throw new Error('No working PaliGemma2 model available for text extraction');
      }
      
      // Clean up temp file if created
      if (processablePath !== imagePath && processablePath.startsWith(TEMP_DIR)) {
        try {
          fs.unlinkSync(processablePath);
        } catch (cleanupError) {
          console.warn(`Failed to clean up temp file: ${cleanupError.message}`);
        }
      }
      
      return result;
    } catch (error) {
      console.error(`Error extracting text:`, error);
      throw error;
    }
  }

  async captionImage(imagePath, modelKey = 'paligemma2') {
    try {
      // Convert PDF to image if needed
      const processablePath = await this.ensureProcessableImage(imagePath);
      
      // Make sure model is loaded
      await this.loadModel(modelKey);
      
      // Get the best available model
      const model = this.getAvailableModel();
      if (!model) {
        throw new Error('No PaliGemma2 model is available');
      }
      
      let result;
      
      if (this.paligemma2) {
        result = await this.paligemma2.captionImage(processablePath);
      } else {
        throw new Error('No working PaliGemma2 model available for image captioning');
      }
      
      // Clean up temp file if created
      if (processablePath !== imagePath && processablePath.startsWith(TEMP_DIR)) {
        try {
          fs.unlinkSync(processablePath);
        } catch (cleanupError) {
          console.warn(`Failed to clean up temp file: ${cleanupError.message}`);
        }
      }
      
      return result;
    } catch (error) {
      console.error(`Error captioning image:`, error);
      throw error;
    }
  }

  /**
   * Cleans up any temporary files created during processing
   */
  cleanup() {
    try {
      // Check if the temp directory exists
      if (fs.existsSync(TEMP_DIR)) {
        // Read all files in the temp directory
        const files = fs.readdirSync(TEMP_DIR);
        
        // Delete each file
        for (const file of files) {
          const filePath = path.join(TEMP_DIR, file);
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            console.warn(`Failed to delete temp file ${filePath}: ${error.message}`);
          }
        }
        
        console.log(`Cleaned up ${files.length} temporary files`);
      }
    } catch (error) {
      console.error(`Error during cleanup: ${error.message}`);
    }
  }
  
  /**
   * Handles buffer or Blob data by saving it to a temporary file
   * @param {Buffer|Uint8Array|ArrayBuffer|object} data - The buffer or blob data
   * @param {string} extension - File extension to use (default: .jpg)
   * @returns {Promise<string>} - Path to the temporary file
   */
  async handleBufferData(data, extension = '.jpg') {
    this.ensureTempDir();
    
    const timestamp = Date.now();
    const tempPath = path.join(TEMP_DIR, `buffer-${timestamp}${extension}`);
    
    try {
      // Convert data to buffer if it's not already
      let buffer;
      
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else if (data instanceof Uint8Array) {
        buffer = Buffer.from(data);
      } else if (typeof data === 'object' && data !== null) {
        // Handle possible File or Blob object
        if (typeof data.arrayBuffer === 'function') {
          // Modern File or Blob object
          const arrayBuffer = await data.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        } else if (data.buffer instanceof ArrayBuffer) {
          // TypedArray
          buffer = Buffer.from(data.buffer);
        } else if (typeof data === 'object' && data.constructor && data.constructor.name === 'File') {
          // Node.js experimental File API
          const arrayBuffer = await data.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        } else {
          throw new Error('Unsupported data format');
        }
      } else {
        throw new Error('Unsupported data format');
      }
      
      // Write buffer to temp file
      fs.writeFileSync(tempPath, buffer);
      return tempPath;
    } catch (error) {
      console.error(`Error handling buffer data: ${error.message}`);
      throw error;
    }
  }

  getModelStatus() {
    const status = {};
    for (const [key, config] of Object.entries(MODELS)) {
      if (key === 'paligemma2') {
        let paligemmaStatus = {
          initialized: false,
          hasProcessor: false,
          hasModel: false,
          modelId: null
        };
        
        // Only get status if PaliGemma2 is properly initialized
        if (this.paligemma2 && typeof this.paligemma2.getStatus === 'function') {
          try {
            paligemmaStatus = this.paligemma2.getStatus();
          } catch (error) {
            console.warn('Failed to get PaliGemma2 status:', error.message);
          }
        }
        
        status[key] = {
          config,
          loaded: paligemmaStatus.initialized,
          health: this.modelHealthStatus.get(key) || 'unknown',
          hasProcessor: paligemmaStatus.hasProcessor,
          hasModel: paligemmaStatus.hasModel,
          modelId: paligemmaStatus.modelId
        };
      } else if (key === 'olmocr') {
        let olmStatus = {
          initialized: false,
          status: 'uninitialized',
          model: null
        };
        
        // Get OLMOCR status if available
        if (this.olmocr && typeof this.olmocr.getStatus === 'function') {
          try {
            olmStatus = this.olmocr.getStatus();
          } catch (error) {
            console.warn('Failed to get OLMOCR status:', error.message);
          }
        }
        
        status[key] = {
          config,
          loaded: olmStatus.initialized,
          health: this.modelHealthStatus.get(key) || 'unknown',
          status: olmStatus.status,
          hasExtractableProcessor: this.extractablePdfProcessor !== null
        };
      }
    }
    
    return status;
  }

  async healthCheck() {
    console.log('\n🔍 Model Health Check');
    console.log('=================================');
    
    const status = this.getModelStatus();
    
    for (const [key, info] of Object.entries(status)) {
      console.log(`\n📊 Model: ${key}`);
      console.log(`   ID: ${info.config.id}`);
      console.log(`   Description: ${info.config.description}`);
      console.log(`   Initialized: ${info.loaded ? '✅' : '❌'}`);
      console.log(`   Health: ${info.health || 'unknown'}`);
      
      if (key === 'paligemma2') {
        console.log(`   Has Processor: ${info.hasProcessor ? '✅' : '❌'}`);
        console.log(`   Has Model: ${info.hasModel ? '✅' : '❌'}`);
        console.log(`   Model ID: ${info.modelId}`);
      } else if (key === 'olmocr') {
        console.log(`   PDF Processing: ${this.extractablePdfProcessor ? '✅' : '❌'}`);
      }
    }
    
    return status;
  }

  async initializeDefaultModel() {
    console.log('🚀 Initializing models...');
    try {
      // First initialize PaliGemma2
      await this.loadModel('paligemma2');
      
      // Then initialize OLMOCR if enabled
      if (this.options.enableOLMOCR) {
        try {
          await this.loadModel('olmocr');
        } catch (olmError) {
          console.warn('⚠️ OLMOCR initialization failed, continuing with PaliGemma2 only', olmError);
        }
      }
      
      console.log('✅ Model initialization complete');
      return true;
    } catch (error) {
      console.error('❌ Model initialization failed:', error);
      return false;
    }
  }

  /**
   * Load the OLMOCR model
   */
  async loadOLMOCRModel() {
    console.log('Loading PaliGemma2-based OLMOCR integration...');
    
    // Track initialization attempts
    const attempts = this.initializationAttempts.get('olmocr') || 0;
    this.initializationAttempts.set('olmocr', attempts + 1);
    
    try {
      // First, ensure PaliGemma2 is loaded
      if (!this.paligemma2) {
        await this.loadModel('paligemma2');
      }
      
      if (!this.olmocr && this.options.enableOLMOCR) {
        console.log('🚀 Initializing OLMOCR integration with PaliGemma2...');
        this.olmocr = new OLMOCRIntegration({
          useFallbackModels: false // Disable fallback models
        });
        const success = await this.olmocr.initialize();
        
        if (success) {
          this.modelHealthStatus.set('olmocr', 'healthy');
          console.log('✅ PaliGemma2-based OLMOCR integration initialized successfully');
          
          // Initialize the extractable PDF processor
          this.extractablePdfProcessor = new ExtractablePdfProcessor();
          await this.extractablePdfProcessor.initialize();
          
          return this.olmocr;
        } else {
          this.modelHealthStatus.set('olmocr', 'failed');
          console.warn('⚠️ OLMOCR initialization failed');
          throw new Error('OLMOCR initialization failed');
        }
      } else if (this.olmocr) {
        return this.olmocr;
      } else {
        throw new Error('OLMOCR integration is disabled in configuration');
      }
    } catch (error) {
      this.modelHealthStatus.set('olmocr', 'failed');
      console.error(`Failed to load PaliGemma2-based OLMOCR model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a PDF to make it extractable while preserving visual appearance
   * 
   * @param {string} pdfPath - Path to the PDF file
   * @param {object} options - Processing options
   * @returns {Promise<string>} - Path to the processed extractable PDF
   */
  async makeExtractablePdf(pdfPath, options = {}) {
    try {
      console.log(`Making extractable PDF with PaliGemma2: ${pdfPath}`);
      
      // Ensure PaliGemma2 is loaded first
      if (!this.paligemma2) {
        await this.loadModel('paligemma2');
      }
      
      // Load OLMOCR model if not already loaded
      if (!this.olmocr) {
        await this.loadOLMOCRModel();
      }
      
      // Use the extractable PDF processor
      if (this.extractablePdfProcessor) {
        return await this.extractablePdfProcessor.processPdf(pdfPath, options);
      }
      
      // Fallback to direct OLMOCR processing with PaliGemma2
      if (this.olmocr) {
        return await this.olmocr.processExtractablePdf(pdfPath, options);
      }
      
      throw new Error('PaliGemma2-based extractable PDF processing failed to initialize');
    } catch (error) {
      console.error(`Error making extractable PDF with PaliGemma2: ${error.message}`);
      throw error;
    }
  }
}

// CLI usage
if (import.meta.url === new URL(import.meta.url).href) {
  const manager = new VLMModelManager();
  
  const command = process.argv[2] || 'init';
  
  switch (command) {
    case 'init':
      manager.initializeDefaultModel();
      break;
    case 'health':
      manager.healthCheck();
      break;
    case 'status':
      console.log(JSON.stringify(manager.getModelStatus(), null, 2));
      break;
    default:
      console.log('Usage: node vlm-model-manager.js [init|health|status]');
  }
}

// Export both the class and a default export
export { VLMModelManager };
export default VLMModelManager;

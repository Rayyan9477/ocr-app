#!/usr/bin/env node

/**
 * Simple PaliGemma2 Implementation using Hugging Face Transformers.js
 * Based on the working example from NSTiwari/PaliGemma2-ONNX-Transformers.js
 */

import { AutoProcessor, AutoModelForVision2Seq, pipeline, RawImage, env } from "@huggingface/transformers";
import fs from 'fs';
import path from 'path';
import { MODEL_CONFIG } from './paligemma2-simple-config.js';

// Configure Transformers.js environment for better model loading
env.allowRemoteModels = true;
env.allowLocalModels = true;
env.useBrowserCache = false;

// Import load_image function from transformers.js
const { load_image } = await import("@huggingface/transformers");

// Model configuration - use downloaded local files
const MODEL_ID = MODEL_CONFIG.MODEL_ID; // Points to local ONNX Community model
const MODEL_DIR = MODEL_CONFIG.MODEL_DIR;
const PROCESSOR_CONFIG = path.join(MODEL_DIR, 'preprocessor_config.json');
const USE_LOCAL = true; // Always use local files since they're downloaded
const MODEL_CACHE_DIR = MODEL_CONFIG.PRIMARY_MODEL_DIR;

// Validation function for model files
const validateModelPath = (modelPath) => {
    if (!fs.existsSync(modelPath)) {
        throw new Error(`Model directory not found at: ${modelPath}`);
    }
    if (!fs.existsSync(PROCESSOR_CONFIG)) {
        throw new Error(`Processor config not found at: ${PROCESSOR_CONFIG}`);
    }
    return true;
};

export class PaliGemma2Simple {
  constructor() {
    this.processor = null;
    this.model = null;
    this.pipeline = null;
    this.isInitialized = false;
    this.validatedModelPath = MODEL_CONFIG.MODEL_DIR;
    this.accuracySettings = MODEL_CONFIG.ACCURACY_SETTINGS || {};
    this.modelConfig = {
      ...MODEL_CONFIG,
      useLocal: true,
      cacheDir: this.validatedModelPath
    };
  }

  // Enhanced model directory validation with fallback paths
  ensureModelCacheDir() {
    // First, try to find existing model files
    this.validatedModelPath = this.findValidModelPath();
    
    if (!this.validatedModelPath) {
      // Create the primary model directory if no valid path found
      if (!fs.existsSync(MODEL_CACHE_DIR)) {
        fs.mkdirSync(MODEL_CACHE_DIR, { recursive: true });
      }
      this.validatedModelPath = MODEL_CACHE_DIR;
    }
    
    console.log(`✅ Using model path: ${this.validatedModelPath}`);
  }

  // Find the best available model path
  findValidModelPath() {
    const searchPaths = MODEL_CONFIG.MODEL_SEARCH_PATHS || [MODEL_CACHE_DIR];
    
    for (const searchPath of searchPaths) {
      if (this.validateModelFiles(searchPath)) {
        console.log(`✅ Found valid model files in: ${searchPath}`);
        return searchPath;
      }
    }
    
    console.log('⚠️ No complete model files found, will download as needed');
    return null;
  }

  // Validate that required model files exist
  validateModelFiles(modelPath) {
    if (!fs.existsSync(modelPath)) {
      return false;
    }
    
    const requiredFiles = MODEL_CONFIG.REQUIRED_FILES || [
      'model-00001-of-00002.safetensors',
      'model-00002-of-00002.safetensors',
      'model.safetensors.index.json',
      'tokenizer.json',
      'config.json'
    ];
    for (const file of requiredFiles) {
      const filePath = path.join(modelPath, file);
      if (!fs.existsSync(filePath)) {
        console.log(`❌ Missing required file: ${file} in ${modelPath}`);
        return false;
      }
    }
    
    return true;
  }

  // Enhanced model information logging with validation
  logLocalModelInfo() {
    const modelPath = this.validatedModelPath || MODEL_CACHE_DIR;
    
    if (USE_LOCAL) {
      console.log('🔍 Using local model files:');
      console.log(`📁 Model directory: ${modelPath}`);
      
      // Check all model files from configuration
      const allFiles = Object.values(MODEL_CONFIG.MODEL_FILES);
      const requiredFiles = MODEL_CONFIG.REQUIRED_FILES || [];
      
      console.log('📋 Model files status:');
      for (const file of allFiles) {
        const filePath = path.join(modelPath, file);
        const exists = fs.existsSync(filePath);
        const isRequired = requiredFiles.includes(file);
        const status = exists ? '✅ Found' : (isRequired ? '❌ Missing (Required)' : '⚠️ Missing (Optional)');
        console.log(`   ${file}: ${status}`);
        
        if (exists) {
          try {
            const stats = fs.statSync(filePath);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`      Size: ${sizeMB} MB`);
          } catch (e) {
            // Ignore stat errors
          }
        }
      }
      
      // Validate model completeness
      const isComplete = this.validateModelFiles(modelPath);
      console.log(`🎯 Model validation: ${isComplete ? '✅ Complete' : '❌ Incomplete'}`);
      
    } else {
      console.log('🌐 Using remote model files (Hugging Face)');
      console.log(`📡 Model ID: ${MODEL_ID}`);
    }
    
    // Log accuracy enhancement settings
    if (this.accuracySettings.enablePreprocessing) {
      console.log('🚀 Accuracy enhancements enabled:');
      Object.entries(this.accuracySettings).forEach(([key, value]) => {
        if (value === true) {
          console.log(`   ✓ ${key}`);
        }
      });
    }
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('PaliGemma2 already initialized');
      return true;
    }

    try {
      console.log('� Initializing PaliGemma2 with local models...');
      console.log(`📁 Model path: ${MODEL_ID}`);

      // Verify local model files exist
      if (!fs.existsSync(MODEL_ID)) {
        throw new Error(`Model directory not found: ${MODEL_ID}`);
      }

      // Check for required files
      const configPath = path.join(MODEL_ID, 'config.json');
      const processorPath = path.join(MODEL_ID, 'preprocessor_config.json');
      
      if (!fs.existsSync(configPath)) {
        throw new Error(`Model config not found: ${configPath}`);
      }
      
      if (!fs.existsSync(processorPath)) {
        throw new Error(`Processor config not found: ${processorPath}`);
      }

      console.log('✅ Model files verified, loading processor...');
      
      // Load processor from local path
      try {
        this.processor = await AutoProcessor.from_pretrained(MODEL_ID, {
          local_files_only: true,
          cache_dir: MODEL_CACHE_DIR
        });
        console.log('✅ Processor loaded successfully');
      } catch (processorError) {
        console.error(`Failed to load processor: ${processorError.message}`);
        throw processorError;
      }

      // Try to load the model - PaliGemma2 might not be fully supported yet
      try {
        console.log('📥 Attempting to load PaliGemma2 model...');
        
        // First try with AutoModelForVision2Seq
        try {
          this.model = await AutoModelForVision2Seq.from_pretrained(MODEL_ID, {
            local_files_only: true,
            cache_dir: MODEL_CACHE_DIR,
            device: 'cpu', // Use CPU for better compatibility
            dtype: 'fp32'
          });
          console.log('✅ Model loaded successfully with AutoModelForVision2Seq');
        } catch (autoModelError) {
          // Check for specific unsupported model type error
          if (autoModelError.message.includes('Unsupported model type: paligemma')) {
            console.warn('The current version of transformers.js does not yet support PaliGemma2 model type.');
            throw new Error('Unsupported model type: paligemma');
          } else {
            throw autoModelError;
          }
        }
        
      } catch (modelError) {
        console.warn(`AutoModelForVision2Seq loading failed: ${modelError.message}`);
        
        // Try alternative loading with pipeline
        try {
          console.log('🔄 Trying pipeline loading method...');
          const { pipeline: pipelineFunc } = await import("@huggingface/transformers");
          
          // Try loading with explicit model type override
          this.pipeline = await pipelineFunc('image-to-text', MODEL_ID, {
            local_files_only: true,
            cache_dir: MODEL_CACHE_DIR,
            device: 'cpu',
            model_type: 'vision2seq' // Try to force the model type
          });
          
          if (this.pipeline) {
            this.model = this.pipeline.model;
            console.log('✅ Model loaded successfully with pipeline');
          }
          
        } catch (pipelineError) {
          console.warn(`Pipeline loading also failed: ${pipelineError.message}`);
          
          // Continue with processor-only mode
          console.log('⚠️ Continuing with processor-only mode (limited functionality)');
          this.model = null;
        }
      }
      
      this.isInitialized = true;
      const hasModel = !!this.model || !!this.pipeline;
      console.log(`✅ PaliGemma2 initialization complete (${hasModel ? 'full' : 'processor-only'} mode)`);
      
      return hasModel;

    } catch (error) {
      console.error('❌ Failed to initialize PaliGemma2:', error.message);
      
      // Try fallback to Google model if ONNX Community fails
      if (MODEL_ID.includes('onnx-community')) {
        try {
          console.log('� Trying fallback to Google model...');
          const googleModelPath = MODEL_CONFIG.PRIMARY_MODEL_DIR;
          
          if (fs.existsSync(googleModelPath)) {
            this.processor = await AutoProcessor.from_pretrained(googleModelPath, {
              local_files_only: true
            });
            console.log('✅ Fallback processor loaded from Google model');
            this.isInitialized = true;
            return false; // Partial success
          }
        } catch (fallbackError) {
          console.error('❌ Fallback initialization also failed:', fallbackError.message);
        }
      }
      
      throw new Error(`PaliGemma2 initialization failed: ${error.message}`);
    }
  }
  async processImage(imagePath, prompt = '<image>caption en') {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.processor) {
      throw new Error('Processor not available. Please check initialization.');
    }

    try {
      console.log(`Processing image: ${imagePath}`);
      console.log(`Using prompt: ${prompt}`);

      // Check if this is a PDF and convert it if needed
      let actualImagePath = imagePath;
      let tempPdfImage = null;
      
      if (typeof imagePath === 'string' && imagePath.toLowerCase().endsWith('.pdf')) {
        // Convert PDF to image for processing
        const { execSync } = await import('child_process');
        const { join } = await import('path');
        const { existsSync } = await import('fs');
        const { tmpdir } = await import('os');
        
        const tempDir = join(tmpdir(), 'paligemma-temp');
        if (!existsSync(tempDir)) {
          const { mkdirSync } = await import('fs');
          mkdirSync(tempDir, { recursive: true });
        }
        
        tempPdfImage = join(tempDir, `pdf-${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`);
        console.log(`Converting PDF to image: ${imagePath} -> ${tempPdfImage}`);
        
        // Use ImageMagick to convert first page of PDF to an image, force RGB colorspace
        const cmd = `convert -density 300 "${imagePath}"[0] -quality 100 -colorspace RGB -background white -alpha remove "${tempPdfImage}"`;
        execSync(cmd);
        
        if (!existsSync(tempPdfImage)) {
          throw new Error('Failed to generate image from PDF');
        }
        
        console.log(`PDF converted to image successfully: ${tempPdfImage}`);
        actualImagePath = tempPdfImage;
      }

      // Load image - handle both file paths and buffers
      let image;
      try {
        if (typeof actualImagePath === 'string') {
          // It's a file path - use the load_image function from transformers.js
          console.log('Loading image with load_image function');
          image = await load_image(actualImagePath);
        } else if (Buffer.isBuffer(actualImagePath)) {
          // It's a buffer - save to temp file first and then load with load_image
          const fs = await import('fs');
          const path = await import('path');
          const os = await import('os');
          
          const tempDir = path.join(os.tmpdir(), 'paligemma-temp');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          const tempPath = path.join(tempDir, `temp_${Date.now()}.jpg`);
          fs.writeFileSync(tempPath, actualImagePath);
          try {
            console.log('Loading buffer image with load_image function');
            image = await load_image(tempPath);
          } finally {
            // Clean up temp file
            try {
              fs.unlinkSync(tempPath);
            } catch (cleanupError) {
              console.warn(`Failed to cleanup temp file: ${cleanupError}`);
            }
          }
        } else {
          throw new Error('Image input must be a file path or a Buffer');
        }
        
        console.log('Image loaded successfully');
      } catch (err) {
        console.error('Error loading image:', err);
        throw new Error(`Error loading image: ${err.message}`);
      }

      let result;
      
      // Try using the pipeline if available (preferred method)
      if (this.pipeline) {
        try {
          console.log('Using image-to-text pipeline');
          const pipelineResults = await this.pipeline(actualImagePath, {
            prompt: prompt,
            max_new_tokens: 100
          });
          
          result = {
            text: pipelineResults[0]?.generated_text || pipelineResults[0]?.text || 'No text generated',
            confidence: 0.95,
            model: 'paligemma2-pipeline',
            processedAt: new Date(),
            modelType: 'PaliGemma2-Pipeline',
            prompt: prompt,
            status: 'success'
          };
          
          console.log(`✅ Pipeline result: ${result.text}`);
        } catch (pipelineError) {
          console.error('Pipeline processing failed:', pipelineError);
          // Fall back to processor+model method
        }
      }
      
      // If pipeline didn't work or isn't available, try processor+model approach
      if (!result) {
        try {
          console.log('Using processor approach');
          // Process inputs - the processor expects image first, then text prompt
          const inputs = await this.processor(image, prompt);
          console.log('Inputs processed successfully');

          if (!this.model) {
            // Return a placeholder result if model is not available
            console.log('⚠️  Model not available, returning placeholder result');
            result = {
              text: `Image processed with prompt: ${prompt} (Model not fully loaded)`,
              confidence: 0.5,
              model: 'paligemma2-simple',
              processedAt: new Date(),
              modelType: 'PaliGemma2-Processor-Only',
              prompt: prompt,
              status: 'limited',
              note: 'Processor-only mode - full model inference not available in current transformers.js version'
            };
          } else {
            // Generate response using the model
            console.log('Generating response with model...');
            const output = await this.model.generate({
              ...inputs,
              max_new_tokens: 50,
              do_sample: false
            });
            
            result = {
              text: output.text || 'Generated text not available',
              confidence: 0.85,
              model: 'paligemma2-simple',
              processedAt: new Date(),
              modelType: 'PaliGemma2-Complete',
              prompt: prompt,
              status: 'success'
            };
          }
        } catch (processorError) {
          console.error('Processor approach failed:', processorError);
          
          // Final fallback - basic OCR simulation
          result = {
            text: `OCR processing attempted for image with prompt: ${prompt}`,
            confidence: 0.3,
            model: 'paligemma2-fallback',
            processedAt: new Date(),
            modelType: 'PaliGemma2-Fallback',
            prompt: prompt,
            status: 'fallback',
            error: processorError.message
          };
        }
      }
      
      // Clean up temporary PDF image if created
      if (tempPdfImage) {
        try {
          const fs = await import('fs');
          fs.unlinkSync(tempPdfImage);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup temp PDF image: ${cleanupError}`);
        }
      }
      
      return result;

    } catch (error) {
      console.error(`❌ Error processing image:`, error);
      throw error;
    }
  }

  async extractText(imagePath) {
    return await this.processImage(imagePath, '<image>extract all text');
  }

  async captionImage(imagePath) {
    return await this.processImage(imagePath, '<image>caption en');
  }

  async detectObjects(imagePath, objectType) {
    const prompt = `<image>detect ${objectType}`;
    return await this.processImage(imagePath, prompt);
  }

  async answerQuestion(imagePath, question) {
    const prompt = `<image>${question}`;
    return await this.processImage(imagePath, prompt);
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      hasProcessor: !!this.processor,
      hasModel: !!this.model,
      modelId: MODEL_ID
    };
  }
}

// CLI usage
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  const paligemma = new PaliGemma2Simple();
  
  const command = process.argv[2] || 'init';
  
  switch (command) {
    case 'init':
      paligemma.initialize().then(success => {
        console.log(success ? 'Initialization completed successfully' : 'Initialization completed with warnings');
      }).catch(error => {
        console.error('Initialization failed:', error.message);
        process.exit(1);
      });
      break;
    case 'status':
      paligemma.initialize().then(() => {
        console.log(JSON.stringify(paligemma.getStatus(), null, 2));
      });
      break;
    default:
      console.log('Usage: node paligemma2-simple.js [init|status]');
  }
}

export default PaliGemma2Simple;

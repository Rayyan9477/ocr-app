#!/usr/bin/env node

/**
 * VLM Model Manager
 * Handles model initialization, caching, and health checks
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Model configurations
const MODELS = {
  trocr_handwritten: {
    id: 'Xenova/trocr-base-handwritten',
    type: 'VisionEncoderDecoderModel',
    processor: 'TrOCRProcessor',
    description: 'Optimized for handwritten text recognition'
  },
  trocr_printed: {
    id: 'Xenova/trocr-base-printed',
    type: 'VisionEncoderDecoderModel', 
    processor: 'TrOCRProcessor',
    description: 'Optimized for printed text recognition'
  },
  donut_base: {
    id: 'Xenova/donut-base-finetuned-cord-v2',
    type: 'VisionEncoderDecoderModel',
    processor: 'DonutProcessor',
    description: 'Document understanding model'
  }
};

const MODEL_CACHE_DIR = path.join(__dirname, '..', 'models');

export class VLMModelManager {
  constructor() {
    this.loadedModels = new Map();
    this.modelHealthStatus = new Map();
    this.ensureModelDir();
  }

  ensureModelDir() {
    if (!fs.existsSync(MODEL_CACHE_DIR)) {
      fs.mkdirSync(MODEL_CACHE_DIR, { recursive: true });
    }
  }

  async loadModel(modelKey = 'trocr_handwritten') {
    if (this.loadedModels.has(modelKey)) {
      console.log(`Model ${modelKey} already loaded`);
      return this.loadedModels.get(modelKey);
    }

    const modelConfig = MODELS[modelKey];
    if (!modelConfig) {
      throw new Error(`Unknown model: ${modelKey}`);
    }

    console.log(`Loading model: ${modelConfig.id}`);
    console.log(`Description: ${modelConfig.description}`);

    try {
      // Set cache directory
      const modelCacheDir = path.join(MODEL_CACHE_DIR, modelKey);
      process.env.TRANSFORMERS_CACHE = modelCacheDir;

      // Dynamic import of transformers
      const { 
        VisionEncoderDecoderModel, 
        TrOCRProcessor,
        DonutProcessor 
      } = await import('@xenova/transformers');

      const ModelClass = VisionEncoderDecoderModel;
      const ProcessorClass = modelConfig.processor === 'TrOCRProcessor' ? TrOCRProcessor : DonutProcessor;

      console.log('Downloading model files...');
      const [model, processor] = await Promise.all([
        ModelClass.from_pretrained(modelConfig.id),
        ProcessorClass.from_pretrained(modelConfig.id)
      ]);

      const modelInstance = {
        model,
        processor,
        config: modelConfig,
        loadedAt: new Date()
      };

      this.loadedModels.set(modelKey, modelInstance);
      this.modelHealthStatus.set(modelKey, 'healthy');

      console.log(`✅ Model ${modelKey} loaded successfully`);
      console.log(`Cache location: ${modelCacheDir}`);
      
      return modelInstance;

    } catch (error) {
      console.error(`❌ Failed to load model ${modelKey}:`, error);
      this.modelHealthStatus.set(modelKey, 'failed');
      throw error;
    }
  }

  async processImage(imagePath, modelKey = 'trocr_handwritten') {
    const modelInstance = await this.loadModel(modelKey);
    
    try {
      // Process the image
      const { model, processor } = modelInstance;
      
      // Load image (simplified example)
      console.log(`Processing image: ${imagePath}`);
      
      // This is a simplified example - in practice you'd load the actual image
      // and process it through the model
      const result = {
        text: "Sample OCR result",
        confidence: 0.95,
        model: modelKey,
        processedAt: new Date()
      };
      
      return result;
      
    } catch (error) {
      console.error(`Error processing image with ${modelKey}:`, error);
      throw error;
    }
  }

  getModelStatus() {
    const status = {};
    for (const [key, config] of Object.entries(MODELS)) {
      status[key] = {
        config,
        loaded: this.loadedModels.has(key),
        health: this.modelHealthStatus.get(key) || 'unknown',
        loadedAt: this.loadedModels.get(key)?.loadedAt
      };
    }
    return status;
  }

  async healthCheck() {
    console.log('\n🔍 VLM Model Health Check');
    console.log('========================');
    
    const status = this.getModelStatus();
    
    for (const [key, info] of Object.entries(status)) {
      console.log(`\n📊 Model: ${key}`);
      console.log(`   ID: ${info.config.id}`);
      console.log(`   Description: ${info.config.description}`);
      console.log(`   Loaded: ${info.loaded ? '✅' : '❌'}`);
      console.log(`   Health: ${info.health || 'unknown'}`);
      if (info.loadedAt) {
        console.log(`   Loaded at: ${info.loadedAt.toISOString()}`);
      }
    }
    
    return status;
  }

  async initializeDefaultModel() {
    console.log('🚀 Initializing default VLM model...');
    try {
      await this.loadModel('trocr_handwritten');
      console.log('✅ Default model initialization complete');
      return true;
    } catch (error) {
      console.log('⚠️  Primary model failed, trying backup...');
      try {
        await this.loadModel('trocr_printed');
        console.log('✅ Backup model initialization complete');
        return true;
      } catch (backupError) {
        console.error('❌ All model initialization attempts failed');
        return false;
      }
    }
  }
}

// CLI usage
if (process.argv[1] === fileURLToPath(import.meta.url)) {
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

export default VLMModelManager;

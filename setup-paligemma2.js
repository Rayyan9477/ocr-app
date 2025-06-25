#!/usr/bin/env node

/**
 * PaliGemma2 Model Setup and Verification
 * Checks for model availability and sets up proper configurations
 */

import fs from 'fs';
import path from 'path';
import { MODEL_CONFIG } from './lib/paligemma2-simple-config.js';

class PaliGemma2Setup {
  constructor() {
    this.modelPaths = MODEL_CONFIG.MODEL_SEARCH_PATHS;
    this.requiredFiles = [
      'config.json',
      'preprocessor_config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'special_tokens_map.json',
      'generation_config.json'
    ];
  }

  checkModelPath(modelPath) {
    console.log(`🔍 Checking: ${modelPath}`);
    
    if (!fs.existsSync(modelPath)) {
      console.log(`   ❌ Path does not exist`);
      return false;
    }
    
    const missingFiles = [];
    for (const file of this.requiredFiles) {
      const filePath = path.join(modelPath, file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
      }
    }
    
    if (missingFiles.length > 0) {
      console.log(`   ⚠️ Missing files: ${missingFiles.join(', ')}`);
      return false;
    }
    
    console.log(`   ✅ Valid model directory`);
    return true;
  }

  findValidModelPath() {
    console.log('🔍 Searching for valid PaliGemma2 model...\n');
    
    for (const modelPath of this.modelPaths) {
      if (this.checkModelPath(modelPath)) {
        return modelPath;
      }
    }
    
    return null;
  }

  listModelFiles(modelPath) {
    console.log(`\n📁 Files in ${modelPath}:`);
    try {
      const files = fs.readdirSync(modelPath);
      files.forEach(file => {
        const filePath = path.join(modelPath, file);
        const stats = fs.statSync(filePath);
        const size = stats.isFile() ? `(${(stats.size / 1024 / 1024).toFixed(2)} MB)` : '(dir)';
        console.log(`   ${stats.isFile() ? '📄' : '📁'} ${file} ${size}`);
      });
    } catch (error) {
      console.log(`   ❌ Error reading directory: ${error.message}`);
    }
  }

  async setupPaliGemma2() {
    console.log('🚀 PaliGemma2 Model Setup and Verification\n');
    
    // Check current configuration
    console.log('📋 Current Configuration:');
    console.log(`   Model ID: ${MODEL_CONFIG.MODEL_ID}`);
    console.log(`   Primary Dir: ${MODEL_CONFIG.PRIMARY_MODEL_DIR}`);
    console.log(`   Fallback IDs: ${MODEL_CONFIG.FALLBACK_MODEL_IDS.join(', ')}`);
    
    // Find valid model
    const validModelPath = this.findValidModelPath();
    
    if (validModelPath) {
      console.log(`\n✅ Valid model found: ${validModelPath}`);
      this.listModelFiles(validModelPath);
      
      // Update configuration to use the valid path
      console.log('\n🔧 Model is ready for use!');
      return true;
    } else {
      console.log('\n❌ No valid PaliGemma2 model found');
      console.log('\n💡 Solutions:');
      console.log('1. Run the downloader: node download-paligemma2-onnx.js');
      console.log('2. Download manually from ONNX Community models');
      console.log('3. Use existing local model files');
      
      console.log('\n📁 Available directories:');
      this.modelPaths.forEach(path => {
        console.log(`   ${fs.existsSync(path) ? '✅' : '❌'} ${path}`);
        if (fs.existsSync(path)) {
          this.listModelFiles(path);
        }
      });
      
      return false;
    }
  }

  async testModelLoading() {
    console.log('\n🧪 Testing model loading...');
    
    try {
      const { PaliGemma2Simple } = await import('./lib/paligemma2-simple.js');
      const model = new PaliGemma2Simple();
      
      console.log('⏳ Initializing model...');
      const success = await model.initialize();
      
      const status = model.getStatus();
      console.log('\n📊 Model Status:');
      console.log(`   Initialized: ${status.initialized}`);
      console.log(`   Has Processor: ${status.hasProcessor}`);
      console.log(`   Has Model: ${status.hasModel}`);
      console.log(`   Model ID: ${status.modelId}`);
      
      if (success) {
        console.log('\n✅ Model loaded successfully!');
        
        // Test basic functionality
        console.log('🧪 Testing basic functionality...');
        try {
          // Create a simple test
          const testResult = await model.captionImage('./test-file.pdf');
          console.log('✅ Basic functionality test passed');
        } catch (testError) {
          console.log('⚠️ Basic functionality test failed:', testError.message);
        }
      } else {
        console.log('\n⚠️ Model partially loaded (processor only)');
      }
      
      return success;
      
    } catch (error) {
      console.log('\n❌ Model loading test failed:', error.message);
      return false;
    }
  }
}

async function main() {
  const setup = new PaliGemma2Setup();
  
  const modelReady = await setup.setupPaliGemma2();
  
  if (modelReady) {
    await setup.testModelLoading();
  }
  
  console.log('\n🏁 Setup complete!');
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default PaliGemma2Setup;

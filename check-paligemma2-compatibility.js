#!/usr/bin/env node
/**
 * PaliGemma2 Compatibility Checker
 * 
 * This script checks the compatibility of the installed transformers.js library
 * with the PaliGemma2 model and reports on the current status.
 */

import { env, AutoProcessor } from "@huggingface/transformers";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure environment
env.allowLocalModels = true;
env.useBrowserCache = false;

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Model directories
const modelDir = path.join(__dirname, 'models', 'paligemma2', 'google');
const onnxModelDir = path.join(__dirname, 'models', 'paligemma2', 'onnx-community');

async function checkTransformersCompatibility() {
  console.log('🔍 Checking transformers.js compatibility with PaliGemma2...');
  
  // Get transformers.js version
  let version = "unknown";
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'node_modules', '@huggingface', 'transformers', 'package.json'), 'utf8'));
    version = pkg.version;
  } catch (e) {
    console.warn('⚠️ Could not determine transformers.js version');
  }
  
  console.log(`📦 Transformers.js version: ${version}`);
  
  // Check if model directories exist
  const modelExists = fs.existsSync(modelDir);
  const onnxModelExists = fs.existsSync(onnxModelDir);
  
  console.log(`📁 Google model directory exists: ${modelExists ? '✅ Yes' : '❌ No'}`);
  console.log(`📁 ONNX model directory exists: ${onnxModelExists ? '✅ Yes' : '❌ No'}`);
  
  // Try to load processor
  console.log('🔧 Attempting to load PaliGemma2 processor...');
  let processor = null;
  let modelType = "unknown";
  
  try {
    if (modelExists) {
      processor = await AutoProcessor.from_pretrained(modelDir, {
        local_files_only: true
      });
      console.log('✅ Processor loaded successfully from Google model');
      
      // Get model type from config
      const configPath = path.join(modelDir, 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        modelType = config.model_type;
        console.log(`📋 Model type: ${modelType}`);
      }
    } else if (onnxModelExists) {
      processor = await AutoProcessor.from_pretrained(onnxModelDir, {
        local_files_only: true
      });
      console.log('✅ Processor loaded successfully from ONNX model');
      
      // Get model type from config
      const configPath = path.join(onnxModelDir, 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        modelType = config.model_type;
        console.log(`📋 Model type: ${modelType}`);
      }
    } else {
      console.log('❌ No model directories found');
      return {
        version,
        processorCompatible: false,
        modelCompatible: false,
        message: 'No model directories found',
        processorOnlyMode: true
      };
    }
  } catch (error) {
    console.error('❌ Processor loading failed:', error.message);
    return {
      version,
      processorCompatible: false,
      modelCompatible: false,
      message: `Processor loading failed: ${error.message}`,
      processorOnlyMode: true
    };
  }
  
  // Try to determine model compatibility
  console.log('🔧 Checking model type compatibility...');
  
  try {
    // Try loading the model (this will fail if unsupported)
    const { AutoModelForVision2Seq } = await import("@huggingface/transformers");
    
    try {
      console.log('Attempting to load model (this will fail if unsupported)...');
      await AutoModelForVision2Seq.from_pretrained(modelExists ? modelDir : onnxModelDir, {
        local_files_only: true
      });
      
      console.log('✅ Model loaded successfully - transformers.js supports PaliGemma2!');
      
      return {
        version,
        processorCompatible: true,
        modelCompatible: true,
        modelType,
        message: 'PaliGemma2 model type is supported',
        processorOnlyMode: false
      };
    } catch (loadError) {
      if (loadError.message.includes('Unsupported model type: paligemma')) {
        console.warn('⚠️ Transformers.js does not support PaliGemma2 model type');
        return {
          version,
          processorCompatible: true,
          modelCompatible: false,
          modelType,
          message: 'Transformers.js does not support PaliGemma2 model type',
          processorOnlyMode: true
        };
      } else {
        console.error('❌ Error loading model:', loadError.message);
        return {
          version,
          processorCompatible: true,
          modelCompatible: false,
          modelType,
          message: `Error loading model: ${loadError.message}`,
          processorOnlyMode: true
        };
      }
    }
  } catch (error) {
    console.error('❌ Error checking model compatibility:', error.message);
    return {
      version,
      processorCompatible: !!processor,
      modelCompatible: false,
      message: `Error checking model compatibility: ${error.message}`,
      processorOnlyMode: true
    };
  }
}

// Run the compatibility check
console.log('🚀 PaliGemma2 Compatibility Checker');
console.log('=====================================');

checkTransformersCompatibility().then(result => {
  console.log('\n📊 Compatibility Results:');
  console.log('=====================================');
  console.log(`Transformers.js version: ${result.version}`);
  console.log(`Processor compatible: ${result.processorCompatible ? '✅ Yes' : '❌ No'}`);
  console.log(`Model compatible: ${result.modelCompatible ? '✅ Yes' : '❌ No'}`);
  console.log(`Mode: ${result.processorOnlyMode ? '⚠️ Processor-only' : '✅ Full model'}`);
  console.log(`Message: ${result.message}`);
  
  if (result.processorOnlyMode) {
    console.log('\n⚠️ The system will operate in processor-only mode');
    console.log('📝 See PALIGEMMA2-PROCESSOR-ONLY-MODE.md for more information');
  } else {
    console.log('\n✅ The system can operate with full model functionality');
  }
  
  // Save results to a file
  const resultPath = path.join(__dirname, 'paligemma2-compatibility.json');
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`\n💾 Results saved to ${resultPath}`);
}).catch(error => {
  console.error('❌ Compatibility check failed:', error);
  process.exit(1);
});
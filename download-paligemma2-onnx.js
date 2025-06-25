#!/usr/bin/env node

/**
 * PaliGemma2 ONNX Model Downloader
 * Downloads ONNX Community models for local use
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const MODEL_DIR = path.join(process.cwd(), 'models', 'paligemma2-onnx');
const ONNX_COMMUNITY_MODELS = [
  'onnx-community/paligemma2-3b-pt-224',
  'onnx-community/paligemma2-3b-ft-docci-448'
];

class PaliGemma2ModelDownloader {
  constructor() {
    this.modelsDir = MODEL_DIR;
  }

  async ensureModelDirectory() {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
      console.log(`📁 Created model directory: ${this.modelsDir}`);
    }
  }

  async installHuggingFaceCLI() {
    try {
      console.log('🔧 Installing Hugging Face CLI...');
      await new Promise((resolve, reject) => {
        const install = spawn('pip', ['install', '--user', 'huggingface_hub'], { stdio: 'inherit' });
        install.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Failed to install huggingface_hub (exit code: ${code})`));
        });
      });
      console.log('✅ Hugging Face CLI installed successfully');
    } catch (error) {
      console.error('❌ Failed to install Hugging Face CLI:', error.message);
      throw error;
    }
  }

  async downloadModel(modelId) {
    console.log(`📥 Downloading model: ${modelId}`);
    
    const modelPath = path.join(this.modelsDir, modelId.replace('/', '_'));
    
    try {
      // Use huggingface-hub to download the model
      const downloadCommand = `huggingface-cli download ${modelId} --local-dir "${modelPath}" --local-dir-use-symlinks False`;
      
      await this.runCommand(downloadCommand);
      
      console.log(`✅ Model downloaded successfully: ${modelPath}`);
      return modelPath;
      
    } catch (error) {
      console.error(`❌ Failed to download ${modelId}:`, error.message);
      
      // Try alternative method using git clone
      try {
        console.log(`🔄 Trying git clone method for ${modelId}...`);
        const gitUrl = `https://huggingface.co/${modelId}`;
        const gitCommand = `git clone ${gitUrl} "${modelPath}"`;
        
        await this.runCommand(gitCommand);
        console.log(`✅ Model cloned successfully: ${modelPath}`);
        return modelPath;
        
      } catch (gitError) {
        console.error(`❌ Git clone also failed:`, gitError.message);
        throw error;
      }
    }
  }

  async runCommand(command) {
    return new Promise((resolve, reject) => {
      console.log(`🔧 Running: ${command}`);
      
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, { 
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true 
      });
      
      let output = '';
      let errorOutput = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });
      
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
        process.stderr.write(data);
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
        }
      });
    });
  }

  async checkModelExists(modelId) {
    const modelPath = path.join(this.modelsDir, modelId.replace('/', '_'));
    
    if (!fs.existsSync(modelPath)) {
      return false;
    }
    
    // Check for essential files
    const essentialFiles = [
      'config.json',
      'tokenizer.json',
      'preprocessor_config.json'
    ];
    
    for (const file of essentialFiles) {
      if (!fs.existsSync(path.join(modelPath, file))) {
        console.log(`⚠️ Missing essential file: ${file} in ${modelPath}`);
        return false;
      }
    }
    
    console.log(`✅ Model exists and is complete: ${modelPath}`);
    return true;
  }

  async downloadAllModels() {
    console.log('🚀 Starting PaliGemma2 ONNX model download...');
    
    await this.ensureModelDirectory();
    
    const downloadedModels = [];
    
    for (const modelId of ONNX_COMMUNITY_MODELS) {
      try {
        if (await this.checkModelExists(modelId)) {
          console.log(`⏭️ Model already exists: ${modelId}`);
          downloadedModels.push(modelId);
          continue;
        }
        
        const modelPath = await this.downloadModel(modelId);
        downloadedModels.push(modelId);
        
      } catch (error) {
        console.error(`❌ Failed to download ${modelId}:`, error.message);
      }
    }
    
    console.log('\n📊 Download Summary:');
    console.log(`✅ Successfully downloaded: ${downloadedModels.length} models`);
    downloadedModels.forEach(model => console.log(`   - ${model}`));
    
    if (downloadedModels.length === 0) {
      console.log('❌ No models were downloaded successfully');
      console.log('💡 Try installing huggingface-hub: pip install huggingface-hub');
      return false;
    }
    
    return true;
  }

  async installHuggingFaceHub() {
    console.log('📦 Installing huggingface-hub...');
    try {
      await this.runCommand('pip install huggingface-hub');
      console.log('✅ huggingface-hub installed successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to install huggingface-hub:', error.message);
      return false;
    }
  }
}

async function main() {
  const downloader = new PaliGemma2ModelDownloader();
  
  try {
    // Check if huggingface-cli is available
    try {
      await downloader.runCommand('huggingface-cli --version');
    } catch (error) {
      console.log('⚠️ huggingface-cli not found, attempting to install...');
      const installed = await downloader.installHuggingFaceHub();
      if (!installed) {
        throw new Error('Failed to install huggingface-hub');
      }
    }
    
    const success = await downloader.downloadAllModels();
    
    if (success) {
      console.log('\n🎉 Model download completed successfully!');
      console.log('🔧 You can now use PaliGemma2 VLM in your OCR application');
    } else {
      console.log('\n❌ Model download failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Download process failed:', error.message);
    console.log('\n💡 Alternative solutions:');
    console.log('1. Install huggingface-hub manually: pip install huggingface-hub');
    console.log('2. Download models manually from: https://huggingface.co/onnx-community/paligemma2-3b-pt-224');
    console.log(`3. Place models in: ${MODEL_DIR}`);
    process.exit(1);
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default PaliGemma2ModelDownloader;

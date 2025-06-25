#!/usr/bin/env node

/**
 * Direct PaliGemma2 Model Downloader using curl
 * Downloads the actual ONNX model files from HuggingFace Hub
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Model configuration
const MODEL_REPO = 'NSTiwari/paligemma2-3b-mix-224-onnx';
const COMBINED_DIR = path.join(__dirname, 'models', 'paligemma2', 'combined');
const BASE_URL = `https://huggingface.co/${MODEL_REPO}/resolve/main`;

// Files to download with their expected sizes (approximate)
const FILES_TO_DOWNLOAD = [
  { name: 'config.json', size: 'small' },
  { name: 'preprocessor_config.json', size: 'small' },
  { name: 'tokenizer_config.json', size: 'small' },
  { name: 'generation_config.json', size: 'small' },
  { name: 'special_tokens_map.json', size: 'small' },
  { name: 'tokenizer.json', size: 'medium' },
  { name: 'decoder_model_merged_quantized.onnx', size: 'large' },
  { name: 'vision_encoder_quantized.onnx', size: 'large' },
  { name: 'model.onnx', size: 'large' }
];

async function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
}

async function downloadFile(filename) {
  try {
    console.log(`📥 Downloading ${filename}...`);
    
    const localPath = path.join(COMBINED_DIR, filename);
    const url = `${BASE_URL}/${filename}`;
    
    // Skip if file already exists and is not empty
    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      if (stats.size > 0) {
        console.log(`✅ ${filename} already exists (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
      }
    }
    
    // Use curl to download
    const curlCommand = `curl -L -o "${localPath}" "${url}"`;
    console.log(`Running: ${curlCommand}`);
    
    const { stdout, stderr } = await execAsync(curlCommand);
    
    // Verify download
    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      if (stats.size > 0) {
        console.log(`✅ Downloaded ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
      } else {
        console.log(`❌ Downloaded file ${filename} is empty`);
        fs.unlinkSync(localPath); // Remove empty file
        return false;
      }
    } else {
      console.log(`❌ Failed to download ${filename}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error downloading ${filename}: ${error.message}`);
    return false;
  }
}

async function downloadAllFiles() {
  console.log(`🚀 Downloading PaliGemma2 model files from ${MODEL_REPO}...`);
  console.log(`📁 Destination: ${COMBINED_DIR}`);
  
  await ensureDirectory(COMBINED_DIR);
  
  let successCount = 0;
  let totalCount = FILES_TO_DOWNLOAD.length;
  
  // Download small files first
  console.log(`\n📦 Downloading configuration files...`);
  for (const file of FILES_TO_DOWNLOAD.filter(f => f.size === 'small')) {
    const success = await downloadFile(file.name);
    if (success) successCount++;
  }
  
  // Download medium files
  console.log(`\n📦 Downloading tokenizer files...`);
  for (const file of FILES_TO_DOWNLOAD.filter(f => f.size === 'medium')) {
    const success = await downloadFile(file.name);
    if (success) successCount++;
  }
  
  // Download large files (ONNX models)
  console.log(`\n📦 Downloading ONNX model files (this may take a while)...`);
  for (const file of FILES_TO_DOWNLOAD.filter(f => f.size === 'large')) {
    const success = await downloadFile(file.name);
    if (success) successCount++;
  }
  
  console.log(`\n📊 Download Summary:`);
  console.log(`✅ Successfully downloaded: ${successCount}/${totalCount} files`);
  
  if (successCount >= 6) { // At least config files and some models
    console.log(`\n🎉 Essential model files downloaded successfully!`);
    console.log(`📁 Model location: ${COMBINED_DIR}`);
    
    // Update symlinks
    await updateSymlinks();
    
    return true;
  } else {
    console.log(`\n⚠️ Too many files failed to download. Please check your internet connection and try again.`);
    return false;
  }
}

async function updateSymlinks() {
  console.log(`\n🔗 Updating symbolic links...`);
  
  const onnxDir = path.join(__dirname, 'models', 'paligemma2_onnx');
  await ensureDirectory(onnxDir);
  
  const onnxFiles = [
    'decoder_model_merged_quantized.onnx',
    'vision_encoder_quantized.onnx',
    'model.onnx'
  ];
  
  for (const filename of onnxFiles) {
    const sourcePath = path.join(COMBINED_DIR, filename);
    const linkPath = path.join(onnxDir, filename);
    
    // Remove existing symlink if it exists
    if (fs.existsSync(linkPath)) {
      fs.unlinkSync(linkPath);
    }
    
    // Create new symlink only if source file exists
    if (fs.existsSync(sourcePath)) {
      const relativePath = path.relative(onnxDir, sourcePath);
      fs.symlinkSync(relativePath, linkPath);
      console.log(`✅ Created symlink: ${filename}`);
    } else {
      console.log(`⚠️ Source file not found for symlink: ${filename}`);
    }
  }
}

async function verifyDownload() {
  console.log(`\n🔍 Verifying downloaded files...`);
  
  let validFiles = 0;
  
  for (const file of FILES_TO_DOWNLOAD) {
    const filePath = path.join(COMBINED_DIR, file.name);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > 0) {
        const sizeStr = stats.size > 1024 * 1024 
          ? `${(stats.size / 1024 / 1024).toFixed(2)} MB`
          : `${(stats.size / 1024).toFixed(2)} KB`;
        console.log(`✅ ${file.name}: ${sizeStr}`);
        validFiles++;
      } else {
        console.log(`❌ ${file.name}: Empty file`);
      }
    } else {
      console.log(`❌ ${file.name}: Missing`);
    }
  }
  
  return validFiles;
}

async function testCurlAvailability() {
  try {
    await execAsync('curl --version');
    return true;
  } catch (error) {
    console.log(`❌ curl is not available. Please install curl first.`);
    return false;
  }
}

async function main() {
  try {
    console.log(`🔧 PaliGemma2 Model Downloader`);
    console.log(`================================`);
    
    // Check if curl is available
    const hasCurl = await testCurlAvailability();
    if (!hasCurl) {
      process.exit(1);
    }
    
    const success = await downloadAllFiles();
    
    const validFiles = await verifyDownload();
    
    if (validFiles >= 6) {
      console.log(`\n🎉 PaliGemma2 model setup complete!`);
      console.log(`✅ Downloaded ${validFiles} valid files`);
      console.log(`📁 Model files are in: ${COMBINED_DIR}`);
      console.log(`🔗 Symlinks created in: ${path.join(__dirname, 'models', 'paligemma2_onnx')}`);
      console.log(`\nYou can now run your OCR application with PaliGemma2 support.`);
    } else {
      console.log(`\n⚠️ Download incomplete. Only ${validFiles} files are valid.`);
      console.log(`You may want to try downloading individual files manually.`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Fatal error:`, error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { downloadAllFiles, verifyDownload };

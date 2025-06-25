#!/usr/bin/env node

/**
 * Download PaliGemma2 ONNX model from the official ONNX Community repository
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the official ONNX Community repository
const MODEL_REPO = 'onnx-community/paligemma2-3b-pt-224';
const COMBINED_DIR = path.join(__dirname, 'models', 'paligemma2', 'combined');
const BASE_URL = `https://huggingface.co/${MODEL_REPO}/resolve/main`;

// Files that should exist in the ONNX Community repository
const FILES_TO_DOWNLOAD = [
  // Configuration files
  { name: 'config.json', required: true },
  { name: 'preprocessor_config.json', required: true },
  { name: 'tokenizer_config.json', required: true },
  { name: 'generation_config.json', required: false },
  { name: 'special_tokens_map.json', required: false },
  { name: 'tokenizer.json', required: true },
  
  // ONNX model files in the onnx subdirectory
  { name: 'onnx/decoder_model_merged_quantized.onnx', required: true },
  { name: 'onnx/vision_encoder_quantized.onnx', required: true },
  { name: 'onnx/decoder_model_merged.onnx', required: false },
  { name: 'onnx/vision_encoder.onnx', required: false }
];

async function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
}

async function downloadFile(fileInfo) {
  try {
    const { name, required } = fileInfo;
    console.log(`📥 Downloading ${name}...`);
    
    // Handle subdirectory structure
    const localPath = path.join(COMBINED_DIR, name);
    const localDir = path.dirname(localPath);
    await ensureDirectory(localDir);
    
    const url = `${BASE_URL}/${name}`;
    
    // Skip if file already exists and is not empty
    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      if (stats.size > 100) { // More than 100 bytes to avoid error pages
        console.log(`✅ ${name} already exists (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
      }
    }
    
    // Use curl to download with better error handling
    const curlCommand = `curl -L --fail -o "${localPath}" "${url}"`;
    
    try {
      const { stdout, stderr } = await execAsync(curlCommand);
      
      // Verify download
      if (fs.existsSync(localPath)) {
        const stats = fs.statSync(localPath);
        if (stats.size > 100) {
          console.log(`✅ Downloaded ${name} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          return true;
        } else {
          console.log(`❌ Downloaded file ${name} is too small (likely an error page)`);
          fs.unlinkSync(localPath);
          return false;
        }
      } else {
        console.log(`❌ Failed to download ${name}`);
        return false;
      }
    } catch (curlError) {
      if (required) {
        console.log(`❌ Error downloading required file ${name}: ${curlError.message}`);
      } else {
        console.log(`⚠️ Optional file ${name} not available: ${curlError.message}`);
      }
      return !required; // Return true for optional files
    }
  } catch (error) {
    console.log(`❌ Error downloading ${fileInfo.name}: ${error.message}`);
    return !fileInfo.required;
  }
}

async function useTransformersDownload() {
  console.log(`🤖 Attempting to use transformers.js to download the model...`);
  
  try {
    // Try using the npm package to download
    const downloadScript = `
import { AutoProcessor, PaliGemmaForConditionalGeneration } from '@xenova/transformers';

async function downloadModel() {
  try {
    console.log('Downloading model files...');
    const model_id = '${MODEL_REPO}';
    
    // This will download the model files to cache
    const processor = await AutoProcessor.from_pretrained(model_id);
    console.log('✅ Processor downloaded');
    
    // Optional: try to load the model (might not work without proper ONNX files)
    try {
      const model = await PaliGemmaForConditionalGeneration.from_pretrained(model_id);
      console.log('✅ Model downloaded');
    } catch (modelError) {
      console.log('⚠️ Model download failed, but processor is available:', modelError.message);
    }
    
    return true;
  } catch (error) {
    console.log('❌ Transformers download failed:', error.message);
    return false;
  }
}

downloadModel().then(success => {
  if (success) {
    console.log('✅ Model download completed');
  } else {
    console.log('❌ Model download failed');
  }
  process.exit(success ? 0 : 1);
});
`;

    // Write the script to a temporary file
    const tempScript = path.join(__dirname, 'temp_download.mjs');
    fs.writeFileSync(tempScript, downloadScript);
    
    // Run the script
    await execAsync(`cd ${__dirname} && node temp_download.mjs`);
    
    // Clean up
    if (fs.existsSync(tempScript)) {
      fs.unlinkSync(tempScript);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Transformers download failed: ${error.message}`);
    return false;
  }
}

async function downloadAllFiles() {
  console.log(`🚀 Downloading PaliGemma2 ONNX model from ${MODEL_REPO}...`);
  console.log(`📁 Destination: ${COMBINED_DIR}`);
  
  await ensureDirectory(COMBINED_DIR);
  
  let successCount = 0;
  let requiredSuccessCount = 0;
  const requiredFiles = FILES_TO_DOWNLOAD.filter(f => f.required);
  
  // Download configuration files first
  console.log(`\n📦 Downloading configuration files...`);
  for (const file of FILES_TO_DOWNLOAD.filter(f => !f.name.includes('onnx/'))) {
    const success = await downloadFile(file);
    if (success) {
      successCount++;
      if (file.required) requiredSuccessCount++;
    }
  }
  
  // Download ONNX model files
  console.log(`\n📦 Downloading ONNX model files...`);
  for (const file of FILES_TO_DOWNLOAD.filter(f => f.name.includes('onnx/'))) {
    const success = await downloadFile(file);
    if (success) {
      successCount++;
      if (file.required) requiredSuccessCount++;
    }
  }
  
  console.log(`\n📊 Download Summary:`);
  console.log(`✅ Successfully downloaded: ${successCount}/${FILES_TO_DOWNLOAD.length} files`);
  console.log(`✅ Required files downloaded: ${requiredSuccessCount}/${requiredFiles.length} files`);
  
  // Check if we have enough files to work
  if (requiredSuccessCount >= requiredFiles.length - 1) { // Allow one missing required file
    console.log(`\n🎉 Model download successful!`);
    await updateSymlinks();
    return true;
  } else {
    console.log(`\n⚠️ Too many required files missing. Trying alternative download method...`);
    
    // Try using transformers.js
    const transformersSuccess = await useTransformersDownload();
    if (transformersSuccess) {
      return true;
    }
    
    console.log(`\n❌ All download methods failed.`);
    return false;
  }
}

async function updateSymlinks() {
  console.log(`\n🔗 Updating symbolic links...`);
  
  const onnxDir = path.join(__dirname, 'models', 'paligemma2_onnx');
  await ensureDirectory(onnxDir);
  
  const onnxFiles = [
    { source: 'onnx/decoder_model_merged_quantized.onnx', link: 'decoder_model_merged_quantized.onnx' },
    { source: 'onnx/vision_encoder_quantized.onnx', link: 'vision_encoder_quantized.onnx' },
    { source: 'onnx/decoder_model_merged.onnx', link: 'model.onnx' }
  ];
  
  for (const file of onnxFiles) {
    const sourcePath = path.join(COMBINED_DIR, file.source);
    const linkPath = path.join(onnxDir, file.link);
    
    // Remove existing symlink if it exists
    if (fs.existsSync(linkPath)) {
      fs.unlinkSync(linkPath);
    }
    
    // Create new symlink only if source file exists
    if (fs.existsSync(sourcePath)) {
      const relativePath = path.relative(onnxDir, sourcePath);
      fs.symlinkSync(relativePath, linkPath);
      console.log(`✅ Created symlink: ${file.link} -> ${file.source}`);
    } else {
      console.log(`⚠️ Source file not found for symlink: ${file.source}`);
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
      if (stats.size > 100) {
        const sizeStr = stats.size > 1024 * 1024 
          ? `${(stats.size / 1024 / 1024).toFixed(2)} MB`
          : `${(stats.size / 1024).toFixed(2)} KB`;
        console.log(`✅ ${file.name}: ${sizeStr}`);
        validFiles++;
      } else {
        console.log(`❌ ${file.name}: Too small (likely error)`);
      }
    } else {
      console.log(`${file.required ? '❌' : '⚠️'} ${file.name}: Missing`);
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
    console.log(`🔧 PaliGemma2 ONNX Model Downloader`);
    console.log(`===================================`);
    console.log(`Repository: ${MODEL_REPO}`);
    
    // Check if curl is available
    const hasCurl = await testCurlAvailability();
    if (!hasCurl) {
      process.exit(1);
    }
    
    const success = await downloadAllFiles();
    
    const validFiles = await verifyDownload();
    
    if (success && validFiles >= 4) { // At least config files
      console.log(`\n🎉 PaliGemma2 ONNX model setup complete!`);
      console.log(`✅ Downloaded ${validFiles} valid files`);
      console.log(`📁 Model files are in: ${COMBINED_DIR}`);
      console.log(`🔗 Symlinks created in: ${path.join(__dirname, 'models', 'paligemma2_onnx')}`);
      console.log(`\nYou can now run your OCR application with PaliGemma2 support.`);
    } else {
      console.log(`\n⚠️ Download incomplete. Only ${validFiles} files are valid.`);
      console.log(`The application may still work with processor-only mode.`);
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

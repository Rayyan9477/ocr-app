#!/usr/bin/env node

/**
 * Proper PaliGemma2 Model Downloader
 * Downloads the actual ONNX model files from HuggingFace
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadFile } from '@huggingface/hub';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Model configuration
const MODEL_REPO = 'NSTiwari/paligemma2-3b-mix-224-onnx';
const COMBINED_DIR = path.join(__dirname, 'models', 'paligemma2', 'combined');

// Files to download
const FILES_TO_DOWNLOAD = [
  'config.json',
  'preprocessor_config.json',
  'tokenizer_config.json',
  'generation_config.json',
  'special_tokens_map.json',
  'tokenizer.json',
  'decoder_model_merged_quantized.onnx',
  'vision_encoder_quantized.onnx',
  'model.onnx'
];

async function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

async function downloadModelFile(filename) {
  try {
    console.log(`📥 Downloading ${filename}...`);
    
    const localPath = path.join(COMBINED_DIR, filename);
    
    // Skip if file already exists and is not empty
    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      if (stats.size > 0) {
        console.log(`✅ ${filename} already exists (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
      }
    }
    
    // Download the file
    await downloadFile({
      repo: MODEL_REPO,
      filename: filename,
      cache_dir: path.dirname(COMBINED_DIR),
      local_dir: COMBINED_DIR
    });
    
    // Verify download
    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      console.log(`✅ Downloaded ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      return true;
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
  
  await ensureDirectory(COMBINED_DIR);
  
  let successCount = 0;
  let totalCount = FILES_TO_DOWNLOAD.length;
  
  for (const filename of FILES_TO_DOWNLOAD) {
    const success = await downloadModelFile(filename);
    if (success) {
      successCount++;
    }
  }
  
  console.log(`\n📊 Download Summary:`);
  console.log(`✅ Successfully downloaded: ${successCount}/${totalCount} files`);
  
  if (successCount === totalCount) {
    console.log(`\n🎉 All model files downloaded successfully!`);
    console.log(`📁 Model location: ${COMBINED_DIR}`);
    
    // Update symlinks
    await updateSymlinks();
    
    return true;
  } else {
    console.log(`\n⚠️ Some files failed to download. Please check your internet connection and try again.`);
    return false;
  }
}

async function updateSymlinks() {
  console.log(`🔗 Updating symbolic links...`);
  
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
    }
  }
}

async function verifyDownload() {
  console.log(`\n🔍 Verifying downloaded files...`);
  
  for (const filename of FILES_TO_DOWNLOAD) {
    const filePath = path.join(COMBINED_DIR, filename);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeStr = stats.size > 1024 * 1024 
        ? `${(stats.size / 1024 / 1024).toFixed(2)} MB`
        : `${(stats.size / 1024).toFixed(2)} KB`;
      console.log(`✅ ${filename}: ${sizeStr}`);
    } else {
      console.log(`❌ ${filename}: Missing`);
    }
  }
}

async function main() {
  try {
    const success = await downloadAllFiles();
    
    if (success) {
      await verifyDownload();
      console.log(`\n🎉 PaliGemma2 model setup complete!`);
      console.log(`You can now run your OCR application with PaliGemma2 support.`);
    } else {
      console.log(`\n❌ Download failed. Please try again.`);
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

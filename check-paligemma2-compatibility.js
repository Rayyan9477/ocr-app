#!/usr/bin/env node
/**
 * PaliGemma2 Compatibility Status Reporter
 * 
 * This script checks the status of transformers.js library
 * and PaliGemma2 model installation.
 */

import { env, AutoProcessor } from "@huggingface/transformers";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createResponse } from './lib/vlm/error-handling.js';

// Configure environment
env.allowLocalModels = true;
env.useBrowserCache = false;

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Model directories
const modelDir = path.join(__dirname, 'models', 'paligemma2', 'google');
const onnxModelDir = path.join(__dirname, 'models', 'paligemma2', 'onnx-community');

async function checkTransformersStatus() {
  const status = {
    transformersVersion: "unknown",
    modelStatus: {
      googleModel: false,
      onnxModel: false
    },
    processorStatus: null,
    modelType: "unknown"
  };

  // Get transformers.js version
  const pkgPath = path.join(__dirname, 'node_modules', '@huggingface', 'transformers', 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    status.transformersVersion = pkg.version;
  }
  
  // Check model directories
  status.modelStatus.googleModel = fs.existsSync(modelDir);
  status.modelStatus.onnxModel = fs.existsSync(onnxModelDir);
  
  // Load processor
  const processorPath = status.modelStatus.onnxModel ? onnxModelDir : modelDir;
  if (fs.existsSync(processorPath)) {
    const processor = await AutoProcessor.from_pretrained(processorPath);
    status.processorStatus = processor ? "loaded" : "failed";
    status.modelType = status.modelStatus.onnxModel ? "onnx" : "google";
  }

  return createResponse(
    status.processorStatus === "loaded" ? 'SUCCESS' : 'MODEL_UNAVAILABLE',
    status
  );
}

// Main execution
const result = await checkTransformersStatus();
console.log(JSON.stringify(result, null, 2));
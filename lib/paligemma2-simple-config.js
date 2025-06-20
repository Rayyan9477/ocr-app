/**
 * Configuration for PaliGemma2 model
 * Updated to use ONNX Community models with local fallbacks
 */

import path from 'path';

const MODEL_ROOT = process.cwd();
const PRIMARY_MODEL_DIR = path.join(MODEL_ROOT, 'models', 'paligemma2', 'google');
// Update ONNX_MODEL_DIR to point directly to the google directory since the onnx-community subfolder doesn't exist
const ONNX_MODEL_DIR = PRIMARY_MODEL_DIR;

export const MODEL_CONFIG = {
  // Use local model paths - ONNX Community version has better transformers.js support
  MODEL_ID: ONNX_MODEL_DIR,
  FALLBACK_MODEL_IDS: [
    PRIMARY_MODEL_DIR,
    "google/paligemma2-3b-pt-224",
    "google/paligemma2-3b-pt-448",
    "onnx-community/paligemma2-3b-pt-224"
  ],
  
  // Local paths for model files
  PRIMARY_MODEL_DIR,
  MODEL_DIR: ONNX_MODEL_DIR,
  ONNX_MODEL_DIR,
  PROCESSOR_CONFIG: path.join(PRIMARY_MODEL_DIR, 'preprocessor_config.json'),
  MODEL_CONFIG_PATH: path.join(PRIMARY_MODEL_DIR, 'config.json'),
  WEIGHTS_PATH: path.join(PRIMARY_MODEL_DIR, 'model.safetensors'),
  
  // Model validation and discovery with additional paths
  MODEL_SEARCH_PATHS: [
    PRIMARY_MODEL_DIR,
    ONNX_MODEL_DIR,
    path.join(process.cwd(), 'models', 'paligemma2_onnx'),
    path.join(process.cwd(), 'node_modules', '@huggingface/transformers/models'),
    path.join(process.cwd(), 'models')
  ],
  
  // Model file paths with validation
  MODEL_FILES: {
    model1: "model-00001-of-00002.safetensors",
    model2: "model-00002-of-00002.safetensors",
    index: "model.safetensors.index.json",
    tokenizer: "tokenizer.json",
    config: "config.json",
    generation: "generation_config.json",
    preprocessor: "preprocessor_config.json",
    special_tokens: "special_tokens_map.json",
    tokenizer_config: "tokenizer_config.json"
  },
  
  // Required model files for validation
  REQUIRED_FILES: [
    "model-00001-of-00002.safetensors",
    "model-00002-of-00002.safetensors",
    "model.safetensors.index.json",
    "tokenizer.json",
    "config.json"
  ],
  
  // Loading options with multi-engine optimizations
  LOADING_OPTIONS: {
    quantized: true,
    useLocalFiles: true,
    loadInMemory: true, // Set to true for better performance
    enablePipeline: true,
    validateModel: true,
    fallbackEnabled: true,
    maxRetries: 3,
    timeoutMs: 60000, // Increased timeout
    parallelLoading: true,
    cacheResults: true
  },
  
  // Multi-engine coordination
  MULTI_ENGINE_CONFIG: {
    enableParallelProcessing: true,
    maxParallelEngines: 3,
    enginePriorities: {
      ocrmypdf: 1,
      tesseract: 2,
      "enhanced-tesseract": 3
    },
    confidenceThresholds: {
      ocrmypdf: 0.8,
      tesseract: 0.75,
      "enhanced-tesseract": 0.7
    }
  },
  
  // Enhanced accuracy settings with post-processing
  ACCURACY_SETTINGS: {
    enablePreprocessing: true,
    enhanceContrast: true,
    denoiseImage: true,
    normalizeOrientation: true,
    optimizeResolution: true,
    confidenceThreshold: 0.8,
    useEnsemble: true,
    postProcessingSteps: [
      "spell_check",
      "layout_analysis",
      "consensus_voting"
    ]
  }
};

export default MODEL_CONFIG;

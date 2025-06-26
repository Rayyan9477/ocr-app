/**
 * Enhanced OCR Configuration Service
 * Manages environment variables and configuration for enhanced preprocessing pipeline
 */

import * as fs from 'fs';
import * as path from 'path';
import { EnhancedPreprocessingOptions } from './enhanced-preprocessing-types';

/**
 * Enhanced OCR configuration interface
 */
export interface EnhancedOCRConfig {
  // Enhanced preprocessing defaults
  preprocessing: {
    enableCLAHE: boolean;
    claheClipLimit: number;
    claheTileSize: number;
    enableEdgeEnhancement: boolean;
    edgeStrength: number;
    enableDeskew: boolean;
    enablePerspectiveCorrection: boolean;
    enableNormalization: boolean;
    optimizeHighlightedText: boolean;
    autoDetectDocumentType: boolean;
  };
  
  // Performance settings
  performance: {
    maxConcurrentProcesses: number;
    processingTimeout: number;
    enableCaching: boolean;
    cacheDirectory: string;
  };
  
  // Quality settings
  quality: {
    confidenceThreshold: number;
    enableQualityAssessment: boolean;
    autoRetryOnLowConfidence: boolean;
    maxRetryAttempts: number;
  };
  
  // Logging and debugging
  debug: {
    enableVerboseLogging: boolean;
    saveIntermediateFiles: boolean;
    logDirectory: string;
  };
}

/**
 * Get enhanced OCR configuration from environment variables
 */
export function getEnhancedOCRConfig(): EnhancedOCRConfig {
  return {
    preprocessing: {
      enableCLAHE: getEnvBool('OCR_ENABLE_CLAHE', true),
      claheClipLimit: getEnvNumber('OCR_CLAHE_CLIP_LIMIT', 2.5),
      claheTileSize: getEnvNumber('OCR_CLAHE_TILE_SIZE', 8),
      enableEdgeEnhancement: getEnvBool('OCR_ENABLE_EDGE_ENHANCEMENT', true),
      edgeStrength: getEnvNumber('OCR_EDGE_STRENGTH', 1.2),
      enableDeskew: getEnvBool('OCR_ENABLE_DESKEW', true),
      enablePerspectiveCorrection: getEnvBool('OCR_ENABLE_PERSPECTIVE_CORRECTION', false),
      enableNormalization: getEnvBool('OCR_ENABLE_NORMALIZATION', true),
      optimizeHighlightedText: getEnvBool('OCR_OPTIMIZE_HIGHLIGHTED_TEXT', true),
      autoDetectDocumentType: getEnvBool('OCR_AUTO_DETECT_DOCUMENT_TYPE', true)
    },
    
    performance: {
      maxConcurrentProcesses: getEnvNumber('OCR_MAX_CONCURRENT_PROCESSES', 3),
      processingTimeout: getEnvNumber('OCR_PROCESSING_TIMEOUT', 300000), // 5 minutes
      enableCaching: getEnvBool('OCR_ENABLE_CACHING', false),
      cacheDirectory: getEnvString('OCR_CACHE_DIRECTORY', './cache/ocr')
    },
    
    quality: {
      confidenceThreshold: getEnvNumber('OCR_CONFIDENCE_THRESHOLD', 70),
      enableQualityAssessment: getEnvBool('OCR_ENABLE_QUALITY_ASSESSMENT', true),
      autoRetryOnLowConfidence: getEnvBool('OCR_AUTO_RETRY_LOW_CONFIDENCE', false),
      maxRetryAttempts: getEnvNumber('OCR_MAX_RETRY_ATTEMPTS', 2)
    },
    
    debug: {
      enableVerboseLogging: getEnvBool('OCR_VERBOSE_LOGGING', false),
      saveIntermediateFiles: getEnvBool('OCR_SAVE_INTERMEDIATE_FILES', false),
      logDirectory: getEnvString('OCR_LOG_DIRECTORY', './logs/ocr')
    }
  };
}

/**
 * Get enhanced preprocessing configuration from environment
 */
export function getEnhancedPreprocessingConfig(): EnhancedPreprocessingOptions {
  const config = getEnhancedOCRConfig();
  
  return {
    applyCLAHE: config.preprocessing.enableCLAHE,
    claheClipLimit: config.preprocessing.claheClipLimit,
    claheTileSize: config.preprocessing.claheTileSize,
    enhanceEdges: config.preprocessing.enableEdgeEnhancement,
    edgeStrength: config.preprocessing.edgeStrength,
    deskew: config.preprocessing.enableDeskew,
    perspectiveCorrection: config.preprocessing.enablePerspectiveCorrection,
    normalize: config.preprocessing.enableNormalization,
    optimizeHighlightedText: config.preprocessing.optimizeHighlightedText,
    autoDetectDocumentType: config.preprocessing.autoDetectDocumentType
  };
}

/**
 * Create default environment configuration file
 */
export function createDefaultEnvConfig(envPath: string = '.env.enhanced-ocr'): void {
  const defaultConfig = `# Enhanced OCR Configuration
# Advanced preprocessing pipeline settings

# ====================================================
# PREPROCESSING SETTINGS
# ====================================================

# CLAHE (Contrast Limited Adaptive Histogram Equalization)
OCR_ENABLE_CLAHE=true
OCR_CLAHE_CLIP_LIMIT=2.5
OCR_CLAHE_TILE_SIZE=8

# Edge Enhancement
OCR_ENABLE_EDGE_ENHANCEMENT=true
OCR_EDGE_STRENGTH=1.2

# Document Correction
OCR_ENABLE_DESKEW=true
OCR_ENABLE_PERSPECTIVE_CORRECTION=false
OCR_ENABLE_NORMALIZATION=true

# Highlighted Text Optimization
OCR_OPTIMIZE_HIGHLIGHTED_TEXT=true

# Auto-detection
OCR_AUTO_DETECT_DOCUMENT_TYPE=true

# ====================================================
# PERFORMANCE SETTINGS
# ====================================================

# Concurrent processing
OCR_MAX_CONCURRENT_PROCESSES=3
OCR_PROCESSING_TIMEOUT=300000

# Caching
OCR_ENABLE_CACHING=false
OCR_CACHE_DIRECTORY=./cache/ocr

# ====================================================
# QUALITY SETTINGS
# ====================================================

# Confidence and retry settings
OCR_CONFIDENCE_THRESHOLD=70
OCR_ENABLE_QUALITY_ASSESSMENT=true
OCR_AUTO_RETRY_LOW_CONFIDENCE=false
OCR_MAX_RETRY_ATTEMPTS=2

# ====================================================
# DEBUG AND LOGGING
# ====================================================

# Debugging options
OCR_VERBOSE_LOGGING=false
OCR_SAVE_INTERMEDIATE_FILES=false
OCR_LOG_DIRECTORY=./logs/ocr

# ====================================================
# FEATURE FLAGS
# ====================================================

# Enable experimental features
OCR_ENABLE_EXPERIMENTAL_FEATURES=false
OCR_USE_GPU_ACCELERATION=false
OCR_ENABLE_BATCH_PROCESSING=false
`;

  fs.writeFileSync(envPath, defaultConfig);
  console.log(`✅ Default enhanced OCR configuration created: ${envPath}`);
}

/**
 * Validate configuration and create directories if needed
 */
export function validateAndSetupConfig(config: EnhancedOCRConfig): void {
  // Create necessary directories
  const directories = [
    config.performance.cacheDirectory,
    config.debug.logDirectory
  ];
  
  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  // Validate numeric ranges
  if (config.preprocessing.claheClipLimit < 1.0 || config.preprocessing.claheClipLimit > 4.0) {
    console.warn(`⚠️  CLAHE clip limit ${config.preprocessing.claheClipLimit} is outside recommended range (1.0-4.0)`);
  }
  
  if (config.preprocessing.edgeStrength < 0.5 || config.preprocessing.edgeStrength > 3.0) {
    console.warn(`⚠️  Edge strength ${config.preprocessing.edgeStrength} is outside recommended range (0.5-3.0)`);
  }
  
  if (config.quality.confidenceThreshold < 0 || config.quality.confidenceThreshold > 100) {
    console.warn(`⚠️  Confidence threshold ${config.quality.confidenceThreshold} should be between 0-100`);
  }
}

/**
 * Get environment boolean value
 */
function getEnvBool(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val.toLowerCase() === 'true';
}

/**
 * Get environment number value
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const num = parseFloat(val);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Get environment string value
 */
function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Export singleton configuration instance
 */
export const enhancedOCRConfig = getEnhancedOCRConfig();

/**
 * Export configuration validation
 */
export function initializeEnhancedOCR(): void {
  const config = getEnhancedOCRConfig();
  validateAndSetupConfig(config);
  
  console.log('🚀 Enhanced OCR pipeline initialized with configuration:');
  console.log(`   - CLAHE: ${config.preprocessing.enableCLAHE ? '✅' : '❌'}`);
  console.log(`   - Edge Enhancement: ${config.preprocessing.enableEdgeEnhancement ? '✅' : '❌'}`);
  console.log(`   - Deskew: ${config.preprocessing.enableDeskew ? '✅' : '❌'}`);
  console.log(`   - Highlight Optimization: ${config.preprocessing.optimizeHighlightedText ? '✅' : '❌'}`);
  console.log(`   - Confidence Threshold: ${config.quality.confidenceThreshold}%`);
}

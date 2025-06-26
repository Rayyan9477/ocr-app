// Configuration utility to manage environment variables with defaults and validation

interface AppConfig {
  // Server
  port: number;
  nodeEnv: string;
  debug: boolean;
  
  // File limits
  maxUploadSize: number; // in MB
  nodeMemory: number; // in MB
  
  // OCR configuration
  defaultLanguage: string;
  enableOptimization: boolean;
  ocrTimeout: number; // in ms
  jbig2Path: string;
  
  // Storage paths
  uploadsDir: string;
  processedDir: string;
  tempDir: string;
  
  // Cleanup configuration
  cleanupInterval: number; // in ms
  maxStorageAge: number; // in ms
  
  // Medical OCR configuration
  enableMedicalEnhancements: boolean;
  medicalConfig: {
    removeDiacritics: boolean;
    handleEmptyPages: boolean;
    enhanceHandwriting: boolean;
    retryFailedFiles: boolean;
    usePdfOutput: boolean; // Use PDF instead of PDF/A
  };
  
  // Confidence detection configuration
  confidence: {
    pageWarningThreshold: number;
    pageErrorThreshold: number;
    enableConfidenceTracking: boolean;
  };
  
  // OCR Engine Paths
  pythonPath: string;
  pythonModulePath: string;
  
  // Model paths
  modelPaths: {
    tesseract: string;
  };
}

// Helper function to get a boolean env var
function getBoolEnv(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  // Handle various true/false string formats
  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
}

// Helper function to get a number env var
function getNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Helper function to get a string env var
function getStringEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// Create the centralized config
export const config: AppConfig = {
  // Server configuration
  port: getNumberEnv('PORT', 3000),
  nodeEnv: getStringEnv('NODE_ENV', 'production'),
  debug: getBoolEnv('DEBUG', false),
  
  // File limits
  maxUploadSize: getNumberEnv('MAX_UPLOAD_SIZE', 100),
  nodeMemory: getNumberEnv('NODE_MEMORY', 4096),
  
  // OCR configuration
  defaultLanguage: getStringEnv('DEFAULT_LANGUAGE', 'eng'),
  enableOptimization: getBoolEnv('ENABLE_OPTIMIZATION', true),
  ocrTimeout: getNumberEnv('OCR_TIMEOUT', 600000), // 10 minutes default
  jbig2Path: getStringEnv('JBIG2_PATH', '/usr/bin/jbig2'),
  
  // Storage paths
  uploadsDir: getStringEnv('UPLOADS_DIR', './uploads'),
  processedDir: getStringEnv('PROCESSED_DIR', './processed'),
  tempDir: getStringEnv('TEMP_DIR', './tmp'),
  
  // Cleanup configuration
  cleanupInterval: getNumberEnv('CLEANUP_INTERVAL', 3600000), // Default: 1 hour
  maxStorageAge: getNumberEnv('MAX_STORAGE_AGE', 259200000), // Default: 3 days
  
  // Medical OCR configuration
  enableMedicalEnhancements: getBoolEnv('ENABLE_MEDICAL_ENHANCEMENTS', true),
  medicalConfig: {
    removeDiacritics: getBoolEnv('MEDICAL_REMOVE_DIACRITICS', true),
    handleEmptyPages: getBoolEnv('MEDICAL_HANDLE_EMPTY_PAGES', true),
    enhanceHandwriting: getBoolEnv('MEDICAL_ENHANCE_HANDWRITING', true),
    retryFailedFiles: getBoolEnv('MEDICAL_RETRY_FAILED', true),
    usePdfOutput: getBoolEnv('MEDICAL_USE_PDF', true), // Default to PDF instead of PDF/A for medical docs
  },
  
  // Confidence detection configuration
  confidence: {
    pageWarningThreshold: getNumberEnv('CONFIDENCE_PAGE_WARNING_THRESHOLD', 85),
    pageErrorThreshold: getNumberEnv('CONFIDENCE_PAGE_ERROR_THRESHOLD', 70),
    enableConfidenceTracking: getBoolEnv('ENABLE_CONFIDENCE_TRACKING', true),
  },
  
  // OCR Engine Paths
  pythonPath: '/usr/bin/python3',
  pythonModulePath: '/usr/src/app/python',
  
  // Model paths
  modelPaths: {
    tesseract: '/usr/share/tesseract-ocr/4.00/tessdata',
  },
};

/**
 * Enhanced preprocessing configuration from environment variables
 */
export function getEnhancedPreprocessingConfig(): any {
  return {
    applyCLAHE: getEnvBool('OCR_ENABLE_CLAHE', true),
    claheClipLimit: getEnvNumber('OCR_CLAHE_CLIP_LIMIT', 2.5),
    enhanceEdges: getEnvBool('OCR_ENABLE_EDGE_ENHANCEMENT', true),
    edgeStrength: getEnvNumber('OCR_EDGE_STRENGTH', 1.2),
    deskew: getEnvBool('OCR_ENABLE_DESKEW', true),
    perspectiveCorrection: getEnvBool('OCR_ENABLE_PERSPECTIVE_CORRECTION', false),
    optimizeHighlightedText: getEnvBool('OCR_OPTIMIZE_HIGHLIGHTED_TEXT', true),
    normalize: getEnvBool('OCR_ENABLE_NORMALIZATION', true)
  };
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

// Validate critical configuration
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Basic validation checks
  if (config.port <= 0 || config.port > 65535) {
    errors.push(`Invalid port: ${config.port}`);
  }
  
  if (config.maxUploadSize <= 0) {
    errors.push(`Invalid MAX_UPLOAD_SIZE: ${config.maxUploadSize}`);
  }
  
  if (config.ocrTimeout <= 0) {
    errors.push(`Invalid OCR_TIMEOUT: ${config.ocrTimeout}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export default config;

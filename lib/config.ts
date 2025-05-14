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
};

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

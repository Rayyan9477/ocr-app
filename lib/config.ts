// Configuration utility to manage environment variables with defaults and validation
import { existsSync } from 'fs';

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

// Function to find jbig2 binary in order of preference
function findJbig2Path(): string {
  // Check environment variable first
  if (process.env.JBIG2_PATH && existsSync(process.env.JBIG2_PATH)) {
    return process.env.JBIG2_PATH;
  }
  
  // Check for local build in workspace
  const localBuild = './jbig2enc/src/jbig2';
  if (existsSync(localBuild)) {
    return localBuild;
  }
  
  // Check standard locations
  const stdPaths = ['/usr/local/bin/jbig2', '/usr/bin/jbig2'];
  for (const path of stdPaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  // Default to local build path even if it doesn't exist yet
  return './jbig2enc/src/jbig2';
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
  jbig2Path: getStringEnv('JBIG2_PATH', findJbig2Path()),
  
  // Storage paths
  uploadsDir: getStringEnv('UPLOADS_DIR', './uploads'),
  processedDir: getStringEnv('PROCESSED_DIR', './processed'),
};

// Validate critical configuration
export function validateConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Critical validation checks
  if (config.port <= 0 || config.port > 65535) {
    errors.push(`Invalid port: ${config.port}`);
  }
  
  if (config.maxUploadSize <= 0) {
    errors.push(`Invalid MAX_UPLOAD_SIZE: ${config.maxUploadSize}`);
  } else if (config.maxUploadSize > 200) {
    warnings.push(`MAX_UPLOAD_SIZE (${config.maxUploadSize}MB) is very large and may cause memory issues.`);
  }
  
  if (config.ocrTimeout <= 0) {
    errors.push(`Invalid OCR_TIMEOUT: ${config.ocrTimeout}`);
  } else if (config.ocrTimeout < 60000) {
    warnings.push(`OCR_TIMEOUT is set to ${config.ocrTimeout}ms (${config.ocrTimeout/1000}s), which may be too short for processing large documents.`);
  }
  
  // Check if nodeMemory is sufficient for maxUploadSize
  const recommendedMinMemory = config.maxUploadSize * 20; // Rough estimate: 20x file size for processing
  if (config.nodeMemory < recommendedMinMemory) {
    warnings.push(`NODE_MEMORY (${config.nodeMemory}MB) may be too low for processing files up to ${config.maxUploadSize}MB. Consider increasing to at least ${recommendedMinMemory}MB.`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export default config;

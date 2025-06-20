/**
 * Custom Tesseract worker loader
 * 
 * This script helps load Tesseract.js worker properly in Next.js environment
 */

import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';

// Simple logger implementation
const logger = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
    error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
    debug: (msg) => console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`)
};

// Determine the best path for worker files
function getWorkerPath() {
  const possiblePaths = [
    // Standard node_modules location
    path.join(process.cwd(), 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
    // Next.js build directory
    path.join(process.cwd(), '.next', 'server', 'chunks', 'tesseract.js-worker.js'),
    // Next.js worker script directory (fallback)
    path.join(process.cwd(), '.next', 'worker-script', 'node', 'index.js'),
    // Custom worker location
    path.join(process.cwd(), 'public', 'tesseract-worker', 'worker.min.js')
  ];
  
  for (const workerPath of possiblePaths) {
    if (fs.existsSync(workerPath)) {
      return workerPath;
    }
  }
  
  // If no local worker found, return null to use remote CDN
  return null;
}

// Determine the best path for language data
function getLangPath() {
  const possiblePaths = [
    // Custom tessdata directory
    path.join(process.cwd(), 'tessdata'),
    // Standard location
    path.join(process.cwd(), 'node_modules', 'tesseract.js-core', 'tessdata'),
    // Custom location
    path.join(process.cwd(), 'public', 'tessdata')
  ];
  
  for (const langPath of possiblePaths) {
    if (fs.existsSync(langPath)) {
      return langPath;
    }
  }
  
  // If no local langPath found, return null to use remote CDN
  return null;
}

/**
 * Creates a Tesseract worker with proper configuration for Next.js
 */
export async function createTesseractWorker(customOptions = {}) {
  try {
    const workerPath = getWorkerPath();
    const langPath = getLangPath();
    
    // Start with minimal options to avoid worker script issues
    const options = {
      // Disable custom logging to prevent cloning issues
      logger: () => {}, // No-op logger
      errorHandler: (e) => console.warn('Tesseract:', e),
      ...customOptions
    };
    
    // Only set paths if they actually exist and are accessible
    if (workerPath && fs.existsSync(workerPath)) {
      try {
        // Test if the worker path is actually readable
        fs.accessSync(workerPath, fs.constants.R_OK);
        options.workerPath = workerPath;
        logger.info(`Using local Tesseract worker: ${workerPath}`);
      } catch (accessError) {
        logger.warn(`Tesseract worker exists but is not readable: ${accessError.message}`);
      }
    } else {
      logger.warn('No local Tesseract worker found, using remote CDN');
    }
    
    if (langPath && fs.existsSync(langPath)) {
      try {
        // Test if the lang path is actually readable
        fs.accessSync(langPath, fs.constants.R_OK);
        options.langPath = langPath;
        logger.info(`Using local language data: ${langPath}`);
      } catch (accessError) {
        logger.warn(`Lang path not accessible: ${langPath}, using CDN`);
      }
    } else {
      logger.warn('No valid local language data found, using remote CDN');
    }
    
    // Create the worker with timeout and better error handling
    const workerPromise = createWorker(options);
    
    // Add a timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Tesseract worker creation timeout')), 60000) // Increase timeout to 60 seconds
    );
    
    const worker = await Promise.race([workerPromise, timeoutPromise]);
    
    // Test the worker by loading a language
    try {
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      logger.info('Tesseract worker initialized and tested successfully');
      return worker;
    } catch (testError) {
      logger.warn('Tesseract worker test failed:', testError.message);
      await worker.terminate().catch(() => {}); // Clean up
      throw testError;
    }
    
  } catch (error) {
    logger.error(`Failed to create Tesseract worker: ${error.message}`);
    // Don't attempt fallback worker creation as it might cause the same issue
    throw new Error(`Tesseract worker unavailable: ${error.message}`);
  }
}

export default createTesseractWorker;

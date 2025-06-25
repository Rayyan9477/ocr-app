/**
 * Directory Initialization Module
 * Creates necessary directories for the OCR application
 */

import fs from 'fs';
import path from 'path';
import logger from './logger';

/**
 * Initialize all required directories for the application
 * @returns {boolean} Success status
 */
export function initializeDirectories() {
  try {
    // Define the directories to create
    const directories = [
      'uploads',
      'processed',
      'output',
      'tmp',
      'models',
      'models/paligemma2',
      'models/paligemma2/google'
    ];
    
    // Create each directory if it doesn't exist
    directories.forEach(dir => {
      const fullPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        logger.info(`Created directory: ${fullPath}`);
      }
    });
    
    return true;
  } catch (error) {
    logger.error(`Failed to initialize directories: ${error.message}`);
    return false;
  }
}

export default { initializeDirectories };

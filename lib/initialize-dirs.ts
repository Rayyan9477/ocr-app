import fs from 'fs';
import path from 'path';
import logger from './logger';

/**
 * Creates necessary directories for application operation
 */
export function initializeDirectories(): void {
  const dirs = [
    'uploads',
    'processed',
    'output',
    'tmp/preprocessing',
    'tmp/enhanced-tesseract',
    'tmp/tfvlm',
    'models/tfjs_model',
    'models/tfjs_model/document_classifier',
    'models/tfjs_model/layout_detector',
    'models/tfjs_model/structured_data',
    'models/tfjs_model/medical_entities'
  ];
  
  for (const dir of dirs) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.info(`Created directory: ${dirPath}`);
      } catch (error) {
        logger.error(`Failed to create directory ${dirPath}: ${error}`);
      }
    }
  }
}

export default initializeDirectories;

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
    'tmp/preprocessing',
    'models/nanovlm'
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

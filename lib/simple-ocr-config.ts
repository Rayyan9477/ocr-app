/**
 * Simple OCR Configuration Loader
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import logger from './logger';

export interface SimpleOCRConfig {
  ocr: {
    defaultLanguage: string;
    supportedLanguages: string[];
    defaultOptions: {
      deskew: boolean;
      enhanceContrast: boolean;
      removeNoise: boolean;
    };
    processing: {
      maxFileSize: string;
      timeout: number;
      imageDensity: number;
    };
  };
  storage: {
    uploadDir: string;
    processedDir: string;
    retentionDays: number;
  };
  performance: {
    workerReuse: boolean;
    maxConcurrentJobs: number;
  };
}

let config: SimpleOCRConfig | null = null;

/**
 * Load configuration from file
 */
export function loadConfig(): SimpleOCRConfig {
  if (config) {
    return config;
  }

  try {
    const configPath = join(process.cwd(), 'config', 'simple-ocr-config.json');
    const configFile = readFileSync(configPath, 'utf-8');
    config = JSON.parse(configFile);
    logger.info('Loaded Simple OCR configuration');
    return config!;
  } catch (error) {
    logger.warn('Failed to load config, using defaults:', error);

    // Return default configuration
    config = {
      ocr: {
        defaultLanguage: 'eng',
        supportedLanguages: ['eng', 'fra', 'deu', 'spa'],
        defaultOptions: {
          deskew: true,
          enhanceContrast: true,
          removeNoise: true
        },
        processing: {
          maxFileSize: '50MB',
          timeout: 300000,
          imageDensity: 300
        }
      },
      storage: {
        uploadDir: 'uploads',
        processedDir: 'processed',
        retentionDays: 7
      },
      performance: {
        workerReuse: true,
        maxConcurrentJobs: 5
      }
    };

    return config;
  }
}

export default loadConfig();

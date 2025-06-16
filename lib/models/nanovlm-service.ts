import { ModelService, OCRResult } from './interfaces/model-service.interface';
import { modelRegistry } from './registry';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import logger from '../logger';

interface ProcessOptions {
  enhancementMode?: 'standard' | 'aggressive';
  timeout?: number;
  language?: string;
}

export class NanoVLMService implements ModelService {
  private modelPath: string;
  private initialized: boolean = false;
  private readonly modelId = 'nanovlm-222m';
  private readonly pythonProcessor: string;

  constructor() {
    this.modelPath = join(process.cwd(), 'models', this.modelId);
    this.pythonProcessor = join(process.cwd(), 'python/processors/nanovlm_processor.py');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Verify model files
      if (!existsSync(this.modelPath)) {
        throw new Error('NanoVLM model not found');
      }

      // Test model loading
      await this.testModelLoading();
      
      this.initialized = true;
      logger.info('NanoVLM service initialized successfully');
    } catch (error) {
      logger.error('NanoVLM initialization failed:', error);
      throw error;
    }
  }

  async processImage(imagePath: string): Promise<OCRResult> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const result = await this.runInference(imagePath, {
        enhancementMode: 'standard',
        language: 'en'
      });

      return {
        text: result.text,
        confidence: result.confidence,
        metadata: {
          engine: this.modelId,
          processingTime: result.processingTime || 0
        }
      };
    } catch (error) {
      logger.error('NanoVLM processing failed:', error);
      throw error;
    }
  }

  async getCapabilities(): Promise<Record<string, any>> {
    return {
      model: this.modelId,
      capabilities: ['ocr', 'document_analysis'],
      supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
      maxImageSize: '10MB',
      requiresInitialization: true
    };
  }

  // Keep the original processDocument method for backward compatibility
  async processDocument(filePath: string, options: ProcessOptions = {}): Promise<any> {
    const result = await this.processImage(filePath);
    return {
      ...result,
      engine: this.modelId,
      metadata: {
        ...result.metadata,
        enhancementMode: options.enhancementMode || 'standard'
      }
    };
  }

  private async runInference(imagePath: string, options: ProcessOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      const process = spawn('python3', [
        this.pythonProcessor,
        '--model_path', this.modelPath,
        '--image_path', imagePath,
        '--enhancement_mode', options.enhancementMode || 'standard',
        '--language', options.language || 'en'
      ]);

      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      const timeout = setTimeout(() => {
        process.kill();
        reject(new Error('NanoVLM process timed out'));
      }, options.timeout || 30000);

      process.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            reject(new Error(`Failed to parse NanoVLM output: ${errorMessage}`));
          }
        } else {
          reject(new Error(`NanoVLM process failed: ${error}`));
        }
      });
    });
  }

  private async testModelLoading(): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('python3', [
        '-c',
        'from transformers import VisionEncoderDecoderModel; print("OK")'
      ]);

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('Failed to load transformers library'));
        }
      });
    });
  }

  // getCapabilities method is already implemented above
}

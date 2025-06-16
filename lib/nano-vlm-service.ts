import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import logger from './logger';
import { ConfidenceData } from './types/ocr-types';
import { normalizeConfidenceData } from './confidence-utils';

export interface NanoVLMOptions {
  documentType?: 'general' | 'handwritten' | 'table' | 'poor_quality';
  confidenceThreshold?: number;
  enhanceResolution?: boolean;
  preserveLayout?: boolean;
  preserveFullText?: boolean;
  skipTruncation?: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number | ConfidenceData;
  structuredData?: any;
  processingTime: number;
  layout?: any[];
  metadata?: {
    outputPath?: string;
    [key: string]: any;
  };
}

export class NanoVLMService {
  private pythonPath: string;
  private processorPath: string;
  private timeoutMs: number;

  constructor(timeoutMs = 300000) { // 5 minute default timeout
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.processorPath = path.join(__dirname, '../python/smart_ocr.py');
    this.timeoutMs = timeoutMs;
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.processorPath)) {
        logger.warn('NanoVLM processor script not found:', this.processorPath);
        return false;
      }

      // Verify Python and required dependencies
      await this.executePythonProcess(['-c', 'import sys; print(sys.version)'], {});
      return true;
    } catch (error) {
      logger.warn('NanoVLM service not available:', error);
      return false;
    }
  }

  async processImage(
    imagePath: string, 
    outputDir: string, 
    options: NanoVLMOptions = {}
  ): Promise<OCRResult> {
    if (!imagePath) {
      throw new Error('Image path is required');
    }

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Input file does not exist: ${imagePath}`);
    }

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'nanovlm-'));
    const outputPath = path.join(tempDir, 'output.json');
    const startTime = Date.now();

    try {
      // Verify outputDir exists
      await fs.promises.access(outputDir).catch(async () => {
        await fs.promises.mkdir(outputDir, { recursive: true });
      });

      // Build command line arguments
      const args = [
        this.processorPath,
        '--input', imagePath,
        '--output_file', outputPath,
        '--document_type', options.documentType || 'general',
        '--confidence_threshold', String(options.confidenceThreshold || 0.7)
      ];

      if (options.enhanceResolution) args.push('--enhance_resolution');
      if (options.preserveLayout) args.push('--preserve_layout');
      if (options.preserveFullText) args.push('--preserve_full_text');
      if (options.skipTruncation) args.push('--skip_truncation');

      // Setup environment
      const env = {
        ...process.env,
        PYTHONPATH: path.join(__dirname, '../python'),
        NANOVLM_PRESERVE_FULL_TEXT: options.preserveFullText ? '1' : '0',
        NANOVLM_DEBUG: process.env.NODE_ENV === 'development' ? '1' : '0',
        PYTHONUNBUFFERED: '1'
      };

      // Execute processor with timeout
      await this.executePythonProcess(args, env, this.timeoutMs);

      // Validate output file exists
      if (!fs.existsSync(outputPath)) {
        throw new Error('NanoVLM failed to create output file');
      }

      // Parse and validate output
      const outputContent = await fs.promises.readFile(outputPath, 'utf8');
      let outputData;
      try {
        outputData = JSON.parse(outputContent);
      } catch (error) {
        throw new Error(`Invalid JSON output from NanoVLM: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      if (!outputData.success) {
        throw new Error(outputData.error || 'NanoVLM processing failed without specific error');
      }

      // Return result with normalized confidence
      const normalizedConfidence = normalizeConfidenceData(outputData.confidence || 0);
      const processingTime = Date.now() - startTime;

      return {
        text: outputData.text || '',
        confidence: normalizedConfidence,
        structuredData: outputData.structuredData,
        processingTime,
        layout: outputData.layout,
        metadata: {
          ...outputData.metadata,
          outputPath: outputData.outputPath,
          fullTextAvailable: true,
          textLength: outputData.text ? outputData.text.length : 0,
          processingOptions: options,
          executionTime: processingTime
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error in NanoVLM processing';
      logger.error('NanoVLM processing failed:', { error, imagePath, options });
      throw new Error(`NanoVLM processing failed: ${errorMessage}`);

    } finally {
      // Cleanup temp directory
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        logger.warn('Failed to clean up temp directory:', { error, tempDir });
      }
    }
  }

  private executePythonProcess(args: string[], env: NodeJS.ProcessEnv, timeoutMs?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, args, { env });
      
      let stderr = '';
      let timeout: NodeJS.Timeout | null = null;
      
      if (timeoutMs) {
        timeout = setTimeout(() => {
          process.kill();
          reject(new Error(`Process timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      process.stderr.on('data', (data) => {
        stderr += data;
      });

      process.on('close', (code, signal) => {
        if (timeout) clearTimeout(timeout);
        
        if (code === 0) {
          resolve();
        } else {
          const error = new Error(`Python process failed with code ${code}${signal ? ` (signal: ${signal})` : ''}: ${stderr}`);
          reject(error);
        }
      });

      process.on('error', (error) => {
        if (timeout) clearTimeout(timeout);
        reject(error);
      });
    });
  }
}
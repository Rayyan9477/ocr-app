import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import logger from './logger';
import { ConfidenceData } from './types/ocr-types';
import { normalizeConfidenceData } from './confidence-utils';

export interface NanoVLMOptions {
  documentType?: 'general' | 'handwritten' | 'table' | 'poor_quality';
  confidenceThreshold?: number;
  enhanceResolution?: boolean;
  preserveLayout?: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number | ConfidenceData; // Updated to accept both number and ConfidenceData
  structuredData?: any;
  processingTime: number;
  layout?: any[];
}

export class NanoVLMService {
  private modelPath: string;
  private pythonEnvPath: string;
  private pythonModulePath: string;
  
  constructor(
    modelPath = path.join(process.cwd(), 'models', 'nanovlm'),
    pythonEnvPath?: string
  ) {
    this.modelPath = modelPath;
    this.pythonModulePath = path.join(process.cwd(), 'python');
    
    // Use system Python or specified path
    if (pythonEnvPath) {
      this.pythonEnvPath = pythonEnvPath;
    } else {
      const isWindows = process.platform === 'win32';
      this.pythonEnvPath = isWindows ? 'python' : 'python3';
      logger.info('Using system Python for nanoVLM processing');
    }
  }

  async processImage(
    imagePath: string, 
    outputDir: string, 
    options: NanoVLMOptions = {}
  ): Promise<OCRResult> {
    const startTime = Date.now();
    let outputPath: string | undefined;
    let tempFiles: string[] = [];

    try {
      // Validate input path
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Input image not found: ${imagePath}`);
      }

      // Create output directory if it doesn't exist
      fs.mkdirSync(outputDir, { recursive: true });

      outputPath = path.join(
        outputDir,
        `${path.basename(imagePath, path.extname(imagePath))}_result.json`
      );

      // Track any temporary files created during processing
      const trackTempFile = (filePath: string) => {
        tempFiles.push(filePath);
        return filePath;
      };

      // Process image with appropriate environment setup
      const env = {
        ...process.env,
        PYTHONPATH: this.pythonModulePath + (process.env.PYTHONPATH ? path.delimiter + process.env.PYTHONPATH : '')
      };

      // Build command arguments
      const args = [
        path.join(this.pythonModulePath, 'nanovlm', 'processor.py'),
        '--model_path', this.modelPath,
        '--input', imagePath,
        '--output', outputPath
      ];

      // Add optional arguments
      if (options.documentType) {
        args.push('--document_type', options.documentType);
      }
      if (options.confidenceThreshold) {
        args.push('--confidence_threshold', options.confidenceThreshold.toString());
      }
      if (options.enhanceResolution) {
        args.push('--enhance_resolution');
      }
      if (options.preserveLayout) {
        args.push('--preserve_layout');
      }

      // Execute Python processor
      logger.info(`Processing image with nanoVLM: ${imagePath}`);
      const result = await this.executePythonProcess(args, env);

      // Verify output file exists and is valid JSON
      if (!fs.existsSync(outputPath)) {
        throw new Error(`Output file not created: ${outputPath}`);
      }

      // Parse and validate output
      const outputContent = fs.readFileSync(outputPath, 'utf8');
      const outputData = JSON.parse(outputContent);
      
      if (!outputData.success) {
        throw new Error(outputData.error || 'Processing failed without specific error');
      }
      
      // Return structured result with normalized confidence
      const normalizedConfidence = normalizeConfidenceData(outputData.confidence || 0);
      return {
        text: outputData.text || '',
        confidence: normalizedConfidence,
        structuredData: outputData.structured_data,
        layout: outputData.layout,
        processingTime: Date.now() - startTime,
        outputPath // Include output file path
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error processing image with nanoVLM: ${errorMessage}`);
      throw error;
    } finally {
      // Clean up any temporary files
      tempFiles.forEach(filePath => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (cleanupError) {
          logger.warn(`Failed to clean up temporary file ${filePath}: ${cleanupError}`);
        }
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      logger.info('Checking nanoVLM availability...');
      
      // Check if our Python module exists
      const processorPath = path.join(this.pythonModulePath, 'nanovlm', 'processor.py');
      if (!fs.existsSync(processorPath)) {
        logger.error(`nanoVLM processor module not found at: ${processorPath}`);
        return false;
      }
      
      // Set environment for Python module path
      const env = {
        ...process.env,
        PYTHONPATH: this.pythonModulePath + (process.env.PYTHONPATH ? path.delimiter + process.env.PYTHONPATH : '')
      };
      
      // Test basic Python execution and check dependencies
      await this.executePythonProcess(['-c', 'import sys, os, json; from PIL import Image; print("Dependencies available")'], env);
      
      logger.info('nanoVLM is available!');
      return true;
    } catch (error) {
      logger.error(`NanoVLM is not available: ${error}`);
      // Enhanced debugging information
      this.logDiagnostics();
      
      return false;
    }
  }
  
  private logDiagnostics(): void {
    try {
      logger.debug(`=== NanoVLM Diagnostics ===`);
      logger.debug(`Python path: ${this.pythonEnvPath}`);
      logger.debug(`Python executable exists: ${fs.existsSync(this.pythonEnvPath)}`);
      logger.debug(`Model path: ${this.modelPath}`);
      logger.debug(`Model path exists: ${fs.existsSync(this.modelPath)}`);
      logger.debug(`Python module path: ${this.pythonModulePath}`);
      logger.debug(`Python module exists: ${fs.existsSync(this.pythonModulePath)}`);
      
      // Check specific files
      const processorPath = path.join(this.pythonModulePath, 'nanovlm', 'processor.py');
      logger.debug(`Processor script exists: ${fs.existsSync(processorPath)}`);
      
      const initPath = path.join(this.pythonModulePath, 'nanovlm', '__init__.py');
      logger.debug(`Init file exists: ${fs.existsSync(initPath)}`);
      
      // List directory contents
      if (fs.existsSync(this.pythonModulePath)) {
        const moduleContents = fs.readdirSync(this.pythonModulePath);
        logger.debug(`Python module directory contents: ${moduleContents.join(', ')}`);
        
        const nanovlmDir = path.join(this.pythonModulePath, 'nanovlm');
        if (fs.existsSync(nanovlmDir)) {
          const nanovlmContents = fs.readdirSync(nanovlmDir);
          logger.debug(`nanovlm directory contents: ${nanovlmContents.join(', ')}`);
        }
      }
      
      if (fs.existsSync(this.modelPath)) {
        const modelContents = fs.readdirSync(this.modelPath);
        logger.debug(`Model directory contents: ${modelContents.join(', ')}`);
      }
      
      logger.debug(`=== End Diagnostics ===`);
    } catch (err) {
      logger.error(`Error during diagnostics: ${err}`);
    }
  }
  
  private executePythonProcess(args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonEnvPath, args, { env });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.debug(`NanoVLM stderr: ${data.toString()}`);
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Python process failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (err) => {
        reject(new Error(`Failed to start Python process: ${err.message}`));
      });
      
      // Add timeout
      const timeout = setTimeout(() => {
        process.kill();
        reject(new Error('Python process timed out after 30 seconds'));
      }, 30000);
      
      process.on('close', () => clearTimeout(timeout));
    });
  }
}
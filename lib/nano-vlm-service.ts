import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import logger from './logger';

export interface NanoVLMOptions {
  documentType?: 'general' | 'handwritten' | 'table' | 'poor_quality';
  confidenceThreshold?: number;
  enhanceResolution?: boolean;
  preserveLayout?: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number;
  structuredData?: any;
  processingTime: number;
  layout?: any[];
}

export class NanoVLMService {
  private modelPath: string;
  private pythonEnvPath: string;
  
  constructor(
    modelPath = path.join(process.cwd(), 'models', 'nanovlm'),
    pythonEnvPath = path.join(process.cwd(), 'nanovlm_env', 'bin', 'python')
  ) {
    this.modelPath = modelPath;
    this.pythonEnvPath = pythonEnvPath;
    
    // Check if model exists
    if (!fs.existsSync(this.modelPath)) {
      logger.warn(`NanoVLM model not found at ${this.modelPath}. Please download the model.`);
    }
  }
  
  async processImage(
    imagePath: string, 
    outputDir: string, 
    options: NanoVLMOptions = {}
  ): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, `${path.basename(imagePath, path.extname(imagePath))}_result.json`);
      
      // Build command arguments based on document type and options
      const args = [
        '-m', 'nanovlm.process',
        '--model_path', this.modelPath,
        '--input', imagePath,
        '--output', outputPath
      ];
      
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
      
      // Execute the Python script
      const result = await this.executePythonProcess(args);
      
      // Read and parse the output file
      const outputData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      
      const processingTime = Date.now() - startTime;
      
      return {
        text: outputData.text,
        confidence: outputData.confidence || 0,
        structuredData: outputData.structured_data,
        layout: outputData.layout,
        processingTime
      };
    } catch (error) {
      logger.error(`Error processing image with nanoVLM: ${error}`);
      return {
        text: '',
        confidence: 0,
        processingTime: Date.now() - startTime
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      logger.info('Checking nanoVLM availability...');
      await this.executePythonProcess(['-c', 'import nanovlm; print("available")']);
      logger.info('nanoVLM is available!');
      return true;
    } catch (error) {
      logger.error(`NanoVLM is not available: ${error}`);
      // Log more detailed information to help with debugging
      try {
        logger.debug(`Python path: ${this.pythonEnvPath}`);
        logger.debug(`Model path exists: ${fs.existsSync(this.modelPath)}`);
        
        // Try to list what's in the model directory
        if (fs.existsSync(this.modelPath)) {
          logger.debug(`Model directory contents: ${fs.readdirSync(this.modelPath).join(', ')}`);
        }
        
        // Check if Python environment exists
        logger.debug(`Python env exists: ${fs.existsSync(this.pythonEnvPath)}`);
      } catch (err) {
        logger.error(`Error during debugging checks: ${err}`);
      }
      
      return false;
    }
  }
  
  private executePythonProcess(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      logger.debug(`Executing Python process: ${this.pythonEnvPath} ${args.join(' ')}`);
      const process = spawn(this.pythonEnvPath, args);
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
        logger.debug(`Python stdout: ${data.toString()}`);
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.debug(`Python stderr: ${data.toString()}`);
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
      
      process.on('error', (err) => {
        reject(new Error(`Failed to start Python process: ${err.message}`));
      });
    });
  }
}
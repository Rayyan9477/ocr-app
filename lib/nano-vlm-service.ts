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
  private pythonModulePath: string;
  
  constructor(
    modelPath = path.join(process.cwd(), 'models', 'nanovlm'),
    pythonEnvPath?: string
  ) {
    this.modelPath = modelPath;
    this.pythonModulePath = path.join(process.cwd(), 'python');
    
    // Use system Python directly
    if (pythonEnvPath) {
      this.pythonEnvPath = pythonEnvPath;
    } else {
      const isWindows = process.platform === 'win32';
      this.pythonEnvPath = isWindows ? 'python' : 'python3';
      logger.info('Using system Python for nanoVLM processing');
    }
    
    // Log configuration for debugging
    logger.info(`NanoVLM Service Configuration:
      Model Path: ${this.modelPath}
      Python Path: ${this.pythonEnvPath}
      Python Module Path: ${this.pythonModulePath}
      Platform: ${process.platform}`);
    
    // Create model directory if it doesn't exist
    if (!fs.existsSync(this.modelPath)) {
      fs.mkdirSync(this.modelPath, { recursive: true });
      logger.info(`Created model directory at ${this.modelPath}`);
    }
  }
  
  async processImage(
    imagePath: string, 
    outputDir: string, 
    options: NanoVLMOptions = {}
  ): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      // Validate input path
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Input image not found: ${imagePath}`);
      }
      
      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, `${path.basename(imagePath, path.extname(imagePath))}_result.json`);
      
      // Set PYTHONPATH to include our module directory
      const env = {
        ...process.env,
        PYTHONPATH: this.pythonModulePath + (process.env.PYTHONPATH ? path.delimiter + process.env.PYTHONPATH : '')
      };
      
      // Build command arguments based on document type and options
      const args = [
        path.join(this.pythonModulePath, 'nanovlm', 'process.py'),
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
      const result = await this.executePythonProcess(args, env);
      
      // Verify output file exists before reading
      if (!fs.existsSync(outputPath)) {
        throw new Error(`Output file not created: ${outputPath}`);
      }
      
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
      
      // Check if our Python module exists
      const processPath = path.join(this.pythonModulePath, 'nanovlm', 'process.py');
      if (!fs.existsSync(processPath)) {
        logger.error(`nanoVLM process module not found at: ${processPath}`);
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
      const processPath = path.join(this.pythonModulePath, 'nanovlm', 'process.py');
      logger.debug(`Process script exists: ${fs.existsSync(processPath)}`);
      
      const initPath = path.join(this.pythonModulePath, 'nanovlm', '__init__.py');
      logger.debug(`Init file exists: ${fs.existsSync(initPath)}`);
      
      // List contents if directories exist
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
      const processEnv = env || process.env;
      logger.debug(`Executing Python process: ${this.pythonEnvPath} ${args.join(' ')}`);
      logger.debug(`Environment PYTHONPATH: ${processEnv.PYTHONPATH}`);
      
      const childProcess = spawn(this.pythonEnvPath, args, {
        env: processEnv,
        cwd: process.cwd()
      });
      
      let stdout = '';
      let stderr = '';
      
      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        logger.debug(`Python stdout: ${data.toString()}`);
      });
      
      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.debug(`Python stderr: ${data.toString()}`);
      });
      
      childProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
      
      childProcess.on('error', (err) => {
        reject(new Error(`Failed to start Python process: ${err.message}`));
      });
      
      // Add timeout to prevent hanging
      setTimeout(() => {
        childProcess.kill();
        reject(new Error('Python process timed out after 30 seconds'));
      }, 30000);
    });
  }
}
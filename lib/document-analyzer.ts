import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import logger from './logger';

export interface DocumentAnalysis {
  hasHandwriting: boolean;
  hasTables: boolean;
  poorQuality: boolean;
  complexLayout: boolean;
  confidence: {
    handwriting: number;
    tables: number;
    quality: number;
    layout: number;
  };
}

export class DocumentAnalyzer {
  private pythonEnvPath: string;
  
  constructor(
    pythonEnvPath = path.join(process.cwd(), 'nanovlm_env', 'bin', 'python')
  ) {
    this.pythonEnvPath = pythonEnvPath;
  }
  
  async analyzeDocument(imagePath: string): Promise<DocumentAnalysis> {
    try {
      // Create a temporary output file for the analysis results
      const outputPath = path.join(
        path.dirname(imagePath), 
        `.${path.basename(imagePath)}-analysis.json`
      );
      
      // Run the Python script for document analysis
      const args = [
        '-m', 'nanovlm.analyze',
        '--input', imagePath,
        '--output', outputPath
      ];
      
      // Execute the Python script
      await new Promise<void>((resolve, reject) => {
        const process = spawn(this.pythonEnvPath, args);
        
        let stderr = '';
        
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Python analysis process failed with code ${code}: ${stderr}`));
          }
        });
        
        process.on('error', (error) => {
          reject(error);
        });
      });
      
      // Read the analysis results
      let analysisResult: any = {};
      if (fs.existsSync(outputPath)) {
        try {
          const resultData = fs.readFileSync(outputPath, 'utf-8');
          analysisResult = JSON.parse(resultData);
          // Clean up the temporary file
          fs.unlinkSync(outputPath);
        } catch (parseError) {
          logger.warn(`Failed to parse analysis results: ${parseError}`);
          // Clean up the temporary file even if parsing failed
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        }
      } else {
        logger.warn('Analysis output file not found, using fallback analysis');
        // Fall back to simple image-based analysis
        return await this.detectDocumentType(imagePath);
      }
      
      // Extract the document characteristics
      return {
        hasHandwriting: analysisResult.hasHandwriting || false,
        hasTables: analysisResult.hasTables || false,
        poorQuality: analysisResult.poorQuality || false,
        complexLayout: analysisResult.complexLayout || false,
        confidence: {
          handwriting: analysisResult.confidence?.handwriting || 0,
          tables: analysisResult.confidence?.tables || 0,
          quality: analysisResult.confidence?.quality || 0,
          layout: analysisResult.confidence?.layout || 0
        }
      };
    } catch (error) {
      logger.error(`Document analysis failed: ${error}`);
      
      // Return default values in case of failure
      return {
        hasHandwriting: false,
        hasTables: false,
        poorQuality: false,
        complexLayout: false,
        confidence: {
          handwriting: 0,
          tables: 0,
          quality: 0,
          layout: 0
        }
      };
    }
  }
  
  // Fallback method using image processing if ML-based analysis is not available
  async detectDocumentType(imagePath: string): Promise<DocumentAnalysis> {
    try {
      // Execute basic image analysis
      // Check file size and format to make basic quality assessment
      const stats = fs.statSync(imagePath);
      const fileSize = stats.size;
      const isLargeFile = fileSize > 2 * 1024 * 1024; // > 2MB
      const extension = path.extname(imagePath).toLowerCase();
      
      // Basic heuristics for document analysis
      const isPotentiallyPoorQuality = fileSize < 100 * 1024 || // Very small files might be low quality
                                      extension === '.jpg' || extension === '.jpeg'; // JPEG compression can reduce quality
      
      // For fallback, we make conservative assumptions
      // Real implementation would use image processing libraries like Sharp or OpenCV
      return {
        hasHandwriting: false, // Conservative assumption - requires ML to detect accurately
        hasTables: false, // Conservative assumption - requires advanced analysis
        poorQuality: isPotentiallyPoorQuality,
        complexLayout: isLargeFile, // Large files might indicate complex layouts
        confidence: {
          handwriting: 0, // No confidence without ML analysis
          tables: 0, // No confidence without ML analysis
          quality: isPotentiallyPoorQuality ? 30 : 70, // Basic quality estimation
          layout: isLargeFile ? 60 : 40 // Basic layout complexity estimation
        }
      };
    } catch (error) {
      logger.error(`Document type detection failed: ${error}`);
      return {
        hasHandwriting: false,
        hasTables: false,
        poorQuality: false,
        complexLayout: false,
        confidence: {
          handwriting: 0,
          tables: 0,
          quality: 0,
          layout: 0
        }
      };
    }
  }
}
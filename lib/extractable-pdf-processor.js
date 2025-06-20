/**
 * Enhanced PDF Processor
 * Processes PDFs to make them extractable while preserving visual appearance
 * 
 * This module integrates OLM OCR capabilities to create searchable PDFs
 * with high-quality text recognition.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { PDFDocument, rgb } from 'pdf-lib';
import OLMOCRIntegration from './olmocr-integration.js';
import os from 'os';

// Configure temporary directory
const TEMP_DIR = path.join(os.tmpdir(), 'extractable-pdf-temp');

class ExtractablePdfProcessor {
  constructor(options = {}) {
    this.options = {
      confidenceThreshold: 0.75,
      preserveLayout: true,
      enhanceOCR: true,
      processAllPages: true,
      addMetadata: true,
      optimizeOutput: true,
      ...options
    };
    
    this.olmocr = new OLMOCRIntegration(options);
    this.initialized = false;
    
    // Ensure temp directory exists
    this.ensureTempDir();
  }
  
  ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  }
  
  /**
   * Initialize the processor
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }
    
    try {
      console.log('Initializing ExtractablePdfProcessor...');
      
      // Initialize the OLMOCR integration
      const olmInitialized = await this.olmocr.initialize();
      if (!olmInitialized) {
        console.error('OLMOCR initialization failed, cannot proceed');
        throw new Error('OLMOCR initialization failed');
      }
      
      // Check required dependencies
      this.checkDependencies();
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`Initialization failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Check required dependencies
   */
  checkDependencies() {
    try {
      // Check for ImageMagick
      execSync('convert -version');
      
      // Check for pdftk
      try {
        execSync('pdftk --version');
      } catch (error) {
        console.warn('pdftk not found, some features may be limited');
      }
      
      // No other OCR engines needed, as we're exclusively using PaliGemma2
    } catch (error) {
      console.warn(`Dependency check warning: ${error.message}`);
    }
  }
  
  /**
   * Process a PDF to make it extractable
   * 
   * @param {string} inputPath - Path to the input PDF
   * @param {object} options - Processing options
   * @returns {Promise<string>} - Path to the processed PDF
   */
  async processPdf(inputPath, options = {}) {
    // Merge options
    const opts = { ...this.options, ...options };
    
    // Initialize if needed
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Validate input file
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input PDF not found: ${inputPath}`);
    }
    
    try {
      console.log(`Processing PDF: ${inputPath}`);
      
      // Process the PDF using OLMOCR
      const outputPath = await this.olmocr.processExtractablePdf(inputPath, opts);
      
      // If optimization is enabled, compress the output
      if (opts.optimizeOutput) {
        const optimizedPath = await this.optimizePdf(outputPath);
        return optimizedPath;
      }
      
      return outputPath;
    } catch (error) {
      console.error(`Error processing PDF: ${error.message}`);
      throw error; // Don't fallback to any other method
    }
  }
  
  /**
   * Extract text from a PDF
   * 
   * @param {string} pdfPath - Path to the PDF
   * @returns {Promise<string>} - Extracted text
   */
  async extractText(pdfPath) {
    try {
      // Process the PDF first to ensure it's extractable
      const extractablePdf = await this.processPdf(pdfPath);
      
      // Use pdftotext to extract text
      const outputTxt = path.join(TEMP_DIR, `extracted-${Date.now()}.txt`);
      execSync(`pdftotext "${extractablePdf}" "${outputTxt}"`);
      
      if (!fs.existsSync(outputTxt)) {
        throw new Error('Failed to extract text from PDF');
      }
      
      // Read the extracted text
      const text = fs.readFileSync(outputTxt, 'utf8');
      
      // Clean up
      try {
        fs.unlinkSync(outputTxt);
        if (extractablePdf !== pdfPath) {
          fs.unlinkSync(extractablePdf);
        }
      } catch (error) {
        console.warn(`Cleanup error: ${error.message}`);
      }
      
      return text;
    } catch (error) {
      console.error(`Error extracting text: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Clean up temporary files
   */
  cleanup() {
    try {
      // Check if the temp directory exists
      if (fs.existsSync(TEMP_DIR)) {
        // Read all files in the temp directory
        const files = fs.readdirSync(TEMP_DIR);
        
        // Delete each file
        for (const file of files) {
          const filePath = path.join(TEMP_DIR, file);
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            console.warn(`Failed to delete temp file ${filePath}: ${error.message}`);
          }
        }
        
        console.log(`Cleaned up ${files.length} temporary files`);
      }
    } catch (error) {
      console.error(`Error during cleanup: ${error.message}`);
    }
  }
}

export default ExtractablePdfProcessor;

#!/usr/bin/env node

/**
 * Demo script for creating extractable PDFs
 * This script demonstrates the OLMOCR integration for creating extractable PDFs
 * while preserving the original visual appearance.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import VLMModelManager from './lib/vlm-model-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
let inputFile = args[0];
let outputFile = args[1];

// Print usage if input file is not provided
if (!inputFile) {
  console.log('Usage: node make-extractable-pdf.js <input-pdf> [output-pdf]');
  console.log('Creates an extractable version of the input PDF while preserving visual appearance');
  process.exit(1);
}

// If input path is relative, make it absolute
if (!path.isAbsolute(inputFile)) {
  inputFile = path.join(process.cwd(), inputFile);
}

// Generate output file path if not provided
if (!outputFile) {
  const inputBasename = path.basename(inputFile, '.pdf');
  outputFile = path.join(process.cwd(), `${inputBasename}-extractable.pdf`);
}

// If output path is relative, make it absolute
if (!path.isAbsolute(outputFile)) {
  outputFile = path.join(process.cwd(), outputFile);
}

// Validate input file
if (!fs.existsSync(inputFile)) {
  console.error(`Error: Input file not found: ${inputFile}`);
  process.exit(1);
}

// Check if input file is a PDF
if (!inputFile.toLowerCase().endsWith('.pdf')) {
  console.error('Error: Input file must be a PDF');
  process.exit(1);
}

async function makeExtractablePdf() {
  console.log(`Input PDF: ${inputFile}`);
  console.log(`Output PDF will be saved to: ${outputFile}`);
  
  try {
    // Initialize the VLM Model Manager with OLMOCR enabled
    const modelManager = new VLMModelManager({
      enableOLMOCR: true
    });
    
    console.log('Initializing OLMOCR...');
    await modelManager.loadModel('olmocr');
    
    console.log('Processing PDF to make it extractable...');
    const processedPdfPath = await modelManager.makeExtractablePdf(inputFile, {
      preserveLayout: true,
      enhanceOCR: true
    });
    
    // Copy the processed PDF to the output location
    fs.copyFileSync(processedPdfPath, outputFile);
    
    console.log(`✅ Successfully created extractable PDF: ${outputFile}`);
    
    // Cleanup temporary files
    try {
      fs.unlinkSync(processedPdfPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  } catch (error) {
    console.error(`❌ Error processing PDF: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
makeExtractablePdf();

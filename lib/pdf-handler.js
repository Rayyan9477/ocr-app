/**
 * Safe PDF upload and conversion utilities
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Simple logger implementation
const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`)
};

// Generate a secure temporary path for files
function getTempPath(baseName, extension) {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${timestamp}_${randomSuffix}_${sanitizedBaseName}${extension}`;
}

/**
 * Safely save an uploaded file to disk
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} originalFilename - Original filename
 * @param {string} uploadDir - Directory to save the file in
 * @returns {string} Path to the saved file
 */
export function saveUploadedFile(buffer, originalFilename, uploadDir) {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const safeFilename = getTempPath('', path.extname(originalFilename));
  const filePath = path.join(uploadDir, safeFilename);
  
  fs.writeFileSync(filePath, buffer);
  logger.info(`File saved to ${filePath}`);
  
  return filePath;
}

/**
 * Check if a file is a PDF
 * 
 * @param {string} filePath - Path to file
 * @returns {boolean} True if file is a PDF
 */
export function isPdfFile(filePath) {
  // Check extension
  if (!filePath.toLowerCase().endsWith('.pdf')) {
    return false;
  }
  
  // Check file signature
  try {
    const buffer = fs.readFileSync(filePath, { start: 0, end: 4 });
    return buffer.toString().startsWith('%PDF');
  } catch (error) {
    logger.warn(`Failed to check PDF signature: ${error.message}`);
    return filePath.toLowerCase().endsWith('.pdf');
  }
}

/**
 * Convert PDF to an image for VLM processing
 * 
 * @param {string} pdfPath - Path to PDF file 
 * @param {string} outputDir - Directory to save the converted image
 * @returns {string} Path to the converted image
 */
export function convertPdfToImage(pdfPath, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputImagePath = path.join(outputDir, `pdf-${getTempPath('', '.png')}`);
  
  try {
    // Use ImageMagick to convert first page of PDF to image
    const cmd = `convert -density 300 "${pdfPath}"[0] -quality 100 "${outputImagePath}"`;
    execSync(cmd);
    
    if (!fs.existsSync(outputImagePath)) {
      throw new Error('Failed to convert PDF to image');
    }
    
    logger.info(`PDF converted to image: ${outputImagePath}`);
    return outputImagePath;
  } catch (error) {
    logger.error(`Error converting PDF to image: ${error.message}`);
    throw new Error(`PDF conversion failed: ${error.message}`);
  }
}

export default {
  saveUploadedFile,
  isPdfFile,
  convertPdfToImage
};

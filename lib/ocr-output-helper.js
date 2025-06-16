/**
 * OCR Output Helper Functions
 * 
 * This module provides utilities for extracting output file paths from OCR error messages
 * and checking for valid OCR outputs even when the primary process fails.
 */

const fs = require('fs');
const path = require('path');

/**
 * Extract potential file paths from an error message
 * 
 * @param {string} errorMessage - The error message to parse
 * @returns {Array<string>} - Array of potential output file paths
 */
function extractPotentialPathsFromError(errorMessage) {
  if (!errorMessage) return [];
  
  // Array to store potential paths
  const potentialPaths = [];
  
  // Look for common path patterns in the error message
  
  // Pattern 1: Paths in quotes or with file extensions
  const pathRegex = /(["'])((?:\/|\.\/|\.\.\/)[^"'\s]+\.(?:pdf|txt|html|jpg|png|tif))\1|(?:\/|\.\/|\.\.\/)[^\s]+\.(?:pdf|txt|html|jpg|png|tif)/g;
  let match;
  while ((match = pathRegex.exec(errorMessage)) !== null) {
    const extractedPath = match[2] || match[0];
    potentialPaths.push(extractedPath);
  }
  
  // Pattern 2: Look for paths with "output" or "processed" mentions
  const outputRegex = /(?:output|processed|created|generated|wrote)(?:\s+(?:file|to))?\s+(["']?)([^\s"']+\.(?:pdf|txt|html))\1/gi;
  while ((match = outputRegex.exec(errorMessage)) !== null) {
    potentialPaths.push(match[2]);
  }
  
  // Pattern 3: Look for paths after "saved as" or similar phrases
  const savedAsRegex = /(?:saved|written|output)(?:\s+(?:as|to|in|into))?\s+(["']?)([^\s"']+\.(?:pdf|txt|html))\1/gi;
  while ((match = savedAsRegex.exec(errorMessage)) !== null) {
    potentialPaths.push(match[2]);
  }
  
  // Pattern 4: Look for OCRmyPDF specific output format references
  const ocrOutputRegex = /([^\s"']+)_ocr\.pdf/g;
  while ((match = ocrOutputRegex.exec(errorMessage)) !== null) {
    const baseName = match[1];
    potentialPaths.push(`${baseName}_ocr.pdf`);
    // Also check in processed directory
    potentialPaths.push(path.join('processed', `${baseName}_ocr.pdf`));
  }
  
  // Filter out duplicates and normalize paths
  return [...new Set(potentialPaths)].map(p => {
    // If path is relative, try to make it absolute
    if (!path.isAbsolute(p)) {
      // Try in processed directory
      const processedPath = path.join(process.cwd(), 'processed', p);
      if (fs.existsSync(processedPath)) {
        return processedPath;
      }
      
      // Try in uploads directory
      const uploadsPath = path.join(process.cwd(), 'uploads', p);
      if (fs.existsSync(uploadsPath)) {
        return uploadsPath;
      }
      
      // Try in current directory
      const cwdPath = path.join(process.cwd(), p);
      if (fs.existsSync(cwdPath)) {
        return cwdPath;
      }
    }
    
    return p;
  });
}

/**
 * Check for output files from a failed OCR process
 * 
 * @param {string} inputPath - Path to the original input file
 * @param {string} errorMessage - Error message from the failed process
 * @returns {Promise<{found: boolean, path: string|null}>} - Result object with found status and path
 */
async function checkForOutputDespiteError(inputPath, errorMessage) {
  // Get potential paths from the error message
  const potentialPaths = extractPotentialPathsFromError(errorMessage);
  
  // Check if any of the potential paths exist
  for (const p of potentialPaths) {
    if (fs.existsSync(p)) {
      console.log(`Found existing output file from error message: ${p}`);
      return { found: true, path: p };
    }
  }
  
  // Try standard naming patterns based on input file
  const baseInputPath = path.basename(inputPath, path.extname(inputPath));
  const standardPatterns = [
    // Standard OCRmyPDF output pattern
    path.join(process.cwd(), 'processed', `${baseInputPath}_ocr.pdf`),
    // Timestamp pattern
    path.join(process.cwd(), 'processed', `${baseInputPath}_${Date.now()}_ocr.pdf`),
    // Simple pattern
    path.join(process.cwd(), 'processed', `${baseInputPath}.pdf`),
    // Check in original directory
    path.join(path.dirname(inputPath), `${baseInputPath}_ocr.pdf`),
  ];
  
  for (const p of standardPatterns) {
    if (fs.existsSync(p)) {
      console.log(`Found output file using standard pattern: ${p}`);
      return { found: true, path: p };
    }
  }
  
  // Check the processed directory for any files containing the base input name
  try {
    const processedDir = path.join(process.cwd(), 'processed');
    if (fs.existsSync(processedDir)) {
      const files = fs.readdirSync(processedDir);
      // Look for files containing the base input name created in the last 10 minutes
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      
      for (const file of files) {
        if (file.includes(baseInputPath) && file.endsWith('.pdf')) {
          const filePath = path.join(processedDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() > tenMinutesAgo) {
            console.log(`Found recent matching file in processed directory: ${filePath}`);
            return { found: true, path: filePath };
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error checking processed directory: ${error.message}`);
  }
  
  return { found: false, path: null };
}

module.exports = {
  extractPotentialPathsFromError,
  checkForOutputDespiteError
};

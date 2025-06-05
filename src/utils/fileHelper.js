const fs = require('fs');
const path = require('path');

/**
 * Validates a file exists and is accessible
 * @param {string} filePath - Path to the file
 * @returns {boolean} True if valid, throws error otherwise
 */
function validateFile(filePath) {
  if (!filePath) {
    throw new Error('No file path provided');
  }
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  
  const stats = fs.statSync(filePath);
  
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${filePath}`);
  }
  
  if (stats.size === 0) {
    throw new Error(`File is empty: ${filePath}`);
  }
  
  return true;
}

/**
 * Gets file information
 * @param {string} filePath - Path to the file
 * @returns {Object} File information
 */
function getFileInfo(filePath) {
  validateFile(filePath);
  
  const stats = fs.statSync(filePath);
  return {
    name: path.basename(filePath),
    size: stats.size,
    sizeFormatted: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
    extension: path.extname(filePath).toLowerCase(),
    path: filePath
  };
}

module.exports = {
  validateFile,
  getFileInfo
};

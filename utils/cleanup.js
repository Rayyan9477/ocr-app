const fs = require('fs');
const path = require('path');

/**
 * Cleans up files in a specific directory
 * @param {string} dirPath - Directory to clean
 */
function cleanupDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    console.log(`Cleaning up ${dirPath}...`);
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      if (file !== '.gitkeep') {
        const filePath = path.join(dirPath, file);
        try {
          if (fs.lstatSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
          console.log(`Removed: ${filePath}`);
        } catch (error) {
          console.error(`Error deleting ${filePath}:`, error.message);
        }
      }
    });
  }
}

/**
 * Cleans up temporary files in the tmp directory
 */
function cleanupTemporaryFiles() {
  const tmpDir = path.join(__dirname, '..', 'tmp');
  cleanupDirectory(tmpDir);
}

/**
 * Cleans up processed files in the processed directory
 */
function cleanupProcessedFiles() {
  const processedDir = path.join(__dirname, '..', 'processed');
  cleanupDirectory(processedDir);
}

/**
 * Cleanup all temporary and processed files
 */
function cleanupAll() {
  cleanupTemporaryFiles();
  cleanupProcessedFiles();
}

module.exports = { 
  cleanupTemporaryFiles, 
  cleanupProcessedFiles, 
  cleanupAll 
};

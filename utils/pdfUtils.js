const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * Convert a PDF file to a series of images
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} outputDir - Directory to save the image files
 * @param {number} dpi - DPI for image conversion (default: 300)
 * @returns {Promise<string[]>} - Array of paths to the generated images
 */
async function convertPdfToImages(pdfPath, outputDir, dpi = 300) {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPattern = path.join(outputDir, 'page-%03d.png');
    
    // Use ImageMagick to convert PDF pages to images
    const cmd = `convert -density ${dpi} "${pdfPath}" -quality 100 "${outputPattern}"`;
    await execPromise(cmd);
    
    // Get list of generated images
    const files = await fs.promises.readdir(outputDir);
    return files
      .filter(file => file.startsWith('page-') && file.endsWith('.png'))
      .map(file => path.join(outputDir, file))
      .sort();
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw new Error(`PDF to image conversion failed: ${error.message}`);
  }
}

module.exports = {
  convertPdfToImages
};

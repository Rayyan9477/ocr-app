const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * Convert a PDF file to a series of images for OCR processing
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

    // Use pdftoppm with PNG output and high DPI for better OCR quality
    const outputPattern = path.join(outputDir, 'page');
    await execPromise(`pdftoppm -png -r ${dpi} "${pdfPath}" "${outputPattern}"`);

    // Get list of generated images
    const files = await fs.promises.readdir(outputDir);
    return files
      .filter(f => f.endsWith('.png'))
      .sort((a, b) => {
        const pageA = parseInt(a.match(/page-(\d+)/)?.[1] || '0');
        const pageB = parseInt(b.match(/page-(\d+)/)?.[1] || '0');
        return pageA - pageB;
      })
      .map(f => path.join(outputDir, f));
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw error;
  }
}

/**
 * Create a new PDF document with error information
 * @param {string} outputPath - Path where the PDF should be saved
 * @param {string} errorMessage - Error message to include in the PDF
 * @returns {Promise<void>}
 */
async function createErrorPdf(outputPath, errorMessage) {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();

    // Add error message
    const fontSize = 12;
    page.drawText('OCR Processing Error', {
      x: 50,
      y: height - 50,
      size: 16,
      color: rgb(0.8, 0, 0),
    });

    page.drawText(errorMessage, {
      x: 50,
      y: height - 100,
      size: fontSize,
      color: rgb(0, 0, 0),
      maxWidth: width - 100,
    });

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
  } catch (error) {
    console.error('Error creating error PDF:', error);
    throw error;
  }
}

/**
 * Merge multiple PDFs into a single PDF
 * @param {string[]} pdfPaths - Array of paths to PDF files to merge
 * @param {string} outputPath - Path where the merged PDF should be saved
 * @returns {Promise<void>}
 */
async function mergePdfs(pdfPaths, outputPath) {
  try {
    const mergedPdf = await PDFDocument.create();

    for (const pdfPath of pdfPaths) {
      const pdfBytes = fs.readFileSync(pdfPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    fs.writeFileSync(outputPath, mergedPdfBytes);
  } catch (error) {
    console.error('Error merging PDFs:', error);
    throw error;
  }
}

module.exports = {
  convertPdfToImages,
  createErrorPdf,
  mergePdfs
};

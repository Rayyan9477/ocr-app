const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const os = require('os');
const { convertPdfToImages } = require('../utils/pdfUtils');

const execPromise = util.promisify(exec);

async function processWithTesseract(filePath, outputBasePath, options = {}) {
  const lang = options.lang || 'eng';
  const psm = options.psm || '1';
  const oem = options.oem || '3';
  const outputFormat = options.outputFormat || 'pdf';
  
  try {
    console.log(`Processing file with Tesseract: ${filePath}`);
    
    // Check if the input is a PDF
    const isPdf = filePath.toLowerCase().endsWith('.pdf');
    
    if (isPdf) {
      // Create a temporary directory for image conversion
      const tempImageDir = path.join(os.tmpdir(), `tesseract_images_${Date.now()}`);
      console.log(`Converting PDF to images in ${tempImageDir}...`);
      
      // Convert PDF to images
      const images = await convertPdfToImages(filePath, tempImageDir);
      console.log(`Converted PDF to ${images.length} images`);
      
      // Process each image with Tesseract
      const outputFiles = [];
      for (let i = 0; i < images.length; i++) {
        const imagePath = images[i];
        const pageOutputPath = `${outputBasePath}_page${i+1}`;
        
        console.log(`Processing page ${i+1} with Tesseract...`);
        const cmd = `tesseract "${imagePath}" "${pageOutputPath}" -l ${lang} --psm ${psm} --oem ${oem} ${outputFormat}`;
        await execPromise(cmd);
        
        outputFiles.push(`${pageOutputPath}.${outputFormat}`);
      }
      
      // If multiple pages, merge them
      if (outputFiles.length > 1 && outputFormat === 'pdf') {
        console.log('Merging PDF outputs...');
        const mergedOutputPath = `${outputBasePath}.pdf`;
        const mergeCmd = `pdftk ${outputFiles.join(' ')} cat output "${mergedOutputPath}"`;
        await execPromise(mergeCmd);
        
        // Clean up individual page outputs
        for (const file of outputFiles) {
          fs.unlinkSync(file);
        }
        
        // Clean up temporary image directory
        fs.rmSync(tempImageDir, { recursive: true, force: true });
        
        return mergedOutputPath;
      } else if (outputFiles.length === 1) {
        // Just rename the single output file
        const finalOutputPath = `${outputBasePath}.${outputFormat}`;
        fs.renameSync(outputFiles[0], finalOutputPath);
        
        // Clean up temporary image directory
        fs.rmSync(tempImageDir, { recursive: true, force: true });
        
        return finalOutputPath;
      }
    } else {
      // Original behavior for image files
      const cmd = `tesseract "${filePath}" "${outputBasePath}" -l ${lang} --psm ${psm} --oem ${oem} ${outputFormat}`;
      await execPromise(cmd);
      return `${outputBasePath}.${outputFormat}`;
    }
  } catch (error) {
    console.error('Tesseract OCR processing failed:', error);
    throw error;
  }
}

module.exports = {
  processWithTesseract,
};
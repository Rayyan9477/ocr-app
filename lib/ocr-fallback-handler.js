/**
 * OCR Fallback Handler
 * 
 * This file provides a robust fallback mechanism for when OCR processing fails
 * but we still need to return a valid PDF document to the user.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const { convertHtmlToPdf } = require('./html-to-pdf-fallback');

const execAsync = util.promisify(exec);

/**
 * Creates a fallback PDF when OCR processing fails
 * 
 * @param {string} inputPath - Path to the original input file
 * @param {string} errorMessage - Error message explaining the failure
 * @param {object} options - Additional options
 * @returns {Promise<{outputFile: string}>} - Path to the fallback file
 */
async function createOcrFallback(inputPath, errorMessage, options = {}) {
  console.log(`Creating fallback for failed OCR of: ${inputPath}`);
  console.log(`Error message: ${errorMessage}`);
  
  // Extract file information
  const inputDir = path.dirname(inputPath);
  const inputBase = path.basename(inputPath, path.extname(inputPath));
  const outputDir = options.outputDir || path.join(process.cwd(), 'processed');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Create fallback filenames
  const timestamp = Date.now();
  const fallbackPdf = path.join(outputDir, `${inputBase}_fallback_${timestamp}.pdf`);
  const fallbackHtml = path.join(outputDir, `${inputBase}_fallback_${timestamp}.html`);
  const fallbackText = path.join(outputDir, `${inputBase}_fallback_${timestamp}.txt`);
  
  // Create HTML content for the fallback
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>OCR Processing Error</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
      h1 { color: #d32f2f; }
      .error-container { 
        border-left: 4px solid #d32f2f; 
        padding-left: 20px; 
        margin: 20px 0;
      }
      .file-info {
        background-color: #f5f5f5;
        padding: 15px;
        border-radius: 4px;
        margin-bottom: 20px;
      }
      .solutions {
        background-color: #e8f5e9;
        padding: 15px;
        border-radius: 4px;
        margin-top: 20px;
      }
      .timestamp {
        color: #757575;
        font-size: 12px;
        margin-top: 40px;
      }
    </style>
  </head>
  <body>
    <h1>OCR Processing Error</h1>
    
    <div class="file-info">
      <p><strong>File:</strong> ${path.basename(inputPath)}</p>
      <p><strong>Size:</strong> ${fs.existsSync(inputPath) ? (fs.statSync(inputPath).size / 1024).toFixed(2) + ' KB' : 'Unknown'}</p>
      <p><strong>Type:</strong> ${path.extname(inputPath).toUpperCase().replace('.', '')}</p>
    </div>
    
    <div class="error-container">
      <h2>Error Details</h2>
      <p>${errorMessage || 'Unknown error occurred during OCR processing'}</p>
    </div>
    
    <div class="solutions">
      <h2>Suggested Solutions</h2>
      <ul>
        <li>Try processing with different OCR settings</li>
        <li>Check if the file is corrupted or password-protected</li>
        <li>For image files, try improving the quality or contrast</li>
        <li>For PDF files, ensure they are not already text-searchable</li>
        <li>Try using a different OCR engine</li>
      </ul>
    </div>
    
    <div class="timestamp">
      <p>Error occurred at: ${new Date().toISOString()}</p>
      <p>This is an automatically generated fallback file.</p>
    </div>
  </body>
  </html>
  `;
  
  // Write HTML content to file
  fs.writeFileSync(fallbackHtml, htmlContent);
  console.log(`Created fallback HTML: ${fallbackHtml}`);
  
  // Also create a text version for simple viewing
  fs.writeFileSync(fallbackText, `OCR PROCESSING ERROR
File: ${path.basename(inputPath)}
Error: ${errorMessage || 'Unknown error'}
Time: ${new Date().toISOString()}

This is a fallback file created when OCR processing failed.
Please try different settings or check if the file is valid.`);
  console.log(`Created fallback text file: ${fallbackText}`);
  
  // Try to convert HTML to PDF
  try {
    const converted = await convertHtmlToPdf(fallbackHtml, fallbackPdf, `OCR Error: ${path.basename(inputPath)}`);
    
    if (converted && fs.existsSync(fallbackPdf)) {
      console.log(`Successfully created fallback PDF: ${fallbackPdf}`);
      return { outputFile: fallbackPdf };
    } else {
      console.error(`HTML to PDF conversion failed`);
    }
  } catch (htmlToPdfError) {
    console.error(`HTML to PDF conversion error: ${htmlToPdfError.message}`);
  }
  
  // If HTML to PDF conversion fails, try using the shell script
  try {
    const shellScript = path.join(process.cwd(), 'lib', 'create-minimal-pdf.sh');
    if (fs.existsSync(shellScript)) {
      console.log(`Attempting to create PDF using shell script: ${shellScript}`);
      await execAsync(`bash "${shellScript}" "${fallbackPdf}" "OCR Error: ${errorMessage}" "${inputPath}"`);
      
      if (fs.existsSync(fallbackPdf)) {
        console.log(`Successfully created fallback PDF using shell script: ${fallbackPdf}`);
        return { outputFile: fallbackPdf };
      }
    }
  } catch (shellError) {
    console.error(`Shell script PDF creation error: ${shellError.message}`);
  }
  
  // Last resort: try to copy the original file if it's a PDF
  if (path.extname(inputPath).toLowerCase() === '.pdf' && fs.existsSync(inputPath)) {
    try {
      console.log(`Attempting to copy original PDF as fallback`);
      fs.copyFileSync(inputPath, fallbackPdf);
      console.log(`Copied original PDF as fallback: ${fallbackPdf}`);
      return { outputFile: fallbackPdf };
    } catch (copyError) {
      console.error(`Error copying original PDF: ${copyError.message}`);
    }
  }
  
  // If we got here, all attempts to create a PDF failed
  // Return the text file path as a last resort
  console.error(`All PDF creation methods failed, returning text file path`);
  return { outputFile: fallbackText };
}

/**
 * Handle OCR errors by creating a fallback document
 * 
 * @param {string} inputPath - Path to the original input file
 * @param {string} errorMessage - Error message explaining the failure
 * @param {object} options - Additional options
 * @returns {Promise<{outputFile: string, success: boolean}>} - Result with path to fallback file
 */
async function handleOcrError(inputPath, errorMessage, options = {}) {
  try {
    const result = await createOcrFallback(inputPath, errorMessage, options);
    
    // Ensure we always return a consistent result object
    return {
      success: false,
      error: 'OCR processing failed',
      details: errorMessage,
      outputFile: result.outputFile,
      fallback: true,
    };
  } catch (error) {
    console.error(`Critical error in OCR fallback handler: ${error.message}`);
    
    // Even if our fallback mechanism fails, try to return something useful
    const emergencyFallbackPath = path.join(
      process.cwd(),
      'processed',
      `emergency_fallback_${Date.now()}.txt`
    );
    
    try {
      fs.writeFileSync(emergencyFallbackPath, 
        `EMERGENCY FALLBACK - OCR AND FALLBACK MECHANISM BOTH FAILED
         Original file: ${inputPath}
         Error: ${errorMessage}
         Fallback error: ${error.message}
         Time: ${new Date().toISOString()}`
      );
    } catch (writeError) {
      console.error(`Failed to create emergency fallback file: ${writeError.message}`);
    }
    
    return {
      success: false,
      error: 'OCR processing failed and fallback creation also failed',
      details: `${errorMessage} | Fallback error: ${error.message}`,
      outputFile: fs.existsSync(emergencyFallbackPath) ? emergencyFallbackPath : null,
      fallback: true,
      emergencyFallback: true
    };
  }
}

module.exports = {
  createOcrFallback,
  handleOcrError
};

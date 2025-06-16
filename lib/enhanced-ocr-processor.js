/**
 * Enhanced OCR Processor
 * 
 * This module integrates multiple OCR engines (Tesseract, OCRmyPDF, NanoVLM)
 * with robust error handling and fallback mechanisms.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { spawn } = require('child_process');
const util = require('util');
const os = require('os');

const execPromise = util.promisify(exec);

// Timeout for OCR operations (in ms) - 5 minutes
const OCR_TIMEOUT = 5 * 60 * 1000;

/**
 * Process a document using multiple OCR engines with fallbacks
 * @param {string} filePath - Path to the input file
 * @param {string} outputDir - Directory for output files
 * @param {object} options - Processing options
 * @returns {Promise<object>} - Processing results
 */
async function processWithMultipleEngines(filePath, outputDir, options = {}) {
  const fileExt = path.extname(filePath);
  const baseName = path.basename(filePath, fileExt);
  const outputBasePath = path.join(outputDir, `${baseName}_ocr`);
  const logFilePath = path.join(outputDir, `${baseName}_ocr_log.txt`);
  
  // Initialize log file
  fs.writeFileSync(logFilePath, `OCR Processing Log - ${new Date().toISOString()}\n`);
  
  // Log function that writes to console and log file
  const log = (message) => {
    console.log(message);
    fs.appendFileSync(logFilePath, `${message}\n`);
  };
  
  log(`Processing file: ${filePath}`);
  log(`Output base path: ${outputBasePath}`);
  
  // Engine preference order (try in this order)
  const engines = ['nanovlm', 'ocrmypdf', 'tesseract'];
  
  // Results from each engine
  const results = {};
  let successfulEngine = null;
  
  // Try each engine in order
  for (const engine of engines) {
    if (successfulEngine) break;
    
    try {
      log(`Attempting processing with ${engine}...`);
      
      let result;
      switch(engine) {
        case 'nanovlm':
          result = await processWithNanoVLM(filePath, outputBasePath, options, log);
          break;
        case 'ocrmypdf':
          result = await processWithOCRmyPDF(filePath, outputBasePath, options, log);
          break;
        case 'tesseract':
          result = await processWithTesseract(filePath, outputBasePath, options, log);
          break;
      }
      
      results[engine] = result;
      
      if (result.success) {
        log(`Successfully processed with ${engine}`);
        successfulEngine = engine;
      } else {
        log(`Failed processing with ${engine}: ${result.error}`);
      }
    } catch (error) {
      log(`Error during ${engine} processing: ${error.message}`);
      results[engine] = { 
        success: false, 
        error: error.message,
        details: error.stack
      };
    }
  }
  
  // If no engine succeeded, try emergency processing with fallback options
  if (!successfulEngine) {
    log('All engines failed. Attempting emergency processing...');
    try {
      const emergencyResult = await emergencyProcessing(filePath, outputBasePath, log);
      results.emergency = emergencyResult;
      
      if (emergencyResult.success) {
        successfulEngine = 'emergency';
      }
    } catch (err) {
      log(`Emergency processing also failed: ${err.message}`);
      results.emergency = { 
        success: false, 
        error: err.message 
      };
    }
  }
  
  // Prepare final result
  const finalResult = {
    success: !!successfulEngine,
    engine: successfulEngine,
    outputFile: successfulEngine ? results[successfulEngine].outputFile : null,
    text: successfulEngine ? results[successfulEngine].text : null,
    details: successfulEngine ? 
      `Successfully processed with ${successfulEngine}` : 
      'Failed to process with any available engine',
    errors: Object.keys(results)
      .filter(engine => !results[engine].success)
      .map(engine => ({ engine, error: results[engine].error })),
    logFile: logFilePath
  };
  
  log(`Final result: ${JSON.stringify(finalResult, null, 2)}`);
  return finalResult;
}

/**
 * Process using NanoVLM (for best quality)
 */
async function processWithNanoVLM(filePath, outputBasePath, options, log) {
  log('Starting NanoVLM processing...');
  
  try {
    // Check if NanoVLM is available
    try {
      await execPromise('pip list | grep nanovlm');
    } catch (err) {
      return { 
        success: false, 
        error: 'NanoVLM is not installed or not available' 
      };
    }
    
    const outputPdf = `${outputBasePath}.pdf`;
    const outputText = `${outputBasePath}_text.txt`;
    
    // Build NanoVLM command
    const pythonCmd = 'python3';
    const scriptPath = path.resolve(__dirname, '../python/process_with_nanovlm.py');
    
    // Handle missing script
    if (!fs.existsSync(scriptPath)) {
      log(`Warning: NanoVLM script not found at ${scriptPath}, trying built-in module...`);
      
      // Try with the module directly
      const args = [
        '-c',
        `
import sys
try:
    from nanovlm.cli import process_document
    sys.exit(process_document("${filePath}", "${outputPdf}", extract_text="${outputText}"))
except ImportError:
    print("NanoVLM module not available")
    sys.exit(1)
        `
      ];
      
      const result = await runWithPromiseAndTimeout(pythonCmd, args, OCR_TIMEOUT);
      
      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `NanoVLM module execution failed: ${result.stderr}`
        };
      }
    } else {
      // Execute the script if it exists
      const args = [
        scriptPath,
        '--input', filePath,
        '--output', outputPdf,
        '--extract-text', outputText
      ];
      
      if (options.dpi) args.push('--dpi', options.dpi.toString());
      if (options.lang) args.push('--lang', options.lang);
      
      const result = await runWithPromiseAndTimeout(pythonCmd, args, OCR_TIMEOUT);
      
      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `NanoVLM script execution failed: ${result.stderr}`
        };
      }
    }
    
    // Check if output files exist
    if (!fs.existsSync(outputPdf)) {
      return {
        success: false,
        error: 'NanoVLM did not produce output PDF file'
      };
    }
    
    // Extract text from file if it exists
    let text = '';
    if (fs.existsSync(outputText)) {
      text = fs.readFileSync(outputText, 'utf-8');
    }
    
    return {
      success: true,
      outputFile: outputPdf,
      text: text,
      engine: 'nanovlm'
    };
  } catch (error) {
    log(`NanoVLM processing error: ${error.message}`);
    return {
      success: false,
      error: `NanoVLM processing failed: ${error.message}`
    };
  }
}

/**
 * Process using OCRmyPDF (good for most documents)
 */
async function processWithOCRmyPDF(filePath, outputBasePath, options, log) {
  log('Starting OCRmyPDF processing...');
  
  try {
    // Verify OCRmyPDF is installed
    try {
      await execPromise('ocrmypdf --version');
    } catch (err) {
      return { 
        success: false, 
        error: 'OCRmyPDF is not installed or not available' 
      };
    }
    
    const outputPdf = `${outputBasePath}.pdf`;
    
    // Build OCRmyPDF command with optimized settings
    const args = [
      '--force-ocr',
      '--deskew',
      '--clean',
      '--optimize', '1',
      '--skip-big', '100',
      '--max-image-mpixels', '250',
      '--jpeg-quality', '75',
      '--pdfa-image-compression', 'jpeg',
      '--jbig2-lossy',
      '--output-type', 'pdfa'
    ];
    
    // Add language options
    if (options.lang) {
      args.push('--language', options.lang);
    } else {
      args.push('--language', 'eng+osd');
    }
    
    // Add options based on document type, if specified
    if (options.documentType === 'text') {
      args.push('--tesseract-oem', '1');
      args.push('--tesseract-pagesegmode', '1');
    } else if (options.documentType === 'invoice' || options.documentType === 'form') {
      args.push('--tesseract-oem', '1');
      args.push('--tesseract-pagesegmode', '1');
      args.push('--redo-ocr');
    } else if (options.documentType === 'image') {
      args.push('--tesseract-oem', '3');
      args.push('--tesseract-pagesegmode', '3');
      args.push('--oversample', '300');
    } else {
      // Default settings
      args.push('--tesseract-oem', '3');
      args.push('--tesseract-pagesegmode', '1');
    }
    
    // Add output paths
    args.push(filePath);
    args.push(outputPdf);
    
    // Run OCRmyPDF with timeout
    const result = await runWithPromiseAndTimeout('ocrmypdf', args, OCR_TIMEOUT);
    
    if (result.exitCode !== 0) {
      return {
        success: false,
        error: `OCRmyPDF execution failed: ${result.stderr}`
      };
    }
    
    // Check if output file exists
    if (!fs.existsSync(outputPdf)) {
      return {
        success: false,
        error: 'OCRmyPDF did not produce output PDF file'
      };
    }
    
    // Extract text from PDF
    const textOutputPath = `${outputBasePath}_text.txt`;
    try {
      await execPromise(`pdftotext "${outputPdf}" "${textOutputPath}"`);
      const text = fs.existsSync(textOutputPath) ? 
        fs.readFileSync(textOutputPath, 'utf-8') : '';
      
      return {
        success: true,
        outputFile: outputPdf,
        text: text,
        engine: 'ocrmypdf'
      };
    } catch (textError) {
      log(`Warning: Could not extract text from PDF: ${textError.message}`);
      
      return {
        success: true,
        outputFile: outputPdf,
        text: 'Text extraction not available',
        engine: 'ocrmypdf'
      };
    }
  } catch (error) {
    log(`OCRmyPDF processing error: ${error.message}`);
    return {
      success: false,
      error: `OCRmyPDF processing failed: ${error.message}`
    };
  }
}

/**
 * Process using Tesseract (fallback option)
 */
async function processWithTesseract(filePath, outputBasePath, options, log) {
  log('Starting Tesseract processing...');
  
  try {
    // Verify Tesseract is installed
    try {
      await execPromise('tesseract --version');
    } catch (err) {
      return { 
        success: false, 
        error: 'Tesseract is not installed or not available' 
      };
    }
    
    // For PDF handling, first convert to images
    const isPdf = filePath.toLowerCase().endsWith('.pdf');
    const tempDir = path.join(os.tmpdir(), `tesseract_temp_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    const outputPdf = `${outputBasePath}.pdf`;
    const outputText = `${outputBasePath}_text.txt`;
    
    // Prepare tesseract options
    const lang = options.lang || 'eng';
    let psm = '1'; // Automatic page segmentation with OSD
    
    // Choose appropriate PSM based on document type
    if (options.documentType === 'text') {
      psm = '1'; // Auto with OSD (orientation detection)
    } else if (options.documentType === 'invoice' || options.documentType === 'form') {
      psm = '4'; // Assume single column of text
    } else if (options.documentType === 'image') {
      psm = '3'; // Auto page segmentation, no OSD
    }
    
    if (isPdf) {
      log('Converting PDF to images for Tesseract processing...');
      
      // Use pdftoppm for high-quality image extraction
      const dpi = options.dpi || 300;
      const imagePrefix = path.join(tempDir, 'page');
      
      await execPromise(`pdftoppm -png -r ${dpi} "${filePath}" "${imagePrefix}"`);
      
      const imageFiles = fs.readdirSync(tempDir)
        .filter(file => file.endsWith('.png'))
        .sort((a, b) => {
          // Sort by page number
          const aNum = parseInt(a.match(/(\d+)/)[1]);
          const bNum = parseInt(b.match(/(\d+)/)[1]);
          return aNum - bNum;
        })
        .map(file => path.join(tempDir, file));
      
      log(`Found ${imageFiles.length} images from PDF conversion`);
      
      // Process individual pages
      const pageOutputs = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const image = imageFiles[i];
        const pageBase = path.join(tempDir, `page_${i+1}`);
        
        log(`Processing page ${i+1} with Tesseract...`);
        
        // Run tesseract for this page
        const tesseractCmd = `tesseract "${image}" "${pageBase}" -l ${lang} --psm ${psm} pdf txt`;
        await execPromise(tesseractCmd);
        
        const pagePdf = `${pageBase}.pdf`;
        const pageTxt = `${pageBase}.txt`;
        
        if (fs.existsSync(pagePdf)) {
          pageOutputs.push({ pdf: pagePdf, txt: pageTxt });
        }
      }
      
      // Combine PDFs
      if (pageOutputs.length > 0) {
        log('Merging PDFs from individual pages...');
        const pdfPaths = pageOutputs.map(p => p.pdf).join(' ');
        
        await execPromise(`pdftk ${pdfPaths} cat output "${outputPdf}"`);
        
        // Combine text outputs
        const textContent = pageOutputs
          .filter(p => fs.existsSync(p.txt))
          .map(p => fs.readFileSync(p.txt, 'utf8'))
          .join('\n\n--- Page Break ---\n\n');
        
        fs.writeFileSync(outputText, textContent);
      }
      
      // Clean up temp files
      try {
        for (const file of fs.readdirSync(tempDir)) {
          fs.unlinkSync(path.join(tempDir, file));
        }
        fs.rmdirSync(tempDir);
      } catch (cleanErr) {
        log(`Warning: Error cleaning up temp files: ${cleanErr.message}`);
      }
    } else {
      // For non-PDF files (images), process directly
      const tesseractCmd = `tesseract "${filePath}" "${outputBasePath}" -l ${lang} --psm ${psm} pdf txt`;
      await execPromise(tesseractCmd);
    }
    
    // Check if output file exists
    if (!fs.existsSync(outputPdf)) {
      return {
        success: false,
        error: 'Tesseract did not produce output PDF file'
      };
    }
    
    // Read extracted text
    let text = '';
    if (fs.existsSync(outputText)) {
      text = fs.readFileSync(outputText, 'utf-8');
    }
    
    return {
      success: true,
      outputFile: outputPdf,
      text: text,
      engine: 'tesseract'
    };
  } catch (error) {
    log(`Tesseract processing error: ${error.message}`);
    return {
      success: false,
      error: `Tesseract processing failed: ${error.message}`
    };
  }
}

/**
 * Last-resort emergency processing
 */
async function emergencyProcessing(filePath, outputBasePath, log) {
  log('Starting emergency processing with minimal options...');
  
  const outputPdf = `${outputBasePath}_emergency.pdf`;
  
  try {
    // Try OCRmyPDF with minimal options
    try {
      await execPromise(`ocrmypdf --force-ocr --skip-text --optimize 0 "${filePath}" "${outputPdf}"`);
      if (fs.existsSync(outputPdf)) {
        return {
          success: true,
          outputFile: outputPdf,
          text: 'Emergency processing - text extraction not available',
          engine: 'emergency_ocrmypdf'
        };
      }
    } catch (ocrErr) {
      log(`Emergency OCRmyPDF failed: ${ocrErr.message}`);
    }
    
    // If that fails, try copying the original file
    try {
      fs.copyFileSync(filePath, outputPdf);
      return {
        success: true,
        outputFile: outputPdf,
        text: 'Emergency processing - original file copied',
        engine: 'emergency_copy'
      };
    } catch (copyErr) {
      log(`Emergency copy failed: ${copyErr.message}`);
    }
    
    return {
      success: false,
      error: 'All emergency processing attempts failed'
    };
  } catch (error) {
    log(`Emergency processing error: ${error.message}`);
    return {
      success: false,
      error: `Emergency processing failed: ${error.message}`
    };
  }
}

/**
 * Helper function to run commands with promise and timeout
 */
async function runWithPromiseAndTimeout(command, args, timeout) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    
    const proc = spawn(command, args);
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      try {
        proc.kill();
      } catch (err) {
        // Ignore errors when killing
      }
      reject(new Error(`Command timed out after ${timeout / 1000} seconds`));
    }, timeout);
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (exitCode) => {
      clearTimeout(timeoutId);
      resolve({
        exitCode,
        stdout,
        stderr
      });
    });
    
    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

module.exports = {
  processWithMultipleEngines,
  processWithNanoVLM,
  processWithOCRmyPDF,
  processWithTesseract
};

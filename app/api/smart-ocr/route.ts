import { NextRequest } from "next/server";
import { join } from "path";
import { writeFile, mkdir } from "fs/promises";
import fs from "fs";
import path from "path";
import { serverLogger, execAsync, createSafeSizedJsonResponse } from "@/app/api/_utils/server-utils";
import { createSafeJsonResponse } from "@/lib/server-safe-response-handler";
import { createJsonResponse } from "@/lib/utils";
import { FileHandler } from "@/lib/file-handler";
import appConfig from "@/lib/config";
import { normalizeConfidenceData } from "@/lib/confidence-utils";

// Import the HTML to PDF fallback converter
const htmlToPdfFallback = require('@/lib/html-to-pdf-fallback');

export async function POST(request: NextRequest) {
  let inputPath = "";
  let tempFiles: string[] = [];
  let outputFile = "";
  
  try {
    // Extract document type and engine preference from the request
    const formData = await request.formData();
    
    // Log all form data keys for debugging (only in development)
    const formKeys = Array.from(formData.keys());
    if (process.env.NODE_ENV === 'development') {
      serverLogger.info(`Form data keys received: ${formKeys.join(', ')}`);
    } else {
      serverLogger.debug(`Form data keys: ${formKeys.length} keys`);
    }
    
    const file = formData.get('image') as File || formData.get('file') as File;
    const documentType = formData.get('documentType') as string || 'general';
    const preferredEngine = formData.get('engine') as string;
    
    serverLogger.info(`Processing document of type: ${documentType}, preferred engine: ${preferredEngine || 'auto'}`);
    
    if (!file) {
      serverLogger.error('No file provided in form data');
      return createSafeJsonResponse({ success: false, error: 'No file provided' }, 400);
    }
    
    const fileMetadata = FileHandler.getMetadata(file);
    serverLogger.info(`File received: ${fileMetadata?.name}, size: ${fileMetadata?.size} bytes, type: ${fileMetadata?.type}`);
    
    // Save the uploaded file
    const uploadsDir = join(process.cwd(), 'uploads');
    const timestamp = Date.now();
    const fileName = FileHandler.generateFilename(file.name);
    inputPath = join(uploadsDir, fileName);
    tempFiles.push(inputPath);
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      serverLogger.info(`Created uploads directory: ${uploadsDir}`);
    }
    
    const fileBuffer = await FileHandler.toBuffer(file);
    if (!fileBuffer) {
      return createSafeJsonResponse({ success: false, error: 'Failed to process file data' }, 400);
    }
    
    await writeFile(inputPath, fileBuffer);
    serverLogger.info(`File saved to ${inputPath}`);
    
    // Ensure processed directory exists
    const processedDir = appConfig.processedDir || join(process.cwd(), 'processed');
    if (!fs.existsSync(processedDir)) {
      await mkdir(processedDir, { recursive: true });
      serverLogger.info(`Created processed directory: ${processedDir}`);
    }
    
    // Process with OCR
    const result = await processFileWithOCR(file, inputPath, processedDir, timestamp, tempFiles, fileMetadata);
    outputFile = result.outputFile;
    
    return createSafeSizedJsonResponse(result);
    
  } catch (error) {
    serverLogger.error("Error in smart-ocr:", error);
    return createSafeJsonResponse({ 
      success: false, 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  } finally {
    // Cleanup temporary files
    await cleanupTempFiles(tempFiles, outputFile);
  }
}

// Modular function to process file with OCR
async function processFileWithOCR(
  file: File, 
  inputPath: string, 
  processedDir: string, 
  timestamp: number, 
  tempFiles: string[], 
  fileMetadata: any
) {
  try {
    // Generate output filename
    const fileNameWithoutExt = path.basename(file.name, path.extname(file.name));
    const outputFile = `${fileNameWithoutExt}_ocr.pdf`;
    const outputPdfPath = join(processedDir, outputFile);
    
    // If the file is a PDF, convert it to images first
    if (file.type === 'application/pdf') {
      return await processPdfFile(inputPath, outputPdfPath, outputFile, timestamp, tempFiles, fileMetadata);
    } else {
      return await processImageFile(inputPath, outputPdfPath, outputFile, timestamp, tempFiles, fileMetadata);
    }
  } catch (error) {
    serverLogger.error("OCR processing failed:", error);
    throw error;
  }
}

// Modular function to process PDF files
async function processPdfFile(
  inputPath: string, 
  outputPdfPath: string, 
  outputFile: string, 
  timestamp: number, 
  tempFiles: string[], 
  fileMetadata: any
) {
  const uploadsDir = path.dirname(inputPath);
  const imagesDir = join(uploadsDir, `${timestamp}_images`);
  fs.mkdirSync(imagesDir, { recursive: true });
  tempFiles.push(imagesDir);
  
  // Convert PDF to images using pdftoppm (part of poppler-utils)
  await execAsync(`pdftoppm -png "${inputPath}" "${imagesDir}/page"`);
  
  // Get list of images
  const imageFiles = fs.readdirSync(imagesDir)
    .filter(f => f.endsWith('.png'))
    .map(f => join(imagesDir, f))
    .sort();
  
  if (imageFiles.length === 0) {
    throw new Error("Failed to extract images from PDF");
  }
  
  // Process each image and combine results
  const ocrTextResults = [];
  for (const imagePath of imageFiles) {
    const { stdout } = await execAsync(`tesseract "${imagePath}" stdout -l eng`);
    ocrTextResults.push(stdout);
  }
  
  // Create a PDF with the extracted text
  const combinedText = ocrTextResults.join('\n\n--- Page Break ---\n\n');
  await createPdfFromText(combinedText, outputPdfPath, timestamp, tempFiles, fileMetadata);
  
  return {
    success: true,
    text: combinedText,
    outputFile: outputFile,
    details: "Processed with Tesseract OCR",
    engine: "tesseract",
    confidence: normalizeConfidenceData(85.0).averageConfidence, // Placeholder - should be calculated from actual results
    confidenceData: {
      pageCount: imageFiles.length,
      normalizedConfidence: normalizeConfidenceData(85.0)
    }
  };
}

// Modular function to process image files
async function processImageFile(
  inputPath: string, 
  outputPdfPath: string, 
  outputFile: string, 
  timestamp: number, 
  tempFiles: string[], 
  fileMetadata: any
) {
  // For image files, process directly with Tesseract
  const { stdout } = await execAsync(`tesseract "${inputPath}" stdout -l eng`);
  
  // Create a PDF with the extracted text
  await createPdfFromText(stdout, outputPdfPath, timestamp, tempFiles, fileMetadata);
  
  return {
    success: true,
    text: stdout,
    outputFile: outputFile,
    details: "Processed with Tesseract OCR",
    engine: "tesseract",
    confidence: normalizeConfidenceData(85.0).averageConfidence, // Placeholder - should be calculated from actual results
    confidenceData: {
      pageCount: 1,
      normalizedConfidence: normalizeConfidenceData(85.0)
    }
  };
}

// Modular function to create PDF from text
async function createPdfFromText(
  text: string, 
  outputPdfPath: string, 
  timestamp: number, 
  tempFiles: string[], 
  fileMetadata: any
) {
  const uploadsDir = path.dirname(outputPdfPath).replace('processed', 'uploads');
  
  // Create a simple PDF with text
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>OCR Result</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      pre { white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <h1>OCR Result for ${fileMetadata?.name}</h1>
    <pre>${text}</pre>
  </body>
  </html>`;
  
  const htmlPath = join(uploadsDir, `${timestamp}_ocr_result.html`);
  tempFiles.push(htmlPath);
  
  await writeFile(htmlPath, htmlContent);
  
  try {
    // Use our enhanced HTML to PDF fallback converter that handles multiple methods
    const success = await htmlToPdfFallback.convertHtmlToPdf(
      htmlPath, 
      outputPdfPath, 
      `OCR Result for ${fileMetadata?.name}`
    );
    
    if (success) {
      serverLogger.info(`Successfully created PDF at ${outputPdfPath}`);
    } else {
      // Last resort if all conversion methods fail
      serverLogger.warn('All PDF conversion methods failed, creating basic text file as PDF');
      await writeFile(outputPdfPath, text);
    }
  } catch (error) {
    serverLogger.error('Error in PDF conversion:', error);
    // Final fallback
    await writeFile(outputPdfPath, text);
  }
}

// Modular function to cleanup temporary files
async function cleanupTempFiles(tempFiles: string[], outputFile: string) {
  for (const file of tempFiles) {
    if (fs.existsSync(file)) {
      try {
        if (fs.lstatSync(file).isDirectory()) {
          // Remove directory recursively using fs.rm instead of fs.rmdir
          fs.rmSync(file, { recursive: true, force: true });
        } else {
          // Only delete the file if it's not the output PDF
          if (!file.includes('_ocr.pdf')) {
            fs.unlinkSync(file);
            serverLogger.info(`Cleaned up temporary file: ${file}`);
          }
        }
      } catch (cleanupError) {
        serverLogger.warn(`Failed to cleanup file ${file}: ${cleanupError}`);
      }
    }
  }
}

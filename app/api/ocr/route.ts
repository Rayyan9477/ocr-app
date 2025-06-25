import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import path from "path"
import { existsSync } from "fs"
import logger from '../../../lib/logger.mjs';
import VLMModelManager from '../../../lib/vlm-model-manager.js'

// Configure Next.js to handle large files
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
}

// Add runtime and dynamic to force dynamic route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper function to create consistent JSON responses
const createJsonResponse = (data: any) => {
  try {
    // Sanitize any text content to ensure valid JSON
    if (data.text) {
      data.text = sanitizeOcrText(data.text);
    }
    
    const jsonString = JSON.stringify(data);
    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error('Failed to create JSON response:', error);
    // Return a minimal response if full one fails
    return new NextResponse(
      JSON.stringify({ 
        success: false, 
        error: 'Internal Server Error',
        details: 'Failed to serialize OCR result' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Add this function to sanitize OCR text
function sanitizeOcrText(text: string): string {
  if (!text) return '';
  
  try {
    return text
      // Remove control characters
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      // Replace problematic quotes and apostrophes with simple versions
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      // Replace tabs and other whitespace
      .replace(/\t/g, ' ')
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      // Limit text length if extremely long (optional)
      .substring(0, 100000); // Set a reasonable maximum length
  } catch (e) {
    logger.error('Error sanitizing OCR text:', e);
    return 'Text sanitization error';
  }
}

// Ensure upload and processed directories exist
const ensureDirectories = async () => {
  try {
    const uploadDir = join(process.cwd(), "uploads")
    const processedDir = join(process.cwd(), "processed")

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true, mode: 0o777 })
      console.log(`Created upload directory: ${uploadDir}`)
    }

    if (!existsSync(processedDir)) {
      await mkdir(processedDir, { recursive: true, mode: 0o777 })
      console.log(`Created processed directory: ${processedDir}`)
    }
  } catch (error) {
    console.error("Error ensuring directories:", error)
  }
};

// Main POST handler
export const POST = async (request: NextRequest) => {
  console.log("OCR API called with POST method (PaliGemma2-only mode)");
  let inputPath = "";
  await ensureDirectories();
  
  try {
    const formData = await request.formData();
    logger.info(`Form data keys received: ${Array.from(formData.keys()).join(', ')}`);
    
    const fileField = formData.get("file") || formData.get("image");
    if (!fileField) {
      return new NextResponse(
        JSON.stringify({ success: false, error: "No file provided" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    let fileName = 'unknown.pdf';
    let buffer;
    if (typeof fileField === 'object' && fileField !== null) {
      if ('name' in fileField && typeof fileField.name === 'string') {
        fileName = fileField.name;
      }
      if ('arrayBuffer' in fileField && typeof fileField.arrayBuffer === 'function') {
        const bytes = await fileField.arrayBuffer();
        buffer = Buffer.from(bytes);
      } else {
        return new NextResponse(
          JSON.stringify({ success: false, error: "Invalid file format" }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    
    const safeFileName = `${Date.now()}_${fileName}`;
    const uploadDir = join(process.cwd(), "uploads");
    inputPath = join(uploadDir, safeFileName);
    await writeFile(inputPath, buffer);
    console.log(`File saved: ${inputPath}`);

    // Initialize VLM Model Manager with no fallbacks
    const modelManager = new VLMModelManager({
      enableOLMOCR: true,
      fallbackToSimple: false,
      enableCloudFallback: false,
      useEnhancedIntegration: true
    });
    
    console.log('Loading PaliGemma2 model...');
    await modelManager.loadModel('paligemma2');
    
    // Get options
    const options = {
      language: formData.get("language")?.toString() || "eng",
      deskew: formData.get("deskew") === "true",
      force: formData.get("force") === "true",
      redoOcr: formData.get("redoOcr") === "true",
      removeBackground: formData.get("removeBackground") === "true",
      clean: formData.get("clean") === "true",
      optimize: formData.get("optimize") === "true",
      enableConfidenceAnalysis: formData.get("enableConfidenceAnalysis") === "true"
    };
    
    // Process with PaliGemma2
    const prompt = "<image>extract all text from this document accurately, preserving formatting and structure";
    const result = await modelManager.processImage(inputPath, prompt);
    
    // Sanitize text before returning
    const sanitizedText = sanitizeOcrText(result.text || "");
    
    return createJsonResponse({
      success: true,
      outputFile: path.basename(inputPath),
      text: sanitizedText,
      engine: "paligemma2",
      modelUsed: result.modelUsed || "PaliGemma2",
      confidence: result.confidence || 0.8,
      ...(options.enableConfidenceAnalysis ? { confidenceDetails: result.confidenceDetails } : {})
    });
    
  } catch (error) {
    logger.error(`Error in OCR PaliGemma2 route: ${error}`);
    return createJsonResponse({
      success: false,
      error: `Failed to process document with PaliGemma2: ${(error as Error).message || error}`
    });
  }
};

// Other HTTP methods
export const GET = async () => {
  return new NextResponse(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}

export const PUT = async () => {
  return new NextResponse(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}

export const DELETE = async () => {
  return new NextResponse(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}

// Support OPTIONS for CORS requests
export const OPTIONS = async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

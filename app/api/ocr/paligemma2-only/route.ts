import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import path from "path"
import { existsSync } from "fs"
import logger from "@/lib/logger"
import VLMModelManager from "@/lib/vlm-model-manager.js"

// Configure Next.js to handle large files
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
}

// Helper function to create consistent JSON responses
const createJsonResponse = (data: any) => {
  try {
    const jsonString = JSON.stringify(data);
    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error('Failed to create JSON response:', error);
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

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
    
    const file = formData.get("file") as any as File;
    if (!file) {
      return new NextResponse(
        JSON.stringify({ success: false, error: "No file provided" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const fileName = `${Date.now()}_${file.name}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = join(process.cwd(), "uploads");
    inputPath = join(uploadDir, fileName);
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
    
    // Process PDF with PaliGemma2
    const prompt = "<image>extract all text from this document accurately, preserving formatting and structure";
    const result = await modelManager.processImage(inputPath, prompt);
    
    return createJsonResponse({
      success: true,
      text: result.text || "",
      engine: "paligemma2",
      modelUsed: result.modelUsed || "PaliGemma2",
      confidence: result.confidence || 0.8
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

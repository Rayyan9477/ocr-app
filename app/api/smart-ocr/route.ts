import { NextRequest } from "next/server";
import { join } from "path";
import { writeFile } from "fs/promises";
import { serverLogger, execAsync } from "@/app/api/_utils/server-utils";
import { createJsonResponse } from "@/lib/utils";

export async function POST(request: NextRequest) {
  let inputPath = "";
  
  try {
    // Extract document type and engine preference from the request
    const formData = await request.formData();
    
    // Log all form data keys for debugging
    const formKeys = Array.from(formData.keys());
    logger.info(`Form data keys received: ${formKeys.join(', ')}`);
    
    const file = formData.get('image') as File || formData.get('file') as File;
    const documentType = formData.get('documentType') as string || 'general';
    const preferredEngine = formData.get('engine') as string;
    
    logger.info(`Processing document of type: ${documentType}, preferred engine: ${preferredEngine || 'auto'}`);
    
    if (!file) {
      logger.error('No file provided in form data');
      return createJsonResponse({ success: false, error: 'No file provided' }, 400);
    }
    
    logger.info(`File received: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
    
    // Save the uploaded file
    const uploadsDir = join(process.cwd(), 'uploads');
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    inputPath = join(uploadsDir, fileName);
    
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, fileBuffer);
    logger.info(`File saved to ${inputPath}`);
    
    // Process with NanoVLM
    try {
      const { stdout, stderr } = await execAsync(
        `${process.cwd()}/nanovlm_env/bin/python ${process.cwd()}/python/processors/nanovlm_processor.py --model_path ${process.cwd()}/models/nanovlm-222m --input "${inputPath}"`
      );
      
      return createJsonResponse({
        success: true,
        outputFile: stdout,
        details: stderr
      });
      
    } catch (error) {
      logger.error("NanoVLM processing failed:", error);
      return createJsonResponse({ 
        success: false, 
        error: "OCR processing failed",
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
    
  } catch (error) {
    logger.error("Error in smart-ocr:", error);
    return createJsonResponse({ 
      success: false, 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  } finally {
    // Cleanup uploaded file
    if (inputPath && fs.existsSync(inputPath)) {
      try {
        fs.unlinkSync(inputPath);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup uploaded file: ${cleanupError}`);
      }
    }
  }
}

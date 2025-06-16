import { type NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, stat } from "fs/promises";
import { join } from "path";
import path from "path";
import { exec } from "child_process";
import { existsSync, statSync } from "fs";
import appConfig from "@/lib/config";
import { extractConfidenceScores, saveConfidenceData, type DocumentConfidence } from "@/lib/confidence-detector";
import { multiEngineOCR } from "@/lib/multi-engine-ocr";
import logger from "@/lib/logger";
import { handleOcrError, inferOutputFilePath } from "@/lib/ocr-output-helper";
import { normalizeConfidenceData } from "@/lib/confidence-utils";
import { FileHandler } from "@/lib/file-handler";

export {}; // Ensure file is treated as a module

// Configure route segment for large files (Next.js 14 way)
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

// Helper function to create consistent JSON responses
// Add error handling to validate JSON response structure
const createJsonResponse = (data: any, status: number = 200) => {
  try {
    const jsonString = JSON.stringify(data);
    return new NextResponse(jsonString, {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error(`Failed to create JSON response: ${error}`);
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Execute command with timeout
const execWithTimeout = async (cmd: string, timeout: number = 300000) => {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const execProcess = exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${error.message}\nStderr: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    const timeoutId = setTimeout(() => {
      if (execProcess.pid) {
        try {
          process.kill(execProcess.pid);
        } catch (killError) {
          console.error("Error killing process:", killError);
        }
      }
      reject(new Error(`Command execution timed out after ${timeout / 1000} seconds`));
    }, timeout);

    execProcess.on('close', () => {
      clearTimeout(timeoutId);
    });
  });
};

// Ensure upload and processed directories exist
const ensureDirectories = async () => {
  try {
    const uploadDir = join(process.cwd(), "uploads");
    const processedDir = join(process.cwd(), "processed");

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true, mode: 0o777 });
      console.log(`Created upload directory: ${uploadDir}`);
    }

    if (!existsSync(processedDir)) {
      await mkdir(processedDir, { recursive: true, mode: 0o777 });
      console.log(`Created processed directory: ${processedDir}`);
    }
  } catch (error) {
    console.error("Error ensuring directories:", error);
  }
};

// Build OCR command
const buildOCRCommand = (inputPath: string, outputPath: string, options: any = {}) => {
  const {
    language = "eng",
    deskew = false,
    skipText = false,
    force = false,
    redoOcr = false,
    removeBackground = false,
    clean = false,
    optimize = false,
    rotate = "0"
  } = options;

  let command = `ocrmypdf `;

  // Add options
  if (language) command += `--language ${language} `;
  if (deskew) command += '--deskew ';
  if (skipText) command += '--skip-text ';
  if (force) {
    command += '--force-ocr ';
    // Always use standard PDF output for forced OCR to prevent huge file sizes
    command += '--output-type pdf ';
  }
  if (redoOcr) command += '--redo-ocr ';
  if (clean) command += '--clean ';
  if (optimize) command += '--optimize 3 ';
  if (removeBackground) command += '--remove-background ';
  
  // Add rotation if specified
  if (rotate && rotate !== '0') {
    command += `--rotate-pages `;
  }

  // Output type - use PDF instead of PDF/A for larger files to avoid bloat
  if (inputPath.endsWith('.pdf')) {
    try {
      const stats = statSync(inputPath);
      // If file is larger than 2MB, use PDF instead of PDF/A
      if (stats.size > 2 * 1024 * 1024) {
        command += '--output-type pdf ';
        console.log(`Large file detected (${Math.round(stats.size / (1024 * 1024))}MB). Using standard PDF output type.`);
      }
    } catch (err) {
      console.warn(`Could not check file size: ${err}`);
    }
  }

  // Set max image pixels to support large documents and all pages
  command += `--max-image-mpixels 0 `;

  // Add input and output paths
  command += `"${inputPath}" "${outputPath}"`;
  
  console.log(`Generated OCR command: ${command}`);
  return command;
};

// Removed handleMultiEngineFallback function as part of fallback logic removal

// Main POST handler
export async function POST(request: NextRequest) {
  logger.debug("OCR API called with POST method");
  
  let inputPath = "";
  
  await ensureDirectories();
  
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return createJsonResponse({
        success: false,
        error: "No file provided"
      }, 400);
    }
    
    // Get file data using FileHandler to avoid experimental warnings
    const fileName = file.name;
    const buffer = await FileHandler.toBuffer(file);
    
    if (!buffer) {
      return createJsonResponse({
        success: false,
        error: "Failed to process file data"
      }, 400);
    }
    
    // Determine upload path
    const uploadDir = join(process.cwd(), "uploads");
    inputPath = join(uploadDir, fileName);
    
    // Write the file to uploads directory
    await writeFile(inputPath, buffer);
    logger.debug(`File saved: ${inputPath}`);
    
    // Process OCR options from form data
    const options = {
      language: formData.get("language")?.toString() || "eng",
      deskew: formData.get("deskew") === "true",
      skipText: formData.get("skipText") === "true",
      force: formData.get("force") === "true",
      redoOcr: formData.get("redoOcr") === "true",
      removeBackground: formData.get("removeBackground") === "true",
      clean: formData.get("clean") === "true",
      optimize: formData.get("optimize") === "true",
      rotate: formData.get("rotate")?.toString() || "0"
    };
    
    // Determine output path
    const processedDir = join(process.cwd(), "processed");
    const outputPath = join(processedDir, `${path.basename(fileName, '.pdf')}_${Date.now()}_ocr.pdf`);
    
    // Build and execute OCR command
    const command = buildOCRCommand(inputPath, outputPath, options);
    logger.debug(`Starting OCR process`);
    
    try {
      const result = await execWithTimeout(command, appConfig.ocrTimeout || 600000);
      
      if (existsSync(outputPath)) {
        // Extract confidence scores if enabled
        let confidenceData: DocumentConfidence | null = null;
        if (appConfig.confidence.enableConfidenceTracking) {
          try {
            // Use the processed file for confidence analysis to get more accurate results
            confidenceData = await extractConfidenceScores(inputPath, outputPath, true);
            if (confidenceData) {
              await saveConfidenceData(confidenceData, outputPath);
            }
          } catch (confidenceError) {
            logger.warn("Failed to extract confidence scores");
          }
        }

        // Prepare response data
        const successData: any = {
          success: true,
          inputFile: fileName,
          outputFile: path.basename(outputPath),
          details: result.stderr || result.stdout,
        };
        
        // Normalize confidence
        if (confidenceData) {
          const normalizedConfidence = normalizeConfidenceData(confidenceData.averageConfidence);
          successData.confidence = normalizedConfidence.averageConfidence;
          successData.confidenceData = {
            hasLowConfidencePages: confidenceData.hasLowConfidencePages,
            warningPages: confidenceData.warningPages,
            errorPages: confidenceData.errorPages,
            pageCount: confidenceData.pageConfidences.length,
            normalizedConfidence
          };
        }
        
        // Add processingTime if available
        if (result && result.stdout) {
          // Unable to extract processing time from stdout for standard OCR
        }
        return createJsonResponse(successData);
      } else {
        throw new Error("OCR completed but output file was not created");
      }
    } catch (execError) {
      const errorMessage = execError instanceof Error ? execError.message : String(execError);
      logger.error(`OCR execution failed: ${errorMessage}`);
      
      // Check if output file was created despite error
      if (existsSync(outputPath)) {
        // Extract confidence scores even for partial success if enabled
        let confidenceData: DocumentConfidence | null = null;
        if (appConfig.confidence.enableConfidenceTracking) {
          try {
            confidenceData = await extractConfidenceScores(inputPath, outputPath);
            if (confidenceData) {
              await saveConfidenceData(confidenceData, outputPath);
            }
          } catch (confidenceError) {
            logger.warn("Failed to extract confidence scores for partial success");
          }
        }

        return createJsonResponse({
          success: true,
          inputFile: fileName,
          outputFile: path.basename(outputPath),
          warning: "OCR completed with warnings",
          details: errorMessage,
          confidence: confidenceData ? normalizeConfidenceData(confidenceData.averageConfidence).averageConfidence : undefined,
          confidenceData: confidenceData ? {
            hasLowConfidencePages: confidenceData.hasLowConfidencePages,
            warningPages: confidenceData.warningPages,
            errorPages: confidenceData.errorPages,
            pageCount: confidenceData.pageConfidences.length,
            normalizedConfidence: confidenceData.averageConfidence
          } : undefined
        });
      }
      
      // Return error response for failed OCR
      return createJsonResponse({
        success: false,
        error: "OCR processing failed",
        details: errorMessage,
        inputFile: fileName
      }, 500);
    }
  } catch (error) {
    console.error("Unexpected error during OCR process:", error);
    
    return createJsonResponse({
      success: false,
      error: "Unexpected system error during OCR processing",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

// Other HTTP methods
export async function GET() {
  return createJsonResponse({ success: false, error: "Method Not Allowed" }, 405);
}

export async function PUT() {
  return createJsonResponse({ success: false, error: "Method Not Allowed" }, 405);
}

export async function DELETE() {
  return createJsonResponse({ success: false, error: "Method Not Allowed" }, 405);
}

// Support OPTIONS for CORS requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

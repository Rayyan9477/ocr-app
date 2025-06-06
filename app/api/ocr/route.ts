import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, stat } from "fs/promises"
import { join } from "path"
import path from "path"
import { exec } from "child_process"
import { existsSync, statSync } from "fs"
import appConfig from "@/lib/config"
import { extractConfidenceScores, saveConfidenceData, type DocumentConfidence } from "@/lib/confidence-detector"
import { multiEngineOCR } from "@/lib/multi-engine-ocr"
import logger from "@/lib/logger"
import { handleOcrError, inferOutputFilePath } from "@/lib/ocr-output-helper"

// Configure Next.js to handle large files
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
}
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
    logger.error('Failed to create JSON response:', error);
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

  // Note: OCRmyPDF processes all pages by default, no need for --pages parameter

  // Add input and output paths
  command += `"${inputPath}" "${outputPath}"`;
  
  console.log(`Generated OCR command: ${command}`);
  return command;
};

// Main POST handler
export const POST = async (request: NextRequest) => {
  console.log("OCR API called with POST method");
  
  let inputPath = "";
  
  await ensureDirectories();
  
  try {
    const formData = await request.formData();
    const file = formData.get("file") as any as File;
    
    if (!file) {
      return createJsonResponse({
        success: false,
        error: "No file provided"
      }, 400);
    }
    
    // Get file data
    const fileName = file.name;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Determine upload path
    const uploadDir = join(process.cwd(), "uploads");
    inputPath = join(uploadDir, fileName);
    
    // Write the file to uploads directory
    await writeFile(inputPath, buffer);
    console.log(`File saved: ${inputPath}`);
    
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
    console.log(`Starting OCR process: ${command}`);
    
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
            console.warn("Failed to extract confidence scores:", confidenceError);
          }
        }

        return createJsonResponse({
          success: true,
          inputFile: fileName,
          outputFile: path.basename(outputPath),
          details: result.stderr || result.stdout,
          confidence: confidenceData ? {
            averageConfidence: confidenceData.averageConfidence,
            hasLowConfidencePages: confidenceData.hasLowConfidencePages,
            warningPages: confidenceData.warningPages,
            errorPages: confidenceData.errorPages,
            pageCount: confidenceData.pageConfidences.length
          } : undefined
        });
      } else {
        throw new Error("OCR completed but output file was not created");
      }
    } catch (execError) {
      console.error("OCR execution failed:", execError);
      
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
            console.warn("Failed to extract confidence scores for partial success:", confidenceError);
          }
        }

        return createJsonResponse({
          success: true,
          inputFile: fileName,
          outputFile: path.basename(outputPath),
          warning: "OCR completed with warnings",
          details: execError instanceof Error ? execError.message : String(execError),
          confidence: confidenceData ? {
            averageConfidence: confidenceData.averageConfidence,
            hasLowConfidencePages: confidenceData.hasLowConfidencePages,
            warningPages: confidenceData.warningPages,
            errorPages: confidenceData.errorPages,
            pageCount: confidenceData.pageConfidences.length
          } : undefined
        });
      }
      
      // Handle OCR failure with our error handler
      const errorMessage = execError instanceof Error ? execError.message : String(execError);
      
      // Check for specific error about page already having text first
      if ((errorMessage.includes('page already has text') || errorMessage.includes('PriorOcrFoundError')) && !options.force) {
        console.log("Detected document with existing text. Retrying with --force-ocr option...");
        
        // Create a new command with force-ocr enabled and PDF output type to avoid bloat
        const retryOptions = { ...options, force: true };
        const retryOutputPath = join(
          process.cwd(),
          "processed",
          `${path.basename(fileName, '.pdf')}_${Date.now()}_forced_ocr.pdf`
        );
        
        const retryCommand = buildOCRCommand(inputPath, retryOutputPath, retryOptions);
        console.log(`Retrying OCR with force option: ${retryCommand}`);
        
        try {
          // Execute the retry command
          const retryResult = await execWithTimeout(retryCommand, appConfig.ocrTimeout || 600000);
          
          if (existsSync(retryOutputPath)) {
            // Extract confidence scores for retry output if enabled
            let retryConfidenceData: DocumentConfidence | null = null;
            if (appConfig.confidence.enableConfidenceTracking) {
              try {
                // Use the processed file for confidence analysis
                retryConfidenceData = await extractConfidenceScores(inputPath, retryOutputPath, true);
                if (retryConfidenceData) {
                  await saveConfidenceData(retryConfidenceData, retryOutputPath);
                }
              } catch (confidenceError) {
                console.warn("Failed to extract confidence scores for retry:", confidenceError);
              }
            }

            // Successful retry with force option
            return createJsonResponse({
              success: true,
              inputFile: fileName,
              outputFile: path.basename(retryOutputPath),
              details: "Successfully processed with force-ocr option",
              details: "Document had existing text layer. Successfully processed with --force-ocr option.",
              warnings: retryResult.stderr || undefined,
              confidence: retryConfidenceData ? {
                averageConfidence: retryConfidenceData.averageConfidence,
                hasLowConfidencePages: retryConfidenceData.hasLowConfidencePages,
                warningPages: retryConfidenceData.warningPages,
                errorPages: retryConfidenceData.errorPages,
                pageCount: retryConfidenceData.pageConfidences.length
              } : undefined
            });
          }
        } catch (retryError) {
          console.error("OCR retry with force option failed:", retryError);
          return createJsonResponse({
            success: false,
            error: "OCR process failed even with force option",
            inputFile: fileName,
            details: retryError instanceof Error ? retryError.message : String(retryError)
          }, 500);
        }
      }
      
      // Try multi-engine OCR as fallback when primary OCR fails
      logger.info(`Primary OCR failed for ${fileName}, attempting multi-engine fallback`);
      
      try {
        const fallbackOutputDir = join(process.cwd(), "processed", `fallback_${Date.now()}`);
        await mkdir(fallbackOutputDir, { recursive: true });
        
        const ensembleResult = await multiEngineOCR.processWithEnsemble(
          inputPath,
          fallbackOutputDir,
          options.language,
          false, // Don't use preprocessing for fallback to save time
          true   // Use auto-customization
        );
        
        if (ensembleResult.hasSuccessfulResults && ensembleResult.bestResult.outputPath) {
          // Move the successful result to standard processed directory
          const fallbackFinalPath = join(
            process.cwd(),
            "processed",
            `${path.basename(fileName, '.pdf')}_${Date.now()}_fallback_ocr.pdf`
          );
          
          // Copy the result file
          await import('fs/promises').then(fs => 
            fs.copyFile(ensembleResult.bestResult.outputPath!, fallbackFinalPath)
          );
          
          // Extract confidence scores for fallback result if enabled
          let fallbackConfidenceData: DocumentConfidence | null = null;
          if (appConfig.confidence.enableConfidenceTracking) {
            try {
              fallbackConfidenceData = await extractConfidenceScores(inputPath, fallbackFinalPath, true);
              if (fallbackConfidenceData) {
                await saveConfidenceData(fallbackConfidenceData, fallbackFinalPath);
              }
            } catch (confidenceError) {
              logger.warn("Failed to extract confidence scores for fallback result:", confidenceError);
            }
          }
          
          return createJsonResponse({
            success: true,
            inputFile: fileName,
            outputFile: path.basename(fallbackFinalPath),
            engine: ensembleResult.bestResult.engine,
            warning: "Primary OCR failed, succeeded with multi-engine fallback",
            details: `Fallback used ${ensembleResult.successCount}/${ensembleResult.allResults.length} engines successfully`,
            engines: {
              used: ensembleResult.allResults.map(r => r.engine),
              successful: ensembleResult.allResults.filter(r => r.success).map(r => r.engine),
              failed: ensembleResult.allResults.filter(r => !r.success).map(r => r.engine)
            },
            customizationApplied: ensembleResult.customizationApplied,
            confidence: fallbackConfidenceData ? {
              averageConfidence: fallbackConfidenceData.averageConfidence,
              hasLowConfidencePages: fallbackConfidenceData.hasLowConfidencePages,
              warningPages: fallbackConfidenceData.warningPages,
              errorPages: fallbackConfidenceData.errorPages,
              pageCount: fallbackConfidenceData.pageConfidences.length
            } : undefined
          });
        } else {
          logger.error(`Multi-engine fallback also failed for ${fileName}`);
          return createJsonResponse({
            success: false,
            error: "Both primary OCR and multi-engine fallback failed",
            inputFile: fileName,
            details: {
              primaryError: errorMsg,
              fallbackEngines: ensembleResult.allResults.map(r => ({
                engine: r.engine,
                error: r.error
              }))
            }
          }, 500);
        }
      } catch (fallbackError) {
        logger.error("Multi-engine fallback failed with exception:", fallbackError);
        return createJsonResponse({
          success: false,
          error: "Both primary OCR and multi-engine fallback failed",
          inputFile: fileName,
          details: {
            primaryError: errorMsg,
            fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          }
        }, 500);
      }
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
export const GET = async () => {
  return createJsonResponse({ success: false, error: "Method Not Allowed" }, 405);
}

export const PUT = async () => {
  return createJsonResponse({ success: false, error: "Method Not Allowed" }, 405);
}

export const DELETE = async () => {
  return createJsonResponse({ success: false, error: "Method Not Allowed" }, 405);
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

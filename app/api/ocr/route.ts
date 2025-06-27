import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, stat, unlink } from "fs/promises"
import { join } from "path"
import path from "path"
import { exec } from "child_process"
import { existsSync, statSync } from "fs"
import appConfig from "@/lib/config"
import { extractConfidenceScores, saveConfidenceData, type DocumentConfidence } from "@/lib/confidence-detector"
import { multiEngineOCR } from "@/lib/multi-engine-ocr"
import logger from "@/lib/logger"

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
    // Validate and sanitize the data first
    const validatedData = validateJsonData(data);
    const sanitizedData = sanitizeDataForJson(validatedData);
    
    // Final JSON validation check before sending
    let responseString: string;
    try {
      responseString = JSON.stringify(sanitizedData);
      // Verify it can be parsed back (safety check)
      JSON.parse(responseString);
    } catch (jsonStringifyError) {
      // If still failing, create an extremely minimal response
      logger.error(`Final JSON stringify failed: ${jsonStringifyError instanceof Error ? jsonStringifyError.message : String(jsonStringifyError)}`);
      responseString = JSON.stringify({
        success: false,
        error: 'Fatal error creating JSON response',
        timestamp: new Date().toISOString()
      });
    }
    
    return new NextResponse(responseString, {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error(`Failed to create JSON response: ${error instanceof Error ? error.message : String(error)}`);
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Helper function to validate JSON before sending response
const validateJsonData = (data: any): any => {
  try {
    // Test if the data can be serialized and parsed
    const jsonString = JSON.stringify(data);
    const parsed = JSON.parse(jsonString);
    return parsed;
  } catch (error) {
    logger.error(`JSON validation failed: ${error instanceof Error ? error.message : String(error)}`);
    
    // Try to identify and fix the problematic fields
    if (typeof data === 'object' && data !== null) {
      const safeData: any = {};
      
      // Create a safe copy of the data, sanitizing problematic fields
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.length > 100) {
          // Aggressively sanitize long string values that might cause issues
          safeData[key] = truncateTextForResponse(value, 100);
        } else if (typeof value === 'object' && value !== null) {
          // For nested objects, just use a simple placeholder
          safeData[key] = typeof Array.isArray(value) ? [] : { summary: 'Complex data omitted for safety' };
        } else {
          // For primitives and short strings, keep as is
          safeData[key] = value;
        }
      }
      
      // Add safe fields
      safeData.success = false;
      safeData.error = 'Response data validation failed';
      safeData.details = 'The server response could not be properly formatted as JSON';
      
      return safeData;
    }
    
    // Return a safe fallback if data isn't an object
    return {
      success: false,
      error: 'Response data validation failed',
      details: 'The server response could not be properly formatted as JSON'
    };
  }
};

// Helper function to sanitize data for JSON safety
const sanitizeDataForJson = (data: any): any => {
  if (data === null || data === undefined) return data;
  
  if (typeof data === 'string') {
    // Use truncateTextForResponse with a larger maxLength for data objects
    return truncateTextForResponse(data, 10000);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeDataForJson(item));
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeDataForJson(value);
    }
    return sanitized;
  }
  
  return data;
};

// Helper function to sanitize text for JSON safety
const sanitizeTextForJson = (text: string): string => {
  if (!text) return '';
  
  try {
    // First handle multi-level escaped backslashes and sequences that can cause JSON issues
    let sanitized = text;
    
    // Handle triple and double escaped sequences - must be done in order from most escaped to least
    sanitized = sanitized
      .replace(/\\\\\\n/g, '\\n')
      .replace(/\\\\\\r/g, '\\r')
      .replace(/\\\\\\t/g, '\\t')
      .replace(/\\\\\\"/g, '\\"')
      .replace(/\\\\\\\\/g, '\\\\')
      // Now handle double escaped sequences
      .replace(/\\\\n/g, '\n')
      .replace(/\\\\r/g, '\r')
      .replace(/\\\\t/g, '\t')
      .replace(/\\\\\\/g, '\\')
      // Handle any normal escaped sequences
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
      
    // Remove control characters except newlines, tabs, and carriage returns
    sanitized = sanitized
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      
      // Replace problematic quotes and apostrophes with simple versions
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      
      // Replace tabs with spaces in most contexts
      .replace(/\t/g, ' ')
      
      // Normalize multiple spaces
      .replace(/\s+/g, ' ');
    
    // Extra safety - specifically handle backslash sequences that might cause issues
    sanitized = sanitized
      .replace(/\\\\/g, '\\')  // Convert double backslashes to single
      .replace(/\\"/g, '"')    // Convert escaped quotes to regular quotes
      .replace(/\\'/g, "'")    // Convert escaped single quotes to regular single quotes
      .replace(/\\([^nrt\\"])/g, '$1'); // Remove unnecessary escapes

    // Final JSON validation check
    try {
      const testObj = { text: sanitized };
      const serialized = JSON.stringify(testObj);
      JSON.parse(serialized); // This will throw if invalid
    } catch (jsonError) {
      // If there's still a JSON issue, use more aggressive sanitization
      logger.warn('JSON validation failed after initial sanitization, applying more aggressive cleaning');
      // Fall back to ASCII-only content with safe newlines
      sanitized = sanitized
        .replace(/[^\x20-\x7E\n]/g, '')
        .trim();
      
      // One more validation attempt
      try {
        JSON.stringify({ text: sanitized });
      } catch (finalError) {
        // If still failing, return a very safe fallback
        logger.error(`Critical JSON sanitization failure: ${finalError instanceof Error ? finalError.message : String(finalError)}`);
        return 'Text content unavailable due to encoding issues';
      }
    }
    
    return sanitized.trim();
  } catch (e) {
    logger.error(`Error sanitizing text: ${e instanceof Error ? e.message : String(e)}`);
    return 'Text sanitization error';
  }
};

// Helper function to truncate and sanitize text for JSON responses
const truncateTextForResponse = (text: string, maxLength: number = 300): string => {
  if (!text) {
    return '';
  }
  
  try {
    // Handle excessively large text content
    const truncated = text.length <= maxLength
      ? text
      : text.substring(0, maxLength) + '... [truncated - full text available in output file]';
    
    // Always sanitize after truncation to ensure JSON safety
    return sanitizeTextForJson(truncated);
  } catch (error) {
    logger.error(`Error truncating text for response: ${error instanceof Error ? error.message : String(error)}`);
    return 'Text truncation error - content available in output file';
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
export async function POST(request: NextRequest) {
  console.log("OCR API called with POST method");
  
  let inputPath = "";
  
  await ensureDirectories();
  
  try {
    const formData = await request.formData();
    const file = formData.get("file") as any as File;
    
    if (!file) {
      return createJsonResponse({
        success: false,
        error: "No file provided",
        timestamp: new Date().toISOString()
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
      
      // Check for specific error about page already having text
      const errorMsg = execError instanceof Error ? execError.message : String(execError);
      if ((errorMsg.includes('page already has text') || errorMsg.includes('PriorOcrFoundError')) && !options.force) {
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

            return createJsonResponse({
              success: true,
              inputFile: fileName,
              outputFile: path.basename(retryOutputPath),
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
          try {
            if (appConfig.confidence?.enableConfidenceTracking) {
              // Create a temporary output path for confidence extraction
              const tempOutputPath = join(process.cwd(), 'temp', `confidence_${Date.now()}`);
              await mkdir(tempOutputPath, { recursive: true });
              
              try {
                fallbackConfidenceData = await extractConfidenceScores(fallbackFinalPath, tempOutputPath);
                if (fallbackConfidenceData) {
                  await saveConfidenceData(fallbackConfidenceData, fallbackFinalPath);
                }
              } catch (confidenceError) {
                logger.warn(`Failed to process confidence data: ${confidenceError instanceof Error ? confidenceError.message : String(confidenceError)}`);
              }
            }
          } catch (confidenceError) {
            logger.warn(`Failed to extract confidence scores for fallback result: ${confidenceError instanceof Error ? confidenceError.message : String(confidenceError)}`);
          }

          // Return success response for fallback result
          return createJsonResponse({
            success: true,
            inputFile: fileName,
            outputFile: path.basename(fallbackFinalPath),
            details: "Document processed successfully using fallback OCR engine",
            confidence: fallbackConfidenceData ? {
              averageConfidence: fallbackConfidenceData.averageConfidence,
              hasLowConfidencePages: fallbackConfidenceData.hasLowConfidencePages,
              warningPages: fallbackConfidenceData.warningPages,
              errorPages: fallbackConfidenceData.errorPages,
              pageCount: fallbackConfidenceData.pageConfidences.length
            } : undefined
          });
        }

        // If we get here, the fallback also failed
        return createJsonResponse({
          success: false,
          error: "All OCR attempts failed",
          inputFile: fileName,
          details: "Tried primary and fallback OCR engines but all attempts failed"
        }, 500);
      } catch (fallbackError) {
        logger.error(`Fallback OCR processing failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        
        return createJsonResponse({
          success: false,
          error: "Fallback OCR processing failed",
          inputFile: fileName,
          details: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        }, 500);
      }
    } finally {
      // Clean up temporary files
      if (inputPath && existsSync(inputPath)) {
        try {
          await unlink(inputPath);
        } catch (cleanupError: unknown) {
          const errorMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
          logger.warn(`Failed to clean up input file: ${errorMessage}`);
        }
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error in OCR processing: ${errorMessage}`);
    
    return createJsonResponse({
      success: false,
      error: "OCR processing failed",
      details: errorMessage
    }, 500);
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, stat } from "fs/promises"
import { join } from "path"
import path from "path"
import { exec } from "child_process"
import { existsSync, statSync } from "fs"
import appConfig from "@/lib/config"

// Configure Next.js to handle large files
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
}
// Helper function to create consistent JSON responses
const createJsonResponse = (data: any, status: number = 200) => {
  return new NextResponse(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      }
    }
  );
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

  // Set max image pixels to support large documents
  command += `--max-image-mpixels 0 `;

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
        return createJsonResponse({
          success: true,
          inputFile: fileName,
          outputFile: path.basename(outputPath),
          details: result.stderr || result.stdout
        });
      } else {
        throw new Error("OCR completed but output file was not created");
      }
    } catch (execError) {
      console.error("OCR execution failed:", execError);
      
      // Check if output file was created despite error
      if (existsSync(outputPath)) {
        return createJsonResponse({
          success: true,
          inputFile: fileName,
          outputFile: path.basename(outputPath),
          warning: "OCR completed with warnings",
          details: execError instanceof Error ? execError.message : String(execError)
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
            return createJsonResponse({
              success: true,
              inputFile: fileName,
              outputFile: path.basename(retryOutputPath),
              details: "Document had existing text layer. Successfully processed with --force-ocr option.",
              warnings: retryResult.stderr || undefined
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
      
      return createJsonResponse({
        success: false,
        error: "OCR process failed",
        inputFile: fileName,
        details: errorMsg
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

import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, readFile, unlink, stat } from "fs/promises"
import { join, resolve } from "path"
import { exec } from "child_process"
import { existsSync } from "fs"
import appConfig from "@/lib/config"
import logger from "@/lib/logger"

// Configure Next.js to handle large files
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
}

// Add a helper function to create consistent JSON responses
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
}

// Add timeout to command execution
const maxExecutionTime = appConfig.ocrTimeout;
const execWithTimeout = async (cmd: string, timeout: number) => {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const execOptions = {
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true
    };

    const isWindows = process.platform === 'win32';
    const finalCmd = isWindows ? cmd : cmd;

    const execProcess = exec(finalCmd, execOptions, (error: any, stdout: string, stderr: string) => {
      if (error) {
        error.message = `Command execution failed: ${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });

    // Set timeout
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

    execProcess.stderr?.on('data', (data) => {
      console.log(`OCRmyPDF stderr: ${data}`);
    });
  });
};

// Ensure upload and processed directories exist with proper permissions
const ensureDirectories = async () => {
  try {
    const uploadDir = join(process.cwd(), "uploads")
    const processedDir = join(process.cwd(), "processed")

    // Create directories if they don't exist
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true, mode: 0o777 })
      console.log(`Created upload directory: ${uploadDir}`)
    } else {
      // Try to set permissions on existing directory if possible (works in most environments)
      try {
        // For systems that support chmod
        const { exec: execCallback } = await import('child_process');
        const { promisify } = await import('util');
        const execPromise = promisify(execCallback);
        await execPromise(`chmod -R 777 "${uploadDir}"`);
        console.log(`Updated permissions for upload directory: ${uploadDir}`);
      } catch (chmodError) {
        console.log(`Note: Could not update permissions for ${uploadDir}. This is expected in some environments.`);
      }
    }

    if (!existsSync(processedDir)) {
      await mkdir(processedDir, { recursive: true, mode: 0o777 })
      console.log(`Created processed directory: ${processedDir}`)
    } else {
      // Try to set permissions on existing directory if possible
      try {
        // For systems that support chmod
        const { exec: execCallback } = await import('child_process');
        const { promisify } = await import('util');
        const execPromise = promisify(execCallback);
        await execPromise(`chmod -R 777 "${processedDir}"`);
        console.log(`Updated permissions for processed directory: ${processedDir}`);
      } catch (chmodError) {
        console.log(`Note: Could not update permissions for ${processedDir}. This is expected in some environments.`);
      }
    }

    // Check if directories are writable
    try {
      const testFile = join(uploadDir, "test-write-permission.txt")
      await writeFile(testFile, "test")
      await unlink(testFile)
      console.log("Upload directory is writable")
    } catch (error) {
      console.error("Upload directory is not writable:", error)
      throw new Error("Upload directory is not writable")
    }

    try {
      const testFile = join(processedDir, "test-write-permission.txt")
      await writeFile(testFile, "test")
      await unlink(testFile)
      console.log("Processed directory is writable")
    } catch (error) {
      console.error("Processed directory is not writable:", error)
      throw new Error("Processed directory is not writable")
    }

    return { uploadDir, processedDir }
  } catch (error) {
    console.error("Error ensuring directories:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  logger.info("OCR API route called", { context: "ocr-api" })

  try {
    const { uploadDir, processedDir } = await ensureDirectories()
    logger.debug("Directories ensured", { 
      context: "ocr-api", 
      data: { uploadDir, processedDir } 
    })

    let formData;
    try {
      formData = await request.formData();
      logger.debug("Form data parsed successfully", { context: "ocr-api" });
    } catch (formError) {
      logger.logError(formError as Error, "Error parsing form data", { 
        context: "ocr-api",
        data: { 
          contentType: request.headers.get('content-type'),
          method: request.method
        }
      });
      
      return createJsonResponse({
        success: false,
        error: "Failed to parse form data",
        details: (formError as Error).message
      }, 400);
    }

    const file = formData.get("file")
    if (!file || !(file instanceof File)) {
      console.error("No file or invalid file provided")
      return createJsonResponse({
        success: false,
        error: "No valid file provided",
        details: "Please provide a valid PDF file"
      }, 400)
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      console.error(`Invalid file type: ${file.type}`);
      return createJsonResponse({
        success: false,
        error: "Only PDF files are supported",
        details: `File type: ${file.type}`
      }, 400);
    }

    // Also validate file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'pdf') {
      console.error(`Invalid file extension: ${fileExt}`);
      return createJsonResponse({
        success: false,
        error: "Only PDF files are supported",
        details: `File extension: ${fileExt}`
      }, 400);
    }

    if (file.size > appConfig.maxUploadSize * 1024 * 1024) {
      console.error(`File too large: ${file.size} bytes`);
      return createJsonResponse({
        success: false,
        error: `File too large, maximum size is ${appConfig.maxUploadSize}MB`,
        details: `File size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`
      }, 400);
    }

    console.log(`File received: ${file.name}, size: ${file.size} bytes`)

    // Get command options from form data
    const language = (formData.get("language") as string) || appConfig.defaultLanguage
    const deskew = formData.get("deskew") === "true"
    const skipText = formData.get("skipText") === "true"
    const force = formData.get("force") === "true"
    const redoOcr = formData.get("redoOcr") === "true"
    const removeBackground = formData.get("removeBackground") === "true"
    const clean = formData.get("clean") === "true"
    const optimize = Number.parseInt((formData.get("optimize") as string) || "3")
    const rotate = (formData.get("rotate") as string) || "auto"
    const pdfRenderer = (formData.get("pdfRenderer") as string) || "auto"

    const timestamp = Date.now()
    const originalFilename = file.name
    const baseFilename = originalFilename
      .replace(/\.pdf$/i, '')
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 100)

    const safeFilename = `${baseFilename}_${timestamp}`
    const inputFilePath = `${safeFilename}.${fileExt}`
    const outputFilePath = `${safeFilename}_ocr.pdf`

    console.log(`Original filename: ${originalFilename}`)
    console.log(`Sanitized filename: ${safeFilename}.${fileExt}`)
    console.log("File paths:", { inputFilePath, outputFilePath })

    try {
      console.log("Starting file conversion to buffer...");
      let bytes;
      try {
        bytes = await file.arrayBuffer();
        console.log(`Successfully converted file to ArrayBuffer: ${bytes.byteLength} bytes`);
      } catch (arrayBufferError) {
        console.error("Error converting file to ArrayBuffer:", arrayBufferError);
        return createJsonResponse({
          success: false,
          error: "Failed to process file data",
          details: (arrayBufferError as Error).message
        }, 500);
      }

      const buffer = Buffer.from(bytes);
      const inputPath = join(uploadDir, inputFilePath);
      const outputPath = join(processedDir, outputFilePath);

      try {
        await writeFile(inputPath, buffer);
        console.log(`File saved to ${inputPath}`);
      } catch (writeError) {
        console.error("Error writing file to disk:", writeError);
        return createJsonResponse({
          success: false,
          error: "Failed to save file to disk",
          details: (writeError as Error).message
        }, 500);
      }

      const command = await buildOCRCommand({
        inputPath,
        outputPath,
        language,
        deskew,
        skipText,
        force,
        redoOcr,
        removeBackground,
        clean,
        optimize,
        rotate,
        pdfRenderer
      });

      console.log(`Executing command: ${command}`);

      try {
        const { stdout, stderr } = await execWithTimeout(command, maxExecutionTime);
        console.log("OCR process completed");

        if (!existsSync(outputPath)) {
          throw new Error(`OCR process completed but output file was not created: ${outputPath}`);
        }

        const outputStats = await stat(outputPath);
        if (outputStats.size === 0) {
          throw new Error("Output file was created but has zero size");
        }

        const MAX_LOG_LENGTH = 10000;
        const truncatedStdout = stdout.length > MAX_LOG_LENGTH
          ? stdout.substring(0, MAX_LOG_LENGTH) + "... [truncated]"
          : stdout;
        const truncatedStderr = stderr.length > MAX_LOG_LENGTH
          ? stderr.substring(0, MAX_LOG_LENGTH) + "... [truncated]"
          : stderr;

        // Check if jbig2 was used in processing
        const jbig2Used = stdout.toLowerCase().includes('jbig2') || 
                         !stderr.toLowerCase().includes('jbig2 not found');
        
        // Calculate optimization metrics if available
        const inputStats = existsSync(inputPath) ? await stat(inputPath) : null;
        const optimizationRate = inputStats ? 
          Math.round((1 - (outputStats.size / inputStats.size)) * 100) : null;
        
        return createJsonResponse({
          success: true,
          inputFile: inputFilePath,
          outputFile: outputFilePath,
          fileSize: outputStats.size,
          stdout: truncatedStdout,
          stderr: truncatedStderr,
          command,
          timestamp: new Date().toISOString(),
          optimization: {
            jbig2Used,
            inputSize: inputStats?.size,
            outputSize: outputStats.size,
            reductionPercent: optimizationRate,
            jbig2Path: jbig2Used ? appConfig.jbig2Path : null
          }
        });
      } catch (execError: any) {
        console.error("Error executing OCRmyPDF:", execError);
        const errorMessage = execError.message || String(execError);
        const stderrOutput = execError.stderr || '';

        if (stderrOutput.toLowerCase().includes('already contains text')) {
          return createJsonResponse({
            success: false,
            errorType: 'has_text',
            error: 'PDF already contains text',
            details: errorMessage
          }, 400);
        }

        if (stderrOutput.toLowerCase().includes('tagged pdf')) {
          return createJsonResponse({
            success: false,
            errorType: 'tagged_pdf',
            error: 'PDF is a tagged PDF',
            details: errorMessage
          }, 400);
        }

        return createJsonResponse({
          success: false,
          error: 'OCR process failed',
          details: errorMessage
        }, 500);
      }
    } catch (error) {
      console.error("Unexpected error during OCR process:", error);
      return createJsonResponse({
        success: false,
        error: "OCR process failed",
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  } catch (error) {
    console.error("Unhandled error in OCR API route:", error);
    return createJsonResponse({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

// Helper function to build OCR command
async function buildOCRCommand({
  inputPath,
  outputPath,
  language,
  deskew,
  skipText,
  force,
  redoOcr,
  removeBackground,
  clean,
  optimize,
  rotate,
  pdfRenderer
}: {
  inputPath: string;
  outputPath: string;
  language: string;
  deskew: boolean;
  skipText: boolean;
  force: boolean;
  redoOcr: boolean;
  removeBackground: boolean;
  clean: boolean;
  optimize: number;
  rotate: string;
  pdfRenderer: string;
}) {
  const isWindows = process.platform === 'win32';
  const escapedInputPath = isWindows ? inputPath : inputPath.replace(/ /g, '\\ ');
  const escapedOutputPath = isWindows ? outputPath : outputPath.replace(/ /g, '\\ ');

  let command = `ocrmypdf`;

  if (language !== "eng") {
    command += ` --language ${language}`;
  }
  if (deskew) {
    command += ` --deskew`;
  }
  if (skipText) {
    command += ` --skip-text`;
  }
  if (force) {
    command += ` --force-ocr`;
  }
  if (redoOcr) {
    command += ` --redo-ocr`;
  }
  if (removeBackground) {
    command += ` --remove-background`;
  }
  if (clean) {
    command += ` --clean`;
  }
  if (optimize > 0) {
    command += ` --optimize ${optimize}`;
  }
  if (rotate !== "auto") {
    command += ` --rotate-pages ${rotate}`;
  }
  if (pdfRenderer !== "auto") {
    command += ` --pdf-renderer ${pdfRenderer}`;
  }

  // Check if jbig2 is available and disable optimization if not
  try {
    // Starting with the config path, check multiple possible locations for jbig2
    const localSourceBuild = join(process.cwd(), 'jbig2enc/src/jbig2');
    const jbig2Paths = [
      appConfig.jbig2Path,
      localSourceBuild,
      '/usr/local/bin/jbig2',
      '/usr/bin/jbig2',
      'jbig2' // Let the system find it in PATH
    ];
    
    let jbig2Found = false;
    let workingPath = '';
    let jbig2Version = '';
    
    for (const path of jbig2Paths) {
      try {
        // Skip duplicate paths
        if (path === workingPath) continue;
        
        const { stdout } = await execWithTimeout(`"${path}" --version`, 2000);
        if (!stdout.includes('not found')) {
          jbig2Found = true;
          workingPath = path;
          jbig2Version = stdout.trim();
          break;
        }
      } catch (e) {
        // Skip to next path
      }
    }
    
    if (!jbig2Found) {
      logger.warn("jbig2 not found, disabling optimization", {
        context: 'ocr-command',
        data: { 
          searchedPaths: jbig2Paths,
          optimizationImpact: "File size will be larger without jbig2 optimization"
        }
      });
      
      // Log guidance for installing jbig2
      logger.info("To enable better PDF optimization, install jbig2enc", {
        context: 'ocr-command',
        data: {
          installMethod1: "sudo apt-get install jbig2enc",
          installMethod2: "Run the included build-jbig2.sh script",
          buildScript: "/workspaces/ocr-app/build-jbig2.sh"
        }
      });
      
      // Remove optimization flag
      command = command.replace(/--optimize \d+/g, '');
    } else {
      logger.info(`Found jbig2 at ${workingPath}, enabling optimization`, {
        context: 'ocr-command',
        data: {
          version: jbig2Version,
          configuredPath: appConfig.jbig2Path,
          actualPath: workingPath
        }
      });
      
      // If we're using a different path than configured, use the absolute path in command
      if (workingPath !== appConfig.jbig2Path) {
        // OCRmyPDF has a --jbig2-lossy flag, but we don't need to modify anything here
        // as it will automatically use the jbig2 in PATH or we can set the env var
        process.env.JBIG2_PATH = workingPath;
      }
    }
  } catch (jbig2Error) {
    logger.error("Error checking jbig2", {
      context: 'ocr-command',
      data: { error: jbig2Error }
    });
    command = command.replace(/--optimize \d+/g, '');
  }

  if (isWindows) {
    command += ` "${escapedInputPath}" "${escapedOutputPath}"`;
  } else {
    command += ` '${escapedInputPath}' '${escapedOutputPath}'`;
  }

  return command;
}

export async function GET() {
  return new NextResponse(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}

export async function PUT() {
  return new NextResponse(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}

export async function DELETE() {
  return new NextResponse(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}

import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, readFile, unlink, stat } from "fs/promises"
import { join } from "path"
import { exec } from "child_process"
import { existsSync } from "fs"
import appConfig from "@/lib/config"

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
  console.log("OCR API route called")

  try {
    const { uploadDir, processedDir } = await ensureDirectories()
    console.log("Directories ensured")

    let formData;
    try {
      formData = await request.formData();
      console.log("Form data parsed successfully");
    } catch (formError) {
      console.error("Error parsing form data:", formError);
      return createJsonResponse({
        success: false,
        error: "Failed to parse form data",
        details: (formError as Error).message
      }, 400);
    }

    const file = formData.get("file") as any
    if (!file) {
      console.error("No file provided")
      return createJsonResponse({
        success: false,
        error: "No file provided",
        details: "Please provide a PDF file"
      }, 400)
    }
    
    // Check if file has necessary properties instead of instanceof check
    if (!file.name || !file.type || !file.size || typeof file.arrayBuffer !== 'function') {
      console.error("Invalid file object provided")
      return createJsonResponse({
        success: false,
        error: "Invalid file provided",
        details: "The provided file does not have the expected properties"
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
        console.log("Checking output file:", outputPath);

        if (!existsSync(outputPath)) {
          console.error(`Output file was not created at: ${outputPath}`);
          throw new Error(`OCR process completed but output file was not created: ${outputPath}`);
        }

        console.log(`Output file exists at: ${outputPath}`);
        const outputStats = await stat(outputPath);
        console.log(`Output file size: ${outputStats.size} bytes`);
        
        if (outputStats.size === 0) {
          console.error("Output file has zero size");
          throw new Error("Output file was created but has zero size");
        }

        const MAX_LOG_LENGTH = 10000;
        const truncatedStdout = stdout.length > MAX_LOG_LENGTH
          ? stdout.substring(0, MAX_LOG_LENGTH) + "... [truncated]"
          : stdout;
        const truncatedStderr = stderr.length > MAX_LOG_LENGTH
          ? stderr.substring(0, MAX_LOG_LENGTH) + "... [truncated]"
          : stderr;

        // Ensure output file path is included in the response
        const responseData = {
          success: true,
          inputFile: inputFilePath,
          outputFile: outputFilePath, // This is critical for the frontend
          fileSize: outputStats.size,
          stdout: truncatedStdout,
          stderr: truncatedStderr,
          command,
          timestamp: new Date().toISOString()
        };
        
        console.log("Sending response with output file path:", outputFilePath);
        return createJsonResponse(responseData);
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

  // Check if jbig2 is available and use it if possible
  try {
    let jbig2Path = '';
    let jbig2Found = false;
    
    // Try multiple possible locations for jbig2
    const possiblePaths = [
      '/usr/bin/jbig2',
      appConfig.jbig2Path,
      '/usr/local/bin/jbig2',
      '/opt/homebrew/bin/jbig2'
    ];
    
    for (const path of possiblePaths) {
      try {
        const { stdout } = await execWithTimeout(`${path} --version`, 2000);
        if (stdout && !stdout.includes('not found')) {
          jbig2Path = path;
          jbig2Found = true;
          console.log(`jbig2 found at ${path}: ${stdout.trim()}`);
          break;
        }
      } catch (e) {
        // Continue to next path
      }
    }
    
    if (!jbig2Found) {
      // Try using 'which' command as a fallback
      try {
        const { stdout: whichOutput } = await execWithTimeout('which jbig2', 2000);
        if (whichOutput && whichOutput.trim()) {
          jbig2Path = whichOutput.trim();
          const { stdout } = await execWithTimeout(`${jbig2Path} --version`, 2000);
          jbig2Found = true;
          console.log(`jbig2 found via 'which' at ${jbig2Path}: ${stdout.trim()}`);
        }
      } catch (e) {
        // Couldn't find with 'which' either
      }
    }
    
    if (jbig2Found) {
      // Explicitly set the jbig2 path for optimization
      command += ` --jbig2-lossy`;
    } else {
      console.log("jbig2 not found, disabling advanced optimization");
      
      // Keep basic optimization but remove high levels
      if (command.includes('--optimize 3') || command.includes('--optimize 4')) {
        command = command.replace(/--optimize [34]/g, '--optimize 2');
      }
    }
  } catch (jbig2Error) {
    console.log("Error checking jbig2:", jbig2Error);
    // Reduce optimization level but don't disable completely
    if (command.includes('--optimize 3') || command.includes('--optimize 4')) {
      command = command.replace(/--optimize [34]/g, '--optimize 1');
    }
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

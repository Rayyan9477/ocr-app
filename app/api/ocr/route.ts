import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, readFile, unlink, stat } from "fs/promises"
import { join } from "path"
import { exec } from "child_process"
import { existsSync } from "fs"

// Configure Next.js to handle large files
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false, // No limit on response size
  },
}

// Add a helper function to create consistent JSON responses
const createJsonResponse = (data: any, status: number = 200) => {
  return new NextResponse(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

// Add timeout to command execution (10 minutes)
const maxExecutionTime = 10 * 60 * 1000; // 10 minutes in milliseconds
const execWithTimeout = async (cmd: string, timeout: number) => {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    // Use a different approach for Windows compatibility
    const execOptions = {
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true
    };

    // On Windows, we need to handle command differently
    const isWindows = process.platform === 'win32';
    const finalCmd = isWindows ? cmd : cmd;

    const execProcess = exec(finalCmd, execOptions, (error: any, stdout: string, stderr: string) => {
      if (error) {
        // Add more context to the error
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
          // On Windows, this will terminate the process
          process.kill(execProcess.pid);
        } catch (killError) {
          console.error("Error killing process:", killError);
        }
      }
      reject(new Error(`Command execution timed out after ${timeout / 1000} seconds`));
    }, timeout);

    // Clear timeout if process completes
    execProcess.on('close', () => {
      clearTimeout(timeoutId);
    });

    // Log any stderr output in real-time for debugging
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

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
      console.log(`Created upload directory: ${uploadDir}`)
    }

    if (!existsSync(processedDir)) {
      await mkdir(processedDir, { recursive: true })
      console.log(`Created processed directory: ${processedDir}`)
    }

    // Check if directories are writable
    try {
      const testFile = join(uploadDir, "test-write-permission.txt")
      await writeFile(testFile, "test")
      await readFile(testFile)

      // Clean up test file
      try {
        await unlink(testFile);
      } catch (cleanupError) {
        console.warn("Could not remove test file from upload directory:", cleanupError);
        // Non-fatal error, continue execution
      }

      console.log("Upload directory is writable")
    } catch (error) {
      console.error("Upload directory is not writable:", error)
      throw new Error("Upload directory is not writable")
    }

    // Also verify processed directory is writable
    try {
      const testProc = join(processedDir, "test-write-permission.txt")
      await writeFile(testProc, "test")
      await readFile(testProc)

      // Clean up test file
      try {
        await unlink(testProc);
      } catch (cleanupError) {
        console.warn("Could not remove test file from processed directory:", cleanupError);
        // Non-fatal error, continue execution
      }

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
    // Ensure directories exist before processing
    const { uploadDir, processedDir } = await ensureDirectories()
    console.log("Directories ensured")

    // Parse form data with error handling
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

    const file = formData.get("file") as File

    if (!file) {
      console.error("No file provided in form data")
      return createJsonResponse({
        success: false,
        error: "No file provided"
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

    // Validate file size
    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      console.error(`File too large: ${file.size} bytes`);
      return createJsonResponse({
        success: false,
        error: "File too large, maximum size is 100MB",
        details: `File size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`
      }, 400);
    }

    console.log(`File received: ${file.name}, size: ${file.size} bytes`)

    // Get command options from form data
    const language = (formData.get("language") as string) || "eng"
    const deskew = formData.get("deskew") === "true"
    const skipText = formData.get("skipText") === "true"
    const force = formData.get("force") === "true"
    const redoOcr = formData.get("redoOcr") === "true"
    const removeBackground = formData.get("removeBackground") === "true"
    const clean = formData.get("clean") === "true"
    const optimize = Number.parseInt((formData.get("optimize") as string) || "3")
    const rotate = (formData.get("rotate") as string) || "auto"
    const pdfRenderer = (formData.get("pdfRenderer") as string) || "auto"

    console.log("OCR options:", { language, deskew, skipText, force, redoOcr, removeBackground, clean, optimize, rotate, pdfRenderer })

    // Create unique filename with better sanitization
    const timestamp = Date.now()
    const originalFilename = file.name

    // Extract extension first
    const fileExtension = originalFilename.split(".").pop()?.toLowerCase() || "pdf"

    // Generate a base filename without the extension and with special characters removed
    // Use a more thorough sanitization approach
    const baseFilename = originalFilename
      .substring(0, originalFilename.length - fileExtension.length - 1) // Remove extension
      .replace(/[^a-zA-Z0-9]/g, "_") // Replace ANY non-alphanumeric char with underscore
      .replace(/_+/g, "_") // Replace multiple underscores with a single one
      .replace(/^_|_$/g, "") // Remove leading/trailing underscores
      .substring(0, 100); // Limit length to avoid path issues

    // Create final filenames
    const safeFilename = `${baseFilename}_${timestamp}`
    const inputFilePath = `${safeFilename}.${fileExtension}`
    const outputFilePath = `${safeFilename}_ocr.pdf`

    console.log(`Original filename: ${originalFilename}`)
    console.log(`Sanitized filename: ${safeFilename}.${fileExtension}`)

    console.log("File paths:", { inputFilePath, outputFilePath })

    // Save the uploaded file
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
      console.log(`Buffer created with size: ${buffer.length} bytes`);

      const inputPath = join(uploadDir, inputFilePath);

      // Write file in chunks to avoid memory issues with large files
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

      // Verify file was saved correctly
      try {
        const fileStats = await stat(inputPath);
        console.log(`File size on disk: ${fileStats.size} bytes`);

        if (fileStats.size === 0) {
          throw new Error("File was saved but has zero size");
        }

        if (fileStats.size !== buffer.length) {
          console.warn(`Warning: File size on disk (${fileStats.size}) differs from buffer size (${buffer.length})`);
        }
      } catch (statError) {
        console.error("Error verifying saved file:", statError);
        return createJsonResponse({
          success: false,
          error: "Failed to verify saved file",
          details: (statError as Error).message
        }, 500);
      }
    } catch (error) {
      console.error("Unexpected error during file saving process:", error);
      return createJsonResponse({
        success: false,
        error: "Failed to save uploaded file",
        details: (error as Error).message
      }, 500);
    }

    // Define variables outside the try block so they're accessible in catch
    let command = "";
    const inputPath = join(uploadDir, inputFilePath);
    const outputPath = join(processedDir, outputFilePath);

    // Properly escape paths for command line based on platform
    const isWindows = process.platform === 'win32';

    // Windows needs different escaping than Unix
    let escapedInputPath, escapedOutputPath;

    if (isWindows) {
      // For Windows, use double quotes and escape any existing quotes
      escapedInputPath = inputPath.replace(/"/g, '\\"');
      escapedOutputPath = outputPath.replace(/"/g, '\\"');
    } else {
      // For Unix, escape spaces and special characters
      escapedInputPath = inputPath.replace(/([\s'"\[\](){}$&*?])/g, '\\$1');
      escapedOutputPath = outputPath.replace(/([\s'"\[\](){}$&*?])/g, '\\$1');
    }

    try {
      // Build OCRmyPDF command
      command = `ocrmypdf`

      if (language !== "eng") {
        command += ` --language ${language}`
      }

      if (deskew) {
        command += ` --deskew`
      }

      if (skipText) {
        command += ` --skip-text`
      }

      if (force) {
        command += ` --force-ocr`
      }
      if (redoOcr) {
        command += ` --redo-ocr`
      }
      if (removeBackground) {
        command += ` --remove-background`
      }
      if (clean) {
        command += ` --clean`
      }

      if (optimize > 0) {
        command += ` --optimize ${optimize}`
      }

      if (rotate !== "auto") {
        command += ` --rotate-pages ${rotate}`
      }
      if (pdfRenderer !== "auto") {
        command += ` --pdf-renderer ${pdfRenderer}`
      }

      // Add quotes differently based on platform
      if (isWindows) {
        // For Windows, use double quotes
        command += ` "${escapedInputPath}" "${escapedOutputPath}"`
      } else {
        // For Unix, use single quotes which handle spaces better
        command += ` '${escapedInputPath}' '${escapedOutputPath}'`
      }

      // Log the full command for debugging
      console.log(`Full command to execute: ${command}`)

      // Check if jbig2 is available and disable optimization if not
      try {
        const { stdout: jbig2Version, stderr: jbig2Error } = await execWithTimeout("jbig2 --version || echo 'not found'", 5000);
        if (jbig2Version.includes('not found') || jbig2Error) {
          console.log("jbig2 not found, disabling optimization");
          // Remove any optimize flags if jbig2 is not available
          command = command.replace(/--optimize \d+/g, '');
        }
      } catch (jbig2Error) {
        console.log("Error checking jbig2:", jbig2Error);
        // Remove any optimize flags if there was an error checking jbig2
        command = command.replace(/--optimize \d+/g, '');
      }

      console.log(`Executing command: ${command}`)

      const { stdout, stderr } = await execWithTimeout(command, maxExecutionTime);
      console.log("OCR process completed");

      // Check if output file was actually created
      if (!existsSync(outputPath)) {
        throw new Error(`OCR process completed but output file was not created: ${outputPath}`);
      }

      // Verify output file size
      try {
        const outputStats = await stat(outputPath);
        console.log(`Output file size: ${outputStats.size} bytes`);

        if (outputStats.size === 0) {
          throw new Error("Output file was created but has zero size");
        }
      } catch (statError) {
        console.error("Error verifying output file:", statError);
        throw new Error(`Failed to verify output file: ${(statError as Error).message}`);
      }

      // Truncate stdout and stderr to prevent JSON response size issues
      const MAX_LOG_LENGTH = 10000; // Limit to 10K characters
      const truncatedStdout = stdout.length > MAX_LOG_LENGTH
        ? stdout.substring(0, MAX_LOG_LENGTH) + "... [truncated]"
        : stdout;
      const truncatedStderr = stderr.length > MAX_LOG_LENGTH
        ? stderr.substring(0, MAX_LOG_LENGTH) + "... [truncated]"
        : stderr;

      return createJsonResponse({
        success: true,
        inputFile: inputFilePath,
        outputFile: outputFilePath,
        stdout: truncatedStdout,
        stderr: truncatedStderr,
      })
    } catch (error: any) {
      console.error("Error executing OCRmyPDF:", error)
      const stderrOutput = (error as any).stderr || ''
      // Detect if PDF already has text, retry with skip-text
      if (stderrOutput.toLowerCase().includes('already contains text')) {
        console.log('Auto-retrying OCR with --skip-text due to existing text')
        try {
          // retry command with skip-text - rebuild the command to ensure proper escaping
          let retryCmd = `ocrmypdf`

          if (language !== "eng") {
            retryCmd += ` --language ${language}`
          }

          if (deskew) {
            retryCmd += ` --deskew`
          }

          // Add skip-text flag
          retryCmd += ` --skip-text`

          if (force) {
            retryCmd += ` --force-ocr`
          }
          if (redoOcr) {
            retryCmd += ` --redo-ocr`
          }
          if (removeBackground) {
            retryCmd += ` --remove-background`
          }
          if (clean) {
            retryCmd += ` --clean`
          }

          if (optimize > 0) {
            retryCmd += ` --optimize ${optimize}`
          }

          if (rotate !== "auto") {
            retryCmd += ` --rotate-pages ${rotate}`
          }
          if (pdfRenderer !== "auto") {
            retryCmd += ` --pdf-renderer ${pdfRenderer}`
          }

          // Add quotes differently based on platform
          if (isWindows) {
            // For Windows, use double quotes
            retryCmd += ` "${escapedInputPath}" "${escapedOutputPath}"`
          } else {
            // For Unix, use single quotes which handle spaces better
            retryCmd += ` '${escapedInputPath}' '${escapedOutputPath}'`
          }

          // Log the full retry command for debugging
          console.log(`Full retry command to execute: ${retryCmd}`)

          // Check if jbig2 is available and disable optimization if not
          try {
            const { stdout: jbig2Version, stderr: jbig2Error } = await execWithTimeout("jbig2 --version || echo 'not found'", 5000);
            if (jbig2Version.includes('not found') || jbig2Error) {
              console.log("jbig2 not found, disabling optimization in retry command");
              // Remove any optimize flags if jbig2 is not available
              retryCmd = retryCmd.replace(/--optimize \d+/g, '');
            }
          } catch (jbig2Error) {
            console.log("Error checking jbig2 in retry:", jbig2Error);
            // Remove any optimize flags if there was an error checking jbig2
            retryCmd = retryCmd.replace(/--optimize \d+/g, '');
          }
          console.log(`Retry command: ${retryCmd}`)
          const { stdout: rstdout, stderr: rstderr } = await execWithTimeout(retryCmd, maxExecutionTime)

          // Truncate stdout and stderr to prevent JSON response size issues
          const MAX_LOG_LENGTH = 10000; // Limit to 10K characters
          const truncatedStdout = rstdout.length > MAX_LOG_LENGTH
            ? rstdout.substring(0, MAX_LOG_LENGTH) + "... [truncated]"
            : rstdout;
          const truncatedStderr = rstderr.length > MAX_LOG_LENGTH
            ? rstderr.substring(0, MAX_LOG_LENGTH) + "... [truncated]"
            : rstderr;

          return createJsonResponse({
            success: true,
            inputFile: inputFilePath,
            outputFile: outputFilePath,
            stdout: truncatedStdout,
            stderr: truncatedStderr
          })
        } catch (retryError: any) {
          console.error('Retry with skip-text failed:', retryError)
          return createJsonResponse({
            success: false,
            errorType: 'has_text',
            error: 'PDF already contains text and skip-text retry failed',
            details: retryError instanceof Error ? retryError.message : String(retryError)
          }, 500)
        }
      }
      // Detect tagged PDF error, retry with force-ocr
      if (/tagged pdf/i.test(stderrOutput)) {
        console.log('Auto-retrying OCR with --force-ocr due to tagged PDF')
        try {
          // retry command with force-ocr - rebuild the command to ensure proper escaping
          let retryCmd = `ocrmypdf`

          if (language !== "eng") {
            retryCmd += ` --language ${language}`
          }

          if (deskew) {
            retryCmd += ` --deskew`
          }

          if (skipText) {
            retryCmd += ` --skip-text`
          }

          // Add force-ocr flag
          retryCmd += ` --force-ocr`

          if (redoOcr) {
            retryCmd += ` --redo-ocr`
          }
          if (removeBackground) {
            retryCmd += ` --remove-background`
          }
          if (clean) {
            retryCmd += ` --clean`
          }

          if (optimize > 0) {
            retryCmd += ` --optimize ${optimize}`
          }

          if (rotate !== "auto") {
            retryCmd += ` --rotate-pages ${rotate}`
          }
          if (pdfRenderer !== "auto") {
            retryCmd += ` --pdf-renderer ${pdfRenderer}`
          }

          // Add quotes differently based on platform
          if (isWindows) {
            // For Windows, use double quotes
            retryCmd += ` "${escapedInputPath}" "${escapedOutputPath}"`
          } else {
            // For Unix, use single quotes which handle spaces better
            retryCmd += ` '${escapedInputPath}' '${escapedOutputPath}'`
          }

          // Log the full retry command for debugging
          console.log(`Full retry command to execute: ${retryCmd}`)

          // Check if jbig2 is available and disable optimization if not
          try {
            const { stdout: jbig2Version, stderr: jbig2Error } = await execWithTimeout("jbig2 --version || echo 'not found'", 5000);
            if (jbig2Version.includes('not found') || jbig2Error) {
              console.log("jbig2 not found, disabling optimization in retry command");
              // Remove any optimize flags if jbig2 is not available
              retryCmd = retryCmd.replace(/--optimize \d+/g, '');
            }
          } catch (jbig2Error) {
            console.log("Error checking jbig2 in retry:", jbig2Error);
            // Remove any optimize flags if there was an error checking jbig2
            retryCmd = retryCmd.replace(/--optimize \d+/g, '');
          }

          console.log(`Retry command: ${retryCmd}`)
          const { stdout: rstdout, stderr: rstderr } = await execWithTimeout(retryCmd, maxExecutionTime)

          // Truncate stdout and stderr to prevent JSON response size issues
          const MAX_LOG_LENGTH = 10000; // Limit to 10K characters
          const truncatedStdout = rstdout.length > MAX_LOG_LENGTH
            ? rstdout.substring(0, MAX_LOG_LENGTH) + "... [truncated]"
            : rstdout;
          const truncatedStderr = rstderr.length > MAX_LOG_LENGTH
            ? rstderr.substring(0, MAX_LOG_LENGTH) + "... [truncated]"
            : rstderr;

          return createJsonResponse({
            success: true,
            inputFile: inputFilePath,
            outputFile: outputFilePath,
            stdout: truncatedStdout,
            stderr: truncatedStderr
          })
        } catch (retryError: any) {
          console.error('Retry with force-ocr failed:', retryError)
          return createJsonResponse({
            success: false,
            errorType: 'tagged_pdf',
            error: 'PDF is a tagged PDF and force-ocr retry failed',
            details: retryError instanceof Error ? retryError.message : String(retryError)
          }, 500)
        }
      }
      // Generic OCR error
      return createJsonResponse({
        success: false,
        error: 'Failed to execute OCRmyPDF',
        details: error instanceof Error ? error.message : String(error),
        command: command // Include the command for debugging
      }, 500)
    }
  } catch (error) {
    console.error("Unhandled error in OCR API route:", error)

    // Ensure we always return a valid JSON response
    try {
      // Create a safe error message that can be serialized to JSON
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error && process.env.NODE_ENV === 'development'
        ? error.stack
        : undefined;

      // Ensure the response is properly formatted as JSON
      return createJsonResponse({
        success: false,
        error: "Internal server error",
        details: errorMessage,
        stack: errorStack
      }, 500);
    } catch (jsonError) {
      // If JSON serialization fails, still return a JSON response with minimal data
      console.error("Failed to create JSON error response:", jsonError);
      return createJsonResponse({
        success: false,
        error: "Internal server error",
        details: "Failed to serialize error details"
      }, 500);
    }
  }
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

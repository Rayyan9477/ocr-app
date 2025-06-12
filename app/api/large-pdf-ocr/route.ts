import { NextRequest } from "next/server";
import { join } from "path";
import { writeFile, mkdir } from "fs/promises";
import fs from "fs";
import path from "path";
import { serverLogger, execAsync } from "@/app/api/_utils/server-utils";
import { createJsonResponse } from "@/lib/utils";
import { createSafeJsonResponse, createChunkedJsonResponse, isResponseTooLarge } from "@/lib/server-safe-response-handler";
import { FileHandler } from "@/lib/file-handler";
import appConfig from "@/lib/config";

/**
 * Special API route for processing large PDF files with proper error handling
 * and response size management
 */
export async function POST(request: NextRequest) {
  let inputPath = "";
  let tempFiles: string[] = [];
  let outputFile = "";
  
  try {
    // Extract document type and engine preference from the request
    const formData = await request.formData();
    
    // Log all form data keys for debugging
    const formKeys = Array.from(formData.keys());
    serverLogger.info(`Large PDF handler received form data keys: ${formKeys.join(', ')}`);
    
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string || 'general';
    const preferredEngine = formData.get('engine') as string;
    const chunkedProcessing = formData.get('chunkedProcessing') !== 'false'; // Default to true
    
    serverLogger.info(`Processing large PDF of type: ${documentType}, preferred engine: ${preferredEngine || 'auto'}`);
    
    if (!file) {
      serverLogger.error('No file provided in form data');
      return createJsonResponse({ success: false, error: 'No file provided' }, 400);
    }
    
    // Verify this is actually a PDF file
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      serverLogger.error('File is not a PDF');
      return createJsonResponse({ 
        success: false, 
        error: 'This endpoint only processes PDF files',
        details: 'For image files, use the standard OCR endpoint' 
      }, 400);
    }
    
    const fileMetadata = FileHandler.getMetadata(file);
    serverLogger.info(`PDF file received: ${fileMetadata?.name}, size: ${fileMetadata?.size} bytes`);
    
    // Save the uploaded file
    const uploadsDir = join(process.cwd(), 'uploads');
    const timestamp = Date.now();
    const fileName = FileHandler.generateFilename(file.name);
    inputPath = join(uploadsDir, fileName);
    tempFiles.push(inputPath);
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      serverLogger.info(`Created uploads directory: ${uploadsDir}`);
    }
    
    const fileBuffer = await FileHandler.toBuffer(file);
    if (!fileBuffer) {
      return createJsonResponse({ success: false, error: 'Failed to process file data' }, 400);
    }
    
    await writeFile(inputPath, fileBuffer);
    serverLogger.info(`File saved to ${inputPath}`);
    
    // Ensure processed directory exists
    const processedDir = appConfig.processedDir || join(process.cwd(), 'processed');
    if (!fs.existsSync(processedDir)) {
      await mkdir(processedDir, { recursive: true });
      serverLogger.info(`Created processed directory: ${processedDir}`);
    }
    
    // Generate output filename
    const fileNameWithoutExt = path.basename(file.name, path.extname(file.name));
    outputFile = `${fileNameWithoutExt}_ocr_large.pdf`;
    const outputPdfPath = join(processedDir, outputFile);
    
    // Process with Python large PDF handler
    try {
      // Create a directory for the chunks
      const chunksDir = join(uploadsDir, `${timestamp}_chunks`);
      fs.mkdirSync(chunksDir, { recursive: true });
      tempFiles.push(chunksDir);
      
      // Call the Python script with large PDF handling
      const pythonScript = join(process.cwd(), 'python', 'smart_ocr.py');
      
      const args = [
        `--input "${inputPath}"`,
        `--output_dir "${processedDir}"`,
        `--output_file "${outputFile}"`,
        `--document_type "${documentType}"`,
        '--advanced',
        '--handle_large_pdf',
        chunkedProcessing ? '--chunked_processing' : '',
        '--report_metrics'
      ];
      
      if (preferredEngine) {
        args.push(`--engine "${preferredEngine}"`);
      }
      
      const cmdArgs = args.filter(Boolean).join(' ');
      const cmd = `python3 "${pythonScript}" ${cmdArgs}`;
      
      serverLogger.info(`Executing: ${cmd}`);
      
      const { stdout, stderr } = await execAsync(cmd);
      
      // Process the output to extract JSON result
      let result: any = { success: false };
      try {
        // The Python script should output JSON as the last line
        const outputLines = stdout.trim().split('\n');
        const lastLine = outputLines[outputLines.length - 1];
        
        // Try to parse as JSON
        if (lastLine.trim().startsWith('{') && lastLine.trim().endsWith('}')) {
          result = JSON.parse(lastLine);
        } else {
          // If the last line isn't JSON, look for a line that is
          for (let i = outputLines.length - 1; i >= 0; i--) {
            if (outputLines[i].trim().startsWith('{') && outputLines[i].trim().endsWith('}')) {
              try {
                result = JSON.parse(outputLines[i]);
                break;
              } catch (e) {
                // Continue searching
              }
            }
          }
        }
        
        // If we couldn't find JSON in the output, check for a result file
        if (!result.success) {
          const resultFile = join(processedDir, `${fileNameWithoutExt}_result.json`);
          if (fs.existsSync(resultFile)) {
            try {
              const resultContent = fs.readFileSync(resultFile, 'utf8');
              result = JSON.parse(resultContent);
            } catch (e) {
              serverLogger.error(`Failed to parse result file: ${e}`);
            }
          }
        }
        
        // If still no result, return the stdout/stderr
        if (!result.success) {
          serverLogger.warn('Could not extract JSON result from output');
          result = {
            success: fs.existsSync(outputPdfPath),
            outputFile: outputFile,
            details: "Processed with large PDF handler",
            stdoutOutput: stdout,
            stderrOutput: stderr
          };
        }
        
      } catch (parseError) {
        serverLogger.error('Error parsing Python output:', parseError);
        result = {
          success: fs.existsSync(outputPdfPath),
          outputFile: outputFile,
          details: "Processed with large PDF handler but couldn't parse result",
          error: parseError instanceof Error ? parseError.message : String(parseError)
        };
      }
      
      // Add output file if it exists but wasn't included in the result
      if (fs.existsSync(outputPdfPath) && !result.outputFile) {
        result.outputFile = outputFile;
        result.success = true;
      }
      
      // Check if response is too large
      if (isResponseTooLarge(result)) {
        serverLogger.warn('Response is too large, using chunked response');
        return createChunkedJsonResponse(result);
      } else {
        return createSafeJsonResponse(result);
      }
      
    } catch (error) {
      serverLogger.error("Large PDF processing failed:", error);
      return createSafeJsonResponse({ 
        success: false, 
        error: "Large PDF processing failed",
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
    
  } catch (error) {
    serverLogger.error("Error in large-pdf-ocr:", error);
    return createSafeJsonResponse({ 
      success: false, 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  } finally {
    // Cleanup temporary files
    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        try {
          if (fs.lstatSync(file).isDirectory()) {
            // Remove directory recursively
            fs.rmSync(file, { recursive: true, force: true });
          } else {
            // Only delete the file if it's not the output PDF
            if (!file.includes('_ocr.pdf')) {
              fs.unlinkSync(file);
              serverLogger.info(`Cleaned up temporary file: ${file}`);
            }
          }
        } catch (cleanupError) {
          serverLogger.warn(`Failed to cleanup file ${file}: ${cleanupError}`);
        }
      }
    }
  }
}

/**
 * Handler for retrieving OCR text chunks
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chunkId = searchParams.get('chunk');
  
  if (!chunkId) {
    return createJsonResponse({ success: false, error: 'No chunk ID provided' }, 400);
  }
  
  try {
    // Logic for retrieving a specific text chunk by ID
    // This would typically look up the chunk in a cache or database
    
    // For this example, we'll return a simple message
    return createJsonResponse({ 
      success: false, 
      error: 'Text chunk retrieval not yet implemented',
      chunkId
    }, 501);
  } catch (error) {
    serverLogger.error("Error retrieving text chunk:", error);
    return createJsonResponse({ 
      success: false, 
      error: "Failed to retrieve text chunk",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

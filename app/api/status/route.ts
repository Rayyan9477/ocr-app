import { NextResponse } from "next/server"
import { readdir, writeFile, unlink } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { exec } from "child_process"
import { promisify } from "util"

const execPromise = promisify(exec);

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

export async function GET() {
  try {
    const uploadDir = join(process.cwd(), "uploads")
    const processedDir = join(process.cwd(), "processed")

    // Check OCRmyPDF version
    let ocrmypdfVersion = "Not available";
    let ocrmypdfError = null;
    let ocrmypdfPath = null;
    let jbig2Available = false;
    let jbig2Version = null;
    let jbig2Error = null;

    try {
      // Check if ocrmypdf is in PATH
      const { stdout: whichOutput } = await execPromise("where ocrmypdf || which ocrmypdf || echo 'not found'").catch(() => ({ stdout: 'not found' }));
      ocrmypdfPath = whichOutput.trim() !== 'not found' ? whichOutput.trim() : null;

      // Check ocrmypdf version
      const { stdout, stderr } = await execPromise("ocrmypdf --version");
      ocrmypdfVersion = stdout.trim();
      ocrmypdfError = stderr || null;

      // Check jbig2 availability
      try {
        const { stdout: jbig2Out, stderr: jbig2Err } = await execPromise("jbig2 --version || echo 'not found'");
        jbig2Available = !jbig2Out.includes('not found');
        jbig2Version = jbig2Out.trim();
        jbig2Error = jbig2Err || null;
      } catch (jbig2CheckError) {
        jbig2Error = (jbig2CheckError as Error).message;
      }
    } catch (ocrError) {
      ocrmypdfError = (ocrError as Error).message;
    }

    // Check directory permissions
    const uploadDirWritable = await checkDirectoryWritable(uploadDir);
    const processedDirWritable = await checkDirectoryWritable(processedDir);

    // Check if directories exist
    const uploadDirExists = existsSync(uploadDir);
    const processedDirExists = existsSync(processedDir);

    // Get processed files
    let pdfFiles: string[] = [];
    if (processedDirExists) {
      // Read directory
      const files = await readdir(processedDir)
      // Filter for PDF files
      pdfFiles = files.filter((file) => file.endsWith(".pdf"))
    }

    return createJsonResponse({
      success: true,
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        ocrmypdf: {
          version: ocrmypdfVersion,
          path: ocrmypdfPath,
          error: ocrmypdfError,
          jbig2: {
            available: jbig2Available,
            version: jbig2Version,
            error: jbig2Error
          }
        },
        directories: {
          uploads: {
            exists: uploadDirExists,
            writable: uploadDirWritable,
            path: uploadDir
          },
          processed: {
            exists: processedDirExists,
            writable: processedDirWritable,
            path: processedDir
          }
        }
      },
      files: pdfFiles.map((file) => ({
        name: file,
        path: `/api/download?file=${encodeURIComponent(file)}`,
      })),
    })
  } catch (error) {
    console.error("Error getting status:", error)
    return createJsonResponse({
      success: false,
      error: "Failed to get status",
      details: (error as Error).message
    }, 500)
  }
}

export async function POST() {
  return new Response(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}

export async function PUT() {
  return new Response(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}

export async function DELETE() {
  return new Response(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}

// Helper function to check if a directory is writable
async function checkDirectoryWritable(dirPath: string): Promise<boolean> {
  try {
    if (!existsSync(dirPath)) {
      return false;
    }

    // Try to write a test file
    const testFile = join(dirPath, "test-write-permission.txt");
    await writeFile(testFile, "test");
    await unlink(testFile);

    return true;
  } catch (error) {
    console.error(`Error checking directory ${dirPath}:`, error);
    return false;
  }
}

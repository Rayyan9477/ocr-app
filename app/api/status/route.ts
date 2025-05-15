import { NextResponse } from "next/server"
import { readdir, writeFile, unlink } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { exec } from "child_process"
import { promisify } from "util"
import os from "os"
import appConfig from "@/lib/config"

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

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to format uptime
function formatUptime(uptime: number): string {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  
  return parts.join(', ');
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
        const { stdout: jbig2Out, stderr: jbig2Err } = await execPromise(`${appConfig.jbig2Path} --version || echo 'not found'`);
        jbig2Available = !jbig2Out.includes('not found');
        jbig2Version = jbig2Out.trim();
        jbig2Error = jbig2Err || null;
      } catch (jbig2CheckError) {
        jbig2Error = (jbig2CheckError as Error).message;
      }
    } catch (ocrError) {
      ocrmypdfError = (ocrError as Error).message;
    }

    // Check if directories exist
    const uploadDirExists = existsSync(uploadDir);
    const processedDirExists = existsSync(processedDir);

    // Enhanced directory permission checks
    const checkDirectoryPermissions = async (dirPath: string) => {
      if (!existsSync(dirPath)) {
        return {
          exists: false,
          writable: false,
          permissions: null,
          userCanWrite: false,
          error: "Directory does not exist"
        };
      }

      try {
        // Check if directory is writable by writing a test file
        const testFile = join(dirPath, "test-permission-check.txt");
        await writeFile(testFile, "test");
        await unlink(testFile);
        
        // Get directory permissions for reporting
        let permissions = null;
        try {
          const { stdout } = await execPromise(`ls -la "${dirPath}" | head -n 2 | tail -n 1`);
          permissions = stdout.trim();
        } catch (e) {
          // Continue if getting permissions fails
        }
        
        return {
          exists: true,
          writable: true, 
          permissions,
          userCanWrite: true,
          error: null
        };
      } catch (error) {
        return {
          exists: true,
          writable: false,
          permissions: null,
          userCanWrite: false,
          error: (error as Error).message
        };
      }
    };

    const uploadDirPermissions = await checkDirectoryPermissions(uploadDir);
    const processedDirPermissions = await checkDirectoryPermissions(processedDir);

    // Get processed files
    let pdfFiles: string[] = [];
    if (processedDirExists) {
      // Read directory
      const files = await readdir(processedDir)
      // Filter for PDF files
      pdfFiles = files.filter((file) => file.endsWith(".pdf"))
    }
    
    // Get system information
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpus: os.cpus().length,
      memory: {
        total: formatBytes(os.totalmem()),
        free: formatBytes(os.freemem()),
        percentFree: Math.round((os.freemem() / os.totalmem()) * 100)
      },
      uptime: formatUptime(os.uptime())
    };
    
    // All critical components must be healthy
    const isHealthy = (
      ocrmypdfVersion !== "Not available" && 
      !ocrmypdfError && 
      uploadDirPermissions.exists && 
      processedDirPermissions.exists && 
      uploadDirPermissions.writable && 
      processedDirPermissions.writable
    );

    return createJsonResponse({
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      system: {
        ...systemInfo,
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
          uploads: uploadDirPermissions,
          processed: processedDirPermissions
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

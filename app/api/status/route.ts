import { NextResponse } from "next/server"
import { readdir, writeFile, unlink, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import os from "os"

// Helper function to create consistent JSON responses
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

  return parts.join(', ') || '0 minutes';
}

export async function GET() {
  try {
    const uploadDir = join(process.cwd(), "uploads")
    const processedDir = join(process.cwd(), "processed")

    // Ensure directories exist
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }
    if (!existsSync(processedDir)) {
      await mkdir(processedDir, { recursive: true });
    }

    // Check JavaScript OCR dependencies
    const dependencies = {
      tesseractJs: false,
      pdfLib: false,
      sharp: false,
      simpleOCR: false
    };

    try {
      await import('tesseract.js');
      dependencies.tesseractJs = true;
    } catch (e) {
      // Module not available
    }

    try {
      await import('pdf-lib');
      dependencies.pdfLib = true;
    } catch (e) {
      // Module not available
    }

    try {
      await import('sharp');
      dependencies.sharp = true;
    } catch (e) {
      // Module not available
    }

    try {
      await import('@/lib/simple-ocr-service');
      dependencies.simpleOCR = true;
    } catch (e) {
      // Module not available
    }

    // Enhanced directory permission checks
    const checkDirectoryPermissions = async (dirPath: string) => {
      if (!existsSync(dirPath)) {
        return {
          exists: false,
          writable: false,
          error: "Directory does not exist"
        };
      }

      try {
        // Check if directory is writable by writing a test file
        const testFile = join(dirPath, ".write-test");
        await writeFile(testFile, "test");
        await unlink(testFile);

        return {
          exists: true,
          writable: true,
          error: null
        };
      } catch (error) {
        return {
          exists: true,
          writable: false,
          error: (error as Error).message
        };
      }
    };

    const uploadDirPermissions = await checkDirectoryPermissions(uploadDir);
    const processedDirPermissions = await checkDirectoryPermissions(processedDir);

    // Get processed files
    let pdfFiles: string[] = [];
    if (existsSync(processedDir)) {
      const files = await readdir(processedDir)
      pdfFiles = files.filter((file) => file.endsWith(".pdf"))
    }

    // Get system information
    const systemInfo = {
      type: "Simple OCR (Cross-Platform)",
      description: "JavaScript-only OCR - No system dependencies required",
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
    const allDepsAvailable = Object.values(dependencies).every(d => d);
    const dirsOk = uploadDirPermissions.writable && processedDirPermissions.writable;
    const isHealthy = allDepsAvailable && dirsOk;

    return createJsonResponse({
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      system: systemInfo,
      ocr: {
        type: "JavaScript-based OCR",
        engine: "Tesseract.js",
        dependencies: {
          "Tesseract.js": dependencies.tesseractJs ? "✓ Available" : "✗ Missing",
          "PDF-Lib": dependencies.pdfLib ? "✓ Available" : "✗ Missing",
          "Sharp": dependencies.sharp ? "✓ Available" : "✗ Missing",
          "Simple OCR Service": dependencies.simpleOCR ? "✓ Available" : "✗ Missing"
        },
        ready: allDepsAvailable
      },
      directories: {
        uploads: {
          path: uploadDir,
          ...uploadDirPermissions
        },
        processed: {
          path: processedDir,
          ...processedDirPermissions
        }
      },
      files: pdfFiles.map((file) => ({
        name: file,
        path: `/api/download?file=${encodeURIComponent(file)}`,
      })),
      message: isHealthy
        ? "✓ System healthy - OCR service ready"
        : "⚠ System degraded - check dependencies"
    })
  } catch (error) {
    console.error("Error getting status:", error)
    return createJsonResponse({
      success: false,
      status: "error",
      error: "Failed to get status",
      details: (error as Error).message
    }, 500)
  }
}

export async function POST() {
  return createJsonResponse({ success: false, error: "Method Not Allowed" }, 405);
}

export async function PUT() {
  return createJsonResponse({ success: false, error: "Method Not Allowed" }, 405);
}

export async function DELETE() {
  return createJsonResponse({ success: false, error: "Method Not Allowed" }, 405);
}

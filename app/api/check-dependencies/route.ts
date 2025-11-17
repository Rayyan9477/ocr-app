import { NextResponse } from "next/server";
import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

// Helper function to create consistent JSON responses
const createJsonResponse = (data: Record<string, unknown>, status: number = 200) => {
  return new NextResponse(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
};

interface DependencyCheck {
  name: string;
  module: string;
  version?: string;
  available: boolean;
  error?: string;
  type: 'required' | 'optional';
}

interface DirectoryStatus {
  path: string;
  exists: boolean;
  writable: boolean;
  error?: string;
}

export async function GET() {
  try {
    const dependencies: DependencyCheck[] = [];
    const directories: DirectoryStatus[] = [];

    // Check tesseract.js (required for OCR)
    try {
      const tesseract = await import('tesseract.js');
      dependencies.push({
        name: "Tesseract.js",
        module: "tesseract.js",
        version: "6.0.1", // From package.json
        available: true,
        type: 'required'
      });
    } catch (error) {
      dependencies.push({
        name: "Tesseract.js",
        module: "tesseract.js",
        available: false,
        error: (error as Error).message,
        type: 'required'
      });
    }

    // Check pdf-lib (required for PDF processing)
    try {
      const pdfLib = await import('pdf-lib');
      dependencies.push({
        name: "PDF-Lib",
        module: "pdf-lib",
        version: "1.17.1", // From package.json
        available: true,
        type: 'required'
      });
    } catch (error) {
      dependencies.push({
        name: "PDF-Lib",
        module: "pdf-lib",
        available: false,
        error: (error as Error).message,
        type: 'required'
      });
    }

    // Check sharp (required for image processing)
    try {
      const sharp = await import('sharp');
      dependencies.push({
        name: "Sharp",
        module: "sharp",
        version: "0.33.2", // From package.json
        available: true,
        type: 'required'
      });
    } catch (error) {
      dependencies.push({
        name: "Sharp",
        module: "sharp",
        available: false,
        error: (error as Error).message,
        type: 'required'
      });
    }

    // Check Simple OCR Service
    try {
      const simpleOCR = await import('@/lib/simple-ocr-service');
      dependencies.push({
        name: "Simple OCR Service",
        module: "@/lib/simple-ocr-service",
        available: true,
        type: 'required'
      });
    } catch (error) {
      dependencies.push({
        name: "Simple OCR Service",
        module: "@/lib/simple-ocr-service",
        available: false,
        error: (error as Error).message,
        type: 'required'
      });
    }

    // Check directory permissions
    const uploadDir = join(process.cwd(), "uploads");
    const processedDir = join(process.cwd(), "processed");

    // Ensure directories exist
    await ensureDirectory(uploadDir);
    await ensureDirectory(processedDir);

    const uploadDirStatus = await checkDirectoryPermissions(uploadDir);
    const processedDirStatus = await checkDirectoryPermissions(processedDir);

    directories.push(uploadDirStatus);
    directories.push(processedDirStatus);

    // Check Node.js environment
    const nodeVersion = process.version;
    const platform = process.platform;
    const arch = process.arch;

    const allRequired = dependencies
      .filter(dep => dep.type === 'required')
      .every(dep => dep.available);

    const allAvailable = dependencies.every(dep => dep.available);

    const directoriesOk = directories.every(dir => dir.writable);

    return createJsonResponse({
      success: true,
      system: {
        type: "Simple OCR (Cross-Platform)",
        description: "JavaScript-only OCR using tesseract.js, pdf-lib, and sharp",
        platform,
        arch,
        nodeVersion,
        noDependencies: "No system dependencies required!"
      },
      dependencies,
      directories,
      // Top-level status fields for frontend compatibility
      allRequiredAvailable: allRequired,
      allDependenciesAvailable: allAvailable,
      directoriesOk,
      ready: allRequired && directoriesOk,
      status: {
        allRequiredAvailable: allRequired,
        directoriesOk,
        ready: allRequired && directoriesOk
      },
      message: allRequired && directoriesOk
        ? "✓ All dependencies available - OCR service ready!"
        : "⚠ Some dependencies missing - check details above"
    });
  } catch (error) {
    console.error("Error checking dependencies:", error);
    return createJsonResponse({
      success: false,
      error: "Failed to check dependencies",
      details: (error as Error).message
    }, 500);
  }
}

// Ensure directory exists
async function ensureDirectory(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

// Check directory permissions
async function checkDirectoryPermissions(dirPath: string): Promise<DirectoryStatus> {
  if (!existsSync(dirPath)) {
    return {
      path: dirPath,
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
      path: dirPath,
      exists: true,
      writable: true
    };
  } catch (error) {
    return {
      path: dirPath,
      exists: true,
      writable: false,
      error: (error as Error).message
    };
  }
}

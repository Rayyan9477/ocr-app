import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import appConfig from "@/lib/config";

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
};

interface DependencyCheck {
  name: string;
  command: string;
  version?: string;
  available: boolean;
  error?: string;
  optional?: boolean;
}

interface DirectoryStatus {
  path: string;
  exists: boolean;
  writable: boolean;
  permissions?: string;
  error?: string;
}

export async function GET() {
  try {
    const dependencies: DependencyCheck[] = [];
    const directories: DirectoryStatus[] = [];

    // Check OCRmyPDF
    try {
      const { stdout: ocrVersion } = await execPromise("ocrmypdf --version");
      dependencies.push({
        name: "OCRmyPDF",
        command: "ocrmypdf",
        version: ocrVersion.trim(),
        available: true
      });
    } catch (error) {
      dependencies.push({
        name: "OCRmyPDF",
        command: "ocrmypdf",
        available: false,
        error: (error as Error).message
      });
    }

    // Check Tesseract
    try {
      const { stdout: tessVersion } = await execPromise("tesseract --version");
      const versionMatch = tessVersion.match(/tesseract ([0-9.]+)/i);
      dependencies.push({
        name: "Tesseract OCR",
        command: "tesseract",
        version: versionMatch ? versionMatch[1] : tessVersion.trim().split("\n")[0],
        available: true
      });
    } catch (error) {
      dependencies.push({
        name: "Tesseract OCR",
        command: "tesseract",
        available: false,
        error: (error as Error).message
      });
    }

    // Check Ghostscript
    try {
      const { stdout: gsVersion } = await execPromise("gs --version");
      dependencies.push({
        name: "Ghostscript",
        command: "gs",
        version: gsVersion.trim(),
        available: true
      });
    } catch (error) {
      dependencies.push({
        name: "Ghostscript",
        command: "gs",
        available: false,
        error: (error as Error).message
      });
    }

    // Check jbig2
    try {
      // Check multiple possible locations for jbig2
      const jbig2Paths = [
        appConfig.jbig2Path,
        '/usr/local/bin/jbig2',
        '/usr/bin/jbig2',
        'jbig2' // Let the system find it in PATH
      ];
      
      let jbig2Found = false;
      let jbig2Version = '';
      let jbig2Path = appConfig.jbig2Path;
      
      for (const path of jbig2Paths) {
        try {
          const { stdout } = await execPromise(`${path} --version || echo 'not found'`);
          if (!stdout.includes('not found')) {
            jbig2Found = true;
            jbig2Version = stdout.trim();
            jbig2Path = path;
            break;
          }
        } catch (e) {
          // Skip to next path
        }
      }
      
      dependencies.push({
        name: "jbig2enc",
        command: jbig2Path,
        version: jbig2Found ? jbig2Version : undefined,
        available: jbig2Found,
        error: jbig2Found ? undefined : "jbig2 not found in any standard location",
        optional: true // Mark as optional
      });
    } catch (error) {
      dependencies.push({
        name: "jbig2enc",
        command: appConfig.jbig2Path,
        available: false,
        error: (error as Error).message,
        optional: true // Mark as optional
      });
    }

    // Check unpaper
    try {
      const { stdout: unpaperVersion } = await execPromise("unpaper --version || echo 'not found'");
      const available = !unpaperVersion.includes('not found');
      dependencies.push({
        name: "unpaper",
        command: "unpaper",
        version: available ? unpaperVersion.trim() : undefined,
        available: available,
        error: available ? undefined : "unpaper not found",
        optional: true // Mark as optional
      });
    } catch (error) {
      dependencies.push({
        name: "unpaper",
        command: "unpaper",
        available: false,
        error: (error as Error).message,
        optional: true // Mark as optional
      });
    }

    // Check directory permissions
    const uploadDir = join(process.cwd(), "uploads");
    const processedDir = join(process.cwd(), "processed");
    
    const uploadDirStatus = await checkDirectoryPermissions(uploadDir);
    const processedDirStatus = await checkDirectoryPermissions(processedDir);
    
    directories.push(uploadDirStatus);
    directories.push(processedDirStatus);

    return createJsonResponse({
      success: true,
      dependencies,
      directories,
      // Only required dependencies must be available for the system to work
      allRequiredAvailable: dependencies
        .filter(dep => !dep.optional)
        .every(dep => dep.available),
      // Include overall status too
      allDependenciesAvailable: dependencies.every(dep => dep.available),
      // Directory permissions status
      directoriesOk: directories.every(dir => dir.writable)
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

// Check directory permissions
const checkDirectoryPermissions = async (dirPath: string): Promise<DirectoryStatus> => {
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
    const testFile = join(dirPath, "test-permission-check.txt");
    await writeFile(testFile, "test");
    await unlink(testFile);
    
    // Get directory permissions for reporting
    let permissions: string | undefined = undefined;
    try {
      const { stdout } = await execPromise(`ls -la "${dirPath}" | head -n 2 | tail -n 1`);
      permissions = stdout.trim() || undefined;
    } catch (e) {
      // Continue if getting permissions fails
    }
    
    return {
      path: dirPath,
      exists: true,
      writable: true, 
      permissions,
    };
  } catch (error) {
    return {
      path: dirPath,
      exists: true,
      writable: false,
      error: (error as Error).message
    };
  }
};

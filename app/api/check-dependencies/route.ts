import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
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

export async function GET() {
  try {
    const dependencies: DependencyCheck[] = [];

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
      const { stdout: jbig2Version } = await execPromise(`${appConfig.jbig2Path} --version || echo 'not found'`);
      const available = !jbig2Version.includes('not found');
      dependencies.push({
        name: "jbig2enc",
        command: appConfig.jbig2Path,
        version: available ? jbig2Version.trim() : undefined,
        available: available,
        error: available ? undefined : "jbig2 not found",
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

    return createJsonResponse({
      success: true,
      dependencies,
      // Only required dependencies must be available for the system to work
      allRequiredAvailable: dependencies
        .filter(dep => !dep.optional)
        .every(dep => dep.available),
      // Include overall status too
      allDependenciesAvailable: dependencies.every(dep => dep.available)
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

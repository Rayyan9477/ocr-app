import { NextResponse } from "next/server";
import { cpus, freemem, totalmem } from "os";
import { execWithTimeout } from "../ocr/route"; // Reusing this utility
import appConfig from "@/lib/config";
import { checkDirectoryPermissions } from "@/lib/permissions";
import logger from "@/lib/logger";

export async function GET() {
  try {
    logger.info("Health check called", { context: "health-api" });
    
    // Basic system info
    const systemInfo = {
      cpuCount: cpus().length,
      totalMemory: Math.floor(totalmem() / (1024 * 1024)), // MB
      freeMemory: Math.floor(freemem() / (1024 * 1024)), // MB
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
    };
    
    // Check directories
    const directoryCheck = await checkDirectoryPermissions();
    
    // Check dependencies
    let dependencies = [];
    try {
      // Check OCRmyPDF
      try {
        const { stdout: ocrVersion } = await execWithTimeout("ocrmypdf --version", 5000);
        dependencies.push({
          name: "OCRmyPDF",
          available: true,
          version: ocrVersion.trim(),
        });
      } catch (error) {
        dependencies.push({
          name: "OCRmyPDF",
          available: false,
          error: (error as Error).message,
        });
      }
      
      // Check Tesseract
      try {
        const { stdout: tesseractVersion } = await execWithTimeout("tesseract --version", 5000);
        const versionMatch = tesseractVersion.match(/tesseract\s+([0-9.]+)/i);
        dependencies.push({
          name: "Tesseract",
          available: true,
          version: versionMatch ? versionMatch[1] : "Unknown",
        });
      } catch (error) {
        dependencies.push({
          name: "Tesseract",
          available: false,
          error: (error as Error).message,
        });
      }
    } catch (error) {
      logger.logError(error as Error, "Error checking dependencies", { context: "health-api" });
    }
    
    // Overall status
    const isHealthy = directoryCheck.allPermissionsOk && 
                      dependencies.filter(d => d.name !== "jbig2").every(d => d.available);
    
    return NextResponse.json({
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      system: systemInfo,
      directories: directoryCheck.results,
      dependencies,
      config: {
        maxUploadSize: appConfig.maxUploadSize,
        ocrTimeout: appConfig.ocrTimeout,
        defaultLanguage: appConfig.defaultLanguage,
        debug: appConfig.debug,
      }
    });
  } catch (error) {
    logger.logError(error as Error, "Health check failed", { context: "health-api" });
    
    return NextResponse.json({
      status: "error",
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

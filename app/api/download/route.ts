import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { existsSync, statSync } from "fs";
import path from "path";
import appConfig from "@/lib/config";

async function findFile(fileName: string): Promise<string | null> {
  const processedDir = appConfig.processedDir;

  if (!existsSync(processedDir)) {
    console.warn(`Processed directory does not exist: ${processedDir}`);
    return null;
  }

  // Try exact match first
  const exactPath = join(processedDir, fileName);
  if (existsSync(exactPath)) {
    return exactPath;
  }

  // If not found, try different variations
  const baseName = path.parse(fileName).name;
  const extension = path.parse(fileName).ext || '.pdf';
  
  // Get all files in the directory and search more broadly
  try {
    const allFiles = await readdir(processedDir);
    
    // Search patterns in order of preference
    const searchPatterns = [
      // Exact match (already tried above)
      fileName,
      // Large PDF OCR format
      `${baseName}_ocr_large${extension}`,
      // Standard OCR format
      `${baseName}_ocr${extension}`,
      // Smart OCR format with any timestamp
      new RegExp(`${baseName}_\\d+_smart_ocr\\${extension}$`),
      // Files containing the base name (loose matching)
      new RegExp(`.*${baseName}.*\\${extension}$`, 'i'),
      // Any file with similar name (very loose)
      new RegExp(`${baseName}.*\\${extension}$`, 'i')
    ];
    
    for (const pattern of searchPatterns) {
      if (typeof pattern === 'string') {
        // String pattern - exact match
        if (allFiles.includes(pattern)) {
          return join(processedDir, pattern);
        }
      } else {
        // Regex pattern - find matches
        const matches = allFiles.filter(file => pattern.test(file));
        if (matches.length > 0) {
          // Sort by modification time, most recent first
          const sortedMatches = matches
            .map(file => ({
              name: file,
              path: join(processedDir, file),
              stat: statSync(join(processedDir, file))
            }))
            .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
          
          return sortedMatches[0].path;
        }
      }
    }
    
    console.warn(`No file found matching patterns for: ${fileName}`);
    console.log(`Available files in ${processedDir}:`, allFiles.slice(0, 10)); // Log first 10 files for debugging
    return null;
    
  } catch (error) {
    console.error(`Error searching for file ${fileName}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get("file");

    if (!fileName) {
      return new NextResponse("File parameter is required", { status: 400 });
    }

    // Security check to prevent directory traversal
    const sanitizedFileName = path.basename(fileName);

    // Find the actual file
    const filePath = await findFile(sanitizedFileName);

    if (!filePath) {
      console.error(`File not found: ${sanitizedFileName}`);
      return new NextResponse("File not found", { status: 404 });
    }

    // Get the file type and size
    const fileStat = await stat(filePath);
    const isTextFile = filePath.toLowerCase().endsWith(".txt");

    // Get the content type
    const contentType = isTextFile ? "text/plain" : "application/pdf";

    // Read the file
    const fileBuffer = await readFile(filePath);

    // Return the file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${sanitizedFileName}"`,
        "Content-Length": fileStat.size.toString(),
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return new NextResponse("Error serving file", { status: 500 });
  }
}

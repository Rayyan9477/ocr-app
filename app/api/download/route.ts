import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import path from "path";
import appConfig from "@/lib/config";

async function findFile(fileName: string): Promise<string | null> {
  const processedDir = appConfig.processedDir;

  // Try exact match first
  const exactPath = join(processedDir, fileName);
  if (existsSync(exactPath)) {
    console.log(`Download API: Found exact match for ${fileName}`);
    return exactPath;
  }

  // Try the enhanced directory if it exists
  const enhancedPath = join(processedDir, 'enhanced', fileName);
  if (existsSync(enhancedPath)) {
    console.log(`Download API: Found enhanced version for ${fileName}`);
    return enhancedPath;
  }

  // If not found, try different variations
  const baseName = path.parse(fileName).name;
  
  // Try to find smart OCR files with timestamps
  const smartOcrFiles = await findSmartOcrFiles(processedDir, baseName);
  if (smartOcrFiles.length > 0) {
    console.log(`Download API: Found smart OCR file for ${fileName}: ${path.basename(smartOcrFiles[0])}`);
    return smartOcrFiles[0];
  }
  
  // Try standard OCR format
  const standardOcrPath = join(processedDir, `${baseName}_ocr.pdf`);
  if (existsSync(standardOcrPath)) {
    console.log(`Download API: Found standard OCR file for ${fileName}: ${path.basename(standardOcrPath)}`);
    return standardOcrPath;
  }
  
  // Try forced OCR format
  const forcedOcrPath = join(processedDir, `${baseName}_forced_ocr.pdf`);
  if (existsSync(forcedOcrPath)) {
    console.log(`Download API: Found forced OCR file for ${fileName}: ${path.basename(forcedOcrPath)}`);
    return forcedOcrPath;
  }

  // Last resort: search for any file that contains the baseName
  try {
    const files = await readdir(processedDir);
    const possibleMatch = files.find(file => 
      file.includes(baseName) && (file.endsWith('.pdf') || file.endsWith('.txt'))
    );
    
    if (possibleMatch) {
      console.log(`Download API: Found possible match for ${fileName}: ${possibleMatch}`);
      return join(processedDir, possibleMatch);
    }
  } catch (err) {
    console.error('Error searching for similar files:', err);
  }

  console.log(`Download API: No file found for ${fileName}`);
  return null;
}

async function findSmartOcrFiles(
  dir: string,
  baseName: string
): Promise<string[]> {
  try {
    const files = await readdir(dir);
    
    // First, try exact pattern matching
    const timestampPattern = new RegExp(`${baseName}_\\d+_smart_ocr\\.pdf$`);
    let matches = files
      .filter(file => timestampPattern.test(file))
      .map(file => join(dir, file));
    
    if (matches.length === 0 && baseName.startsWith('input_')) {
      // If no matches and it's an input file, try finding any input_*_smart_ocr.pdf
      const inputPattern = /input_\d+_smart_ocr\.pdf$/;
      matches = files
        .filter(file => inputPattern.test(file))
        .map(file => join(dir, file));
    }
    
    if (matches.length === 0) {
      // If still no matches, try a more relaxed pattern
      const relaxedPattern = new RegExp(`${baseName}.*_smart_ocr\\.pdf$`);
      matches = files
        .filter(file => relaxedPattern.test(file))
        .map(file => join(dir, file));
    }
    
    // Sort by name (which includes timestamp) with most recent first
    return matches.sort().reverse();
  } catch (err) {
    console.error('Error finding smart OCR files:', err);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get("file");

    if (!fileName) {
      return new NextResponse("File parameter is required", { status: 400 });
    }

    console.log(`Download API request for: ${fileName}`);

    // Security check to prevent directory traversal
    const sanitizedFileName = path.basename(fileName);

    // Find the actual file
    const filePath = await findFile(sanitizedFileName);

    if (!filePath) {
      console.error(`Download API: File not found: ${sanitizedFileName}`);
      return new NextResponse("File not found", { status: 404 });
    }

    // Get the file type and size
    const fileStat = await stat(filePath);
    const isTextFile = filePath.toLowerCase().endsWith(".txt");

    // Get the content type
    const contentType = isTextFile ? "text/plain" : "application/pdf";

    // Read the file
    const fileBuffer = await readFile(filePath);
    
    console.log(`Download API: Successfully serving file ${path.basename(filePath)}`);

    // Return the file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${path.basename(filePath)}"`,
        "Content-Length": fileStat.size.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return new NextResponse("Error serving file", { status: 500 });
  }
}

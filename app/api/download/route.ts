import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import path from "path";
import appConfig from "@/lib/config";

async function findFile(fileName: string): Promise<string | null> {
  const processedDir = appConfig.processedDir;
  const baseName = path.parse(fileName).name;
  const extension = path.parse(fileName).ext;
  
  // If we're already looking for a file with _ocr suffix
  if (baseName.endsWith('_ocr')) {
    const exactPath = join(processedDir, fileName);
    if (existsSync(exactPath)) {
      console.log(`Download API: Found exact OCR file: ${fileName}`);
      return exactPath;
    }
    
    // Try without the _ocr suffix to find the original file name with _ocr suffix
    const originalName = baseName.replace('_ocr', '');
    const originalPath = join(processedDir, `${originalName}_ocr${extension}`);
    if (existsSync(originalPath)) {
      console.log(`Download API: Found OCR file from modified request: ${originalPath}`);
      return originalPath;
    }
  }
  
  // Clean the base name by removing any timestamp prefix
  const cleanedBaseName = baseName.replace(/^input_\d+_/, '');

  // Standard naming: filename_ocr.pdf
  const ocrFileName = `${cleanedBaseName}_ocr${extension}`;
  const ocrPath = join(processedDir, ocrFileName);
  if (existsSync(ocrPath)) {
    console.log(`Download API: Found OCR file for ${fileName}: ${ocrFileName}`);
    return ocrPath;
  }

  // Secondary: Try the enhanced directory
  const enhancedPath = join(processedDir, 'enhanced', ocrFileName);
  if (existsSync(enhancedPath)) {
    console.log(`Download API: Found enhanced OCR file for ${fileName}: ${ocrFileName}`);
    return enhancedPath;
  }
  
  // Also try the exact file in enhanced directory
  const enhancedExactPath = join(processedDir, 'enhanced', fileName);
  if (existsSync(enhancedExactPath)) {
    console.log(`Download API: Found enhanced exact file: ${fileName}`);
    return enhancedExactPath;
  }
  
  // Last resort: search for any file that contains the baseName with _ocr
  try {
    const files = await readdir(processedDir);
    
    // First try exact filename match
    if (files.includes(fileName)) {
      console.log(`Download API: Found exact file match: ${fileName}`);
      return join(processedDir, fileName);
    }
    
    // Then try finding any file with the cleanedBaseName and _ocr suffix
    const possibleMatch = files.find(file => 
      (file.includes(`${cleanedBaseName}_ocr`) || 
       file === `${cleanedBaseName}${extension}` ||
       file === fileName) && 
      (file.endsWith('.pdf') || file.endsWith('.txt'))
    );
    
    if (possibleMatch) {
      console.log(`Download API: Found possible OCR match for ${fileName}: ${possibleMatch}`);
      return join(processedDir, possibleMatch);
    }
    
    // If baseName already has _ocr suffix, try with the base name without it
    if (baseName.endsWith('_ocr')) {
      const baseWithoutOcr = baseName.replace('_ocr', '');
      const matchWithoutOcr = files.find(file => 
        file.includes(baseWithoutOcr) && 
        (file.endsWith('.pdf') || file.endsWith('.txt'))
      );
      
      if (matchWithoutOcr) {
        console.log(`Download API: Found match without _ocr suffix for ${fileName}: ${matchWithoutOcr}`);
        return join(processedDir, matchWithoutOcr);
      }
    }
  } catch (err) {
    console.error('Error searching for OCR files:', err);
  }
  
  // Final fallback: Search for any file with the same name (ignoring prefixes/suffixes)
  // This is especially useful when we're looking for filenames like superbill2_ocr.pdf
  try {
    const fileNameWithoutExtension = baseName.replace('_ocr', '');
    
    // Recursive function to search all subdirectories
    async function searchDirectory(directory: string): Promise<string | null> {
      const entries = await readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(directory, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const result = await searchDirectory(fullPath);
          if (result) return result;
        } else if (entry.name.includes(fileNameWithoutExtension) && 
                  (entry.name.endsWith('.pdf') || entry.name.endsWith('.txt'))) {
          console.log(`Download API: Found file by deep search: ${entry.name}`);
          return fullPath;
        }
      }
      
      return null;
    }
    
    const deepSearchResult = await searchDirectory(processedDir);
    if (deepSearchResult) {
      return deepSearchResult;
    }
  } catch (err) {
    console.error('Error during deep search for files:', err);
  }

  console.log(`Download API: No OCR file found for ${fileName}`);
  return null;
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
    let filePath = await findFile(sanitizedFileName);

    // If not found and the filename doesn't end with _ocr.pdf, try adding it
    if (!filePath && !sanitizedFileName.endsWith('_ocr.pdf') && sanitizedFileName.endsWith('.pdf')) {
      const baseNameWithoutExt = path.basename(sanitizedFileName, '.pdf');
      const fileNameWithOcr = `${baseNameWithoutExt}_ocr.pdf`;
      console.log(`Download API: Original file not found, trying with OCR suffix: ${fileNameWithOcr}`);
      filePath = await findFile(fileNameWithOcr);
    }

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

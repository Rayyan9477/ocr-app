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
    return exactPath;
  }

  // If not found, try different variations
  const baseName = path.parse(fileName).name;
  const possiblePaths = [
    // Original format
    join(processedDir, `${baseName}_ocr.pdf`),
    // New smart OCR format with timestamp
    ...(await findSmartOcrFiles(processedDir, baseName)),
  ];

  for (const possiblePath of possiblePaths) {
    if (existsSync(possiblePath)) {
      return possiblePath;
    }
  }

  return null;
}

async function findSmartOcrFiles(
  dir: string,
  baseName: string
): Promise<string[]> {
  const pattern = new RegExp(`${baseName}_\\d+_smart_ocr\\.pdf$`);
  const files = await readdir(dir);
  return files
    .filter((file) => pattern.test(file))
    .map((file) => join(dir, file))
    .sort() // Sort by name (which includes timestamp)
    .reverse(); // Most recent first
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

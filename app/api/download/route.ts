import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import path from "path";
import appConfig from "@/lib/config";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get("file");

    if (!fileName) {
      return new NextResponse("File parameter is required", { status: 400 });
    }

    // Security check to prevent directory traversal
    const sanitizedFileName = path.basename(fileName);

    // Construct the file path
    const filePath = join(appConfig.processedDir, sanitizedFileName);

    // Check if the file exists
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return new NextResponse("File not found", { status: 404 });
    }

    // Get the file type and size
    const fileStat = await stat(filePath);
    const isTextFile = filePath.toLowerCase().endsWith(".txt");
    
    // Get the content type
    const contentType = isTextFile 
      ? "text/plain"
      : "application/pdf";

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

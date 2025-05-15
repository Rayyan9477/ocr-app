import { NextResponse } from "next/server"
import { readFile, stat } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { createReadStream } from "fs"

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
}

export async function GET(request: Request) {
  try {
    // Get the URL params
    const url = new URL(request.url);
    const fileName = url.searchParams.get("file");

    if (!fileName) {
      return createJsonResponse({
        success: false,
        error: "No file specified"
      }, 400);
    }

    // Sanitize filename to prevent directory traversal attacks
    const sanitizedFileName = fileName.replace(/\.\./g, '').replace(/[\/\\]/g, '');
    
    // Define processed directory
    const processedDir = join(process.cwd(), "processed");
    const filePath = join(processedDir, sanitizedFileName);

    // Check if file exists
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return createJsonResponse({
        success: false,
        error: "File not found",
        details: `File ${sanitizedFileName} does not exist`
      }, 404);
    }

    try {
      // Get file information
      const fileInfo = await stat(filePath);
      
      if (fileInfo.size === 0) {
        return createJsonResponse({
          success: false,
          error: "File is empty",
          details: `File ${sanitizedFileName} has zero size`
        }, 400);
      }

      // Read file buffer
      const fileBuffer = await readFile(filePath);

      // Return file with appropriate headers
      return new Response(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${sanitizedFileName}"`,
          "Content-Length": fileInfo.size.toString(),
          "Accept-Ranges": "bytes"
        },
      });
    } catch (fileError) {
      console.error("Error reading file:", fileError);
      return createJsonResponse({
        success: false,
        error: "Error reading file",
        details: (fileError as Error).message
      }, 500);
    }
  } catch (error) {
    console.error("Unhandled error in download route:", error);
    return createJsonResponse({
      success: false,
      error: "Internal server error",
      details: (error as Error).message
    }, 500);
  }
}

export async function PUT() {
  return new Response(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}

export async function DELETE() {
  return new Response(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}

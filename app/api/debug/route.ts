import { NextResponse } from "next/server"
import { readdir, stat } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

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

export async function GET() {
  try {
    const uploadDir = join(process.cwd(), "uploads");
    const processedDir = join(process.cwd(), "processed");
    
    // Information about directories
    const directories: Record<string, any> = {
      uploads: {
        path: uploadDir,
        exists: existsSync(uploadDir),
        files: []
      },
      processed: {
        path: processedDir,
        exists: existsSync(processedDir),
        files: []
      }
    };

    // Get upload directory files
    if (directories.uploads.exists) {
      try {
        const files = await readdir(uploadDir);
        const fileDetails = await Promise.all(
          files.map(async (file) => {
            try {
              const fileStat = await stat(join(uploadDir, file));
              return {
                name: file,
                size: fileStat.size,
                isDirectory: fileStat.isDirectory(),
                created: fileStat.birthtime,
                modified: fileStat.mtime
              };
            } catch (error) {
              console.error(`Error getting stats for ${file}:`, error);
              return {
                name: file,
                error: (error as Error).message
              };
            }
          })
        );
        directories.uploads.files = fileDetails;
      } catch (error) {
        console.error("Error reading upload directory:", error);
        directories.uploads.error = (error as Error).message;
      }
    }

    // Get processed directory files
    if (directories.processed.exists) {
      try {
        const files = await readdir(processedDir);
        const fileDetails = await Promise.all(
          files.map(async (file) => {
            try {
              const fileStat = await stat(join(processedDir, file));
              return {
                name: file,
                size: fileStat.size,
                isDirectory: fileStat.isDirectory(),
                created: fileStat.birthtime,
                modified: fileStat.mtime
              };
            } catch (error) {
              console.error(`Error getting stats for ${file}:`, error);
              return {
                name: file,
                error: (error as Error).message
              };
            }
          })
        );
        directories.processed.files = fileDetails;
      } catch (error) {
        console.error("Error reading processed directory:", error);
        directories.processed.error = (error as Error).message;
      }
    }

    return createJsonResponse({
      success: true,
      directories
    });
  } catch (error) {
    console.error("Error in debug route:", error);
    return createJsonResponse({
      success: false,
      error: "Failed to get debug information",
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

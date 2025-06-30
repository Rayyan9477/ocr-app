import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { createWriteStream } from "fs";
import { readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import * as archiver from "archiver";
import appConfig from "@/lib/config";
import logger from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileNames = searchParams.getAll("files[]"); // Get multiple file names
    const processedDir = join(process.cwd(), "processed");

    // If no files specified, zip all processed files
    if (!fileNames || fileNames.length === 0) {
      const allFiles = await readdir(processedDir);
      fileNames = allFiles.filter(file => file.endsWith('.pdf'));
    }

    if (fileNames.length === 0) {
      return new NextResponse("No files to zip", { status: 400 });
    }

    // Create a temporary zip file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipFileName = `processed_files_${timestamp}.zip`;
    const zipFilePath = join(processedDir, zipFileName);

    // Create a write stream
    const output = createWriteStream(zipFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Listen for archive errors
    archive.on('error', (err) => {
      logger.error('Error creating zip:', err);
      throw err;
    });

    // Pipe archive data to the file
    archive.pipe(output);

    // Add each file to the archive
    let totalSize = 0;
    for (const fileName of fileNames) {
      const filePath = join(processedDir, fileName);
      if (existsSync(filePath)) {
        const stats = await stat(filePath);
        totalSize += stats.size;
        archive.file(filePath, { name: fileName });
      }
    }

    // Finalize the archive
    await archive.finalize();

    // Wait for the output stream to finish
    await new Promise((resolve) => output.on('close', resolve));

    // Read the zip file
    const { readFile } = await import('fs/promises');
    const zipBuffer = await readFile(zipFilePath);

    // Clean up the temporary zip file
    const { unlink } = await import('fs/promises');
    await unlink(zipFilePath);

    // Return the zip file
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFileName}"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error("Error creating zip file:", error);
    return new NextResponse("Error creating zip file", { status: 500 });
  }
}

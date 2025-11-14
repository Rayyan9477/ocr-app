import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { createWriteStream } from "fs";
import { readdir, stat, mkdir } from "fs/promises";
import { existsSync } from "fs";
import archiver from "archiver";
import appConfig from "@/lib/config";
import logger from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let fileNames = searchParams.getAll("files"); // Changed from files[] to files
    const processedDir = join(process.cwd(), "processed");

    // Ensure processed directory exists
    if (!existsSync(processedDir)) {
      await mkdir(processedDir, { recursive: true });
    }

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

    // Create and setup archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Create write stream and handle events
    const output = createWriteStream(zipFilePath);
    
    // Promise to track the completion of the zip creation
    const archiveComplete = new Promise((resolve, reject) => {
      output.on('close', () => resolve(undefined));
      output.on('error', reject);
      archive.on('error', reject);
    });

    // Pipe archive data to the file
    archive.pipe(output);

    // Add each file to the archive
    let totalSize = 0;
    const filesToArchive = [];

    // First, validate all files exist and collect their info
    for (const fileName of fileNames) {
      const filePath = join(processedDir, fileName);
      if (existsSync(filePath)) {
        const stats = await stat(filePath);
        totalSize += stats.size;
        filesToArchive.push({ path: filePath, name: fileName });
      } else {
        logger.warn(`File not found: ${fileName}`);
      }
    }

    if (filesToArchive.length === 0) {
      return new NextResponse("No valid files found to zip", { status: 400 });
    }

    // Add files to archive
    for (const file of filesToArchive) {
      archive.file(file.path, { name: file.name });
    }

    // Finalize the archive
    archive.finalize();

    // Wait for the archive to complete
    await archiveComplete;

    // Read the zip file
    const { readFile } = await import('fs/promises');
    const zipBuffer = await readFile(zipFilePath);

    // Clean up the temporary zip file
    const { unlink } = await import('fs/promises');
    await unlink(zipFilePath).catch(err => {
      logger.error(`Error deleting temporary zip file: ${err instanceof Error ? err.message : String(err)}`);
      // Don't throw, as we still want to return the zip to the user
    });

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
    logger.error(`Error creating zip file: ${error instanceof Error ? error.message : String(error)}`);
    return new NextResponse(
      JSON.stringify({
        error: "Failed to create ZIP archive",
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

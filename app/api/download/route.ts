import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import path from "path";

// Helper function to find OCR output file with various possible naming patterns
async function findOcrOutputFile(filename: string): Promise<string | null> {
  // List of directories to search
  const searchDirs = [
    join(process.cwd(), 'processed'),
    join(process.cwd(), 'temp-' + filename.split('_')[0]),
    join(process.cwd(), 'output')
  ];

  // Possible suffix patterns
  const suffixes = [
    '_smart_ocr.pdf',
    '_ocr.pdf',
    `_${Date.now()}_ocr.pdf`
  ];

  const baseName = path.basename(filename, path.extname(filename));

  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;

    const files = await readdir(dir);
    
    // First try exact match
    if (files.includes(filename)) {
      return join(dir, filename);
    }

    // Try variations with different suffixes
    for (const suffix of suffixes) {
      const possibleName = baseName + suffix;
      if (files.includes(possibleName)) {
        return join(dir, possibleName);
      }
    }

    // Try pattern matching for timestamp variations
    const pattern = new RegExp(`^${baseName}_\\d+.*\\.pdf$`);
    const matches = files.filter(f => pattern.test(f));
    if (matches.length > 0) {
      // Return the most recent file (assuming timestamps in filenames)
      const sorted = matches.sort().reverse();
      return join(dir, sorted[0]);
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('file');

    if (!filename) {
      return new NextResponse('No filename provided', { status: 400 });
    }

    // Sanitize the filename
    const sanitizedFilename = path.basename(filename);
    
    // Find the file
    const filePath = await findOcrOutputFile(sanitizedFilename);
    
    if (!filePath || !existsSync(filePath)) {
      console.error('File not found:', sanitizedFilename);
      // Try looking for variations of the filename
      console.log('Searching for variations of', path.basename(sanitizedFilename, '.pdf'));
      return new NextResponse('File not found', { status: 404 });
    }

    // Read the file
    const fileBuffer = await readFile(filePath);

    // Determine content type
    const contentType = filePath.toLowerCase().endsWith('.txt') ? 'text/plain' : 'application/pdf';

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return new NextResponse('Error serving file', { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat, readdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import appConfig from '@/lib/config';

async function findFile(fileName: string): Promise<string | null> {
  const processedDir = appConfig.processedDir;

  // Try exact match first
  const exactPath = path.join(processedDir, fileName);
  if (existsSync(exactPath)) {
    console.log(`Direct file access: Found exact match for ${fileName}`);
    return exactPath;
  }

  // If not found, try looking for files with similar pattern
  try {
    const files = await readdir(processedDir);
    const fileBaseName = path.parse(fileName).name.split('_').slice(0, -2).join('_'); // Remove timestamp and suffix
    
    // Look for files that match the base name pattern
    const matchingFiles = files.filter(file => {
      return file.includes(fileBaseName) || 
             (fileName.startsWith('input_') && file.startsWith('input_'));
    });
    
    if (matchingFiles.length > 0) {
      // Sort by timestamp (newest first) if possible
      matchingFiles.sort().reverse();
      console.log(`Direct file access: Found alternative file for ${fileName}: ${matchingFiles[0]}`);
      return path.join(processedDir, matchingFiles[0]);
    }
  } catch (err) {
    console.error('Error searching for similar files:', err);
  }

  console.log(`Direct file access: No file found for ${fileName}`);
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    // Get the filename from the route parameter
    const fileName = params.filename;
    
    console.log(`Direct file access request for: ${fileName}`);
    
    if (!fileName) {
      return new NextResponse('File parameter is required', { status: 400 });
    }

    // Security check to prevent directory traversal
    const sanitizedFileName = path.basename(fileName);
    
    // Find the file
    const filePath = await findFile(sanitizedFileName);
    
    if (!filePath) {
      console.error(`Direct file access: File not found: ${sanitizedFileName}`);
      return new NextResponse('File not found', { status: 404 });
    }

    // Get file info
    const fileStat = await stat(filePath);
    const isTextFile = filePath.toLowerCase().endsWith('.txt');
    const contentType = isTextFile ? 'text/plain' : 'application/pdf';

    // Read and return the file
    const fileBuffer = await readFile(filePath);
    
    console.log(`Direct file access: Successfully serving file ${path.basename(filePath)}`);
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
        'Content-Length': fileStat.size.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });
  } catch (error) {
    console.error('Error serving file via direct access:', error);
    return new NextResponse('Error serving file', { status: 500 });
  }
}

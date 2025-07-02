import { NextRequest, NextResponse } from 'next/server';
import { authService, auditLogger } from '@/lib/hipaa-auth-singleton';
import { promises as fs } from 'fs';
import path from 'path';
import archiver from 'archiver';
import crypto from 'crypto';
import { Readable } from 'stream';
import { cleanupFiles } from '@/lib/cleanup-service';

const SECURE_STORAGE_PATH = process.env.SECURE_STORAGE_PATH || path.join(process.cwd(), 'secure_storage');
const TEMP_ZIP_PATH = path.join(SECURE_STORAGE_PATH, 'temp_zip');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filesParam = searchParams.get('files');
  const zipName = searchParams.get('zipName') || 'hipaa-documents.zip';
  const token = searchParams.get('token');
  
  if (!filesParam && !token) {
    return NextResponse.json(
      { error: 'Either files parameter or token required' },
      { status: 400 }
    );
  }

  try {
    // Authenticate user and validate token
    const sessionToken = request.cookies.get('hipaa-session')?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const session = await authService.validateSession(sessionToken);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    const userId = session.userId;

    // Check permissions
    const hasPermission = await authService.checkPermission(
      userId,
      'file',
      'download'
    );

    if (!hasPermission) {
      await auditLogger.logEvent({
        userId,
        userRole: 'user',
        action: 'ACCESS_DENIED',
        resource: 'hipaa-zip-download',
        outcome: 'FAILURE',
        details: { reason: 'Insufficient permissions' },
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        sessionId: session.id
      });

      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    let fileNames: string[] = [];
    if (token) {
      // Use token to get authorized files
      const validation = await authService.validateDownloadToken(token);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }
      fileNames = validation.fileIds;
    } else {
      // Use files parameter
      fileNames = filesParam.split(',').map(f => f.trim()).filter(f => f.length > 0);
    }
    
    if (fileNames.length === 0) {
      return NextResponse.json(
        { error: 'No valid file names provided' },
        { status: 400 }
      );
    }

    const validFiles: Array<{ name: string; path: string }> = [];

    // Validate all files exist and are accessible
    for (const fileName of fileNames) {
      const filePath = path.join(SECURE_STORAGE_PATH, fileName);
      try {
        await fs.access(filePath);
        validFiles.push({ name: fileName, path: filePath });
      } catch {
        console.warn(`File not found: ${fileName}`);
      }
    }

    if (validFiles.length === 0) {
      return NextResponse.json(
        { error: 'No valid files found to zip' },
        { status: 400 }
      );
    }

    // Create temp directory if it doesn't exist
    await fs.mkdir(TEMP_ZIP_PATH, { recursive: true });

    // Generate unique zip file name
    const tempZipName = `${crypto.randomBytes(16).toString('hex')}.zip`;
    const zipPath = path.join(TEMP_ZIP_PATH, tempZipName);

    // Create zip archive with encryption
    const archive = archiver('zip', {
      zlib: { level: 9 },
      forceLocalTime: true,
      password: crypto.randomBytes(32).toString('hex') // Encrypt the zip
    });

    // Pipe archive to file
    const output = fs.createWriteStream(zipPath);
    archive.pipe(output);

    // Add files to archive
    for (const file of validFiles) {
      archive.file(file.path, { name: path.basename(file.name) });
    }

    await archive.finalize();

    // Log zip download access
    await auditLogger.logEvent({
      userId,
      userRole: 'user',
      action: 'ZIP_DOWNLOAD',
      resource: 'hipaa-zip-download',
      outcome: 'SUCCESS',
      details: {
        fileCount: validFiles.length,
        fileNames: validFiles.map(f => path.basename(f.name))
      },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      sessionId: session.id
    });

    // Set up response headers for zip download
    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="${zipName}"`);
    headers.set('Connection', 'close');

    // Stream the zip file
    const zipContent = await fs.readFile(zipPath);
    const stream = new Readable();
    stream.push(zipContent);
    stream.push(null);

    const response = new NextResponse(stream, { headers });

    // Schedule cleanup
    response.on('finish', async () => {
      try {
        // Clean up temp zip file
        await cleanupFiles([zipPath]);

        // Clean up original files if using token (one-time download)
        if (token) {
          await cleanupFiles(validFiles.map(f => f.path));
          await authService.invalidateDownloadToken(token);
        }
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    });

    return response;
  } catch (error) {
    console.error('Error in zip download:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

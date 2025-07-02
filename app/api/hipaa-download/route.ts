import { NextRequest, NextResponse } from 'next/server';
import { authService, auditLogger } from '@/lib/hipaa-auth-singleton';
import { HIPAAOCRService } from '@/lib/hipaa-ocr-service';
import { promises as fs } from 'fs';
import path from 'path';

const getEncryptionKey = () => {
  const key = process.env.HIPAA_ENCRYPTION_KEY || 'default-dev-key-change-in-production-must-be-64-hex-chars';
  return key.length === 64 ? key : key.padEnd(64, '0').substring(0, 64);
};

const ocrService = new HIPAAOCRService(getEncryptionKey());

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');
  const fileName = searchParams.get('fileName');
  
  if (!fileId && !fileName) {
    return NextResponse.json(
      { error: 'File ID or file name required' },
      { status: 400 }
    );
  }

  try {
    // Authenticate user
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
        resource: 'hipaa-download',
        outcome: 'FAILURE',
        details: { reason: 'Insufficient permissions', fileId, fileName },
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        sessionId: session.id
      });

      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // For immediate processing (no retention), check processed directory
    const processedDir = path.join(process.cwd(), 'processed');
    let filePath: string;
    let actualFileName: string;

    if (fileName) {
      filePath = path.join(processedDir, fileName);
      actualFileName = fileName;
    } else {
      // Try to find file by ID in processed directory
      const files = await fs.readdir(processedDir);
      const matchingFile = files.find(f => f.includes(fileId || ''));
      
      if (!matchingFile) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }
      
      filePath = path.join(processedDir, matchingFile);
      actualFileName = matchingFile;
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Log download access
    await auditLogger.logEvent({
      userId,
      userRole: 'user',
      action: 'FILE_DOWNLOAD',
      resource: 'hipaa-file',
      outcome: 'SUCCESS',
      details: { 
        fileName: actualFileName,
        fileId: fileId || 'unknown',
        downloadTime: new Date().toISOString()
      },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      sessionId: session.id
    });

    // Read and return file
    const fileBuffer = await fs.readFile(filePath);
    const response = new NextResponse(fileBuffer);
    
    response.headers.set('Content-Type', 'application/pdf');
    response.headers.set('Content-Disposition', `attachment; filename="${actualFileName}"`);
    response.headers.set('X-HIPAA-Compliant', 'true');
    response.headers.set('X-No-Retention', 'true');
    
    return response;

  } catch (error) {
    console.error('HIPAA download error:', error);
    
    await auditLogger.logEvent({
      userId: 'unknown',
      userRole: 'user',
      action: 'FILE_DOWNLOAD',
      resource: 'system',
      outcome: 'FAILURE',
      details: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        fileId,
        fileName
      },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      sessionId: 'unknown'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

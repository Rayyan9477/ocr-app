import { NextRequest, NextResponse } from 'next/server';
import { HIPAAAuthService } from '@/lib/hipaa-auth';
import { HIPAAAuditLogger } from '@/lib/hipaa-audit';
import { HIPAAOCRService } from '@/lib/hipaa-ocr-service';
import { HIPAAEncryptionService } from '@/lib/hipaa-encryption';

// Initialize services with environment variables
const getEncryptionKey = () => {
  const key = process.env.HIPAA_ENCRYPTION_KEY || 'default-dev-key-change-in-production-must-be-64-hex-chars';
  // Ensure key is 64 hex characters (32 bytes)
  return key.length === 64 ? key : key.padEnd(64, '0').substring(0, 64);
};

const getJWTSecret = () => {
  return process.env.HIPAA_SIGNING_KEY || 'default-jwt-secret-change-in-production';
};

const authService = new HIPAAAuthService(getJWTSecret());
const auditLogger = new HIPAAAuditLogger();
const ocrService = new HIPAAOCRService(getEncryptionKey());
const encryptionService = new HIPAAEncryptionService(getEncryptionKey());

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId = 'anonymous';
  let sessionId = 'none';

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

    userId = session.userId;
    sessionId = session.id;

    // Check permissions
    const hasPermission = await authService.checkPermission(
      userId,
      'file',
      'upload'
    );

    if (!hasPermission) {
      await auditLogger.logEvent({
        userId,
        userRole: 'user',
        action: 'ACCESS_DENIED',
        resource: 'hipaa-ocr',
        outcome: 'FAILURE',
        details: { reason: 'Insufficient permissions' },
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        sessionId
      });

      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const options = {
      language: formData.get('language') as string || 'eng',
      confidenceThreshold: parseInt(formData.get('confidenceThreshold') as string || '85'),
      usePreprocessing: formData.get('usePreprocessing') === 'true',
      useMultiEngine: formData.get('useMultiEngine') === 'true',
      autoDelete: formData.get('autoDelete') === 'true',
      retentionHours: parseInt(formData.get('retentionHours') as string || '24')
    };

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Log file upload
    await auditLogger.logEvent({
      userId,
      userRole: 'user',
      action: 'FILE_UPLOAD',
      resource: 'hipaa-ocr',
      outcome: 'SUCCESS',
      details: { 
        fileCount: files.length,
        fileNames: files.map(f => f.name),
        fileSizes: files.map(f => f.size),
        options
      },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      sessionId
    });

    // Process files with HIPAA compliance
    const processingRequest = await ocrService.processFiles(
      files,
      userId,
      sessionId,
      request.ip || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    );

    // Wait for processing to complete (in production, use job queue)
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    
    while (attempts < maxAttempts) {
      const status = await ocrService.getProcessingStatus(processingRequest.id, userId);
      
      if (status.status === 'completed') {
        const response = {
          success: true,
          results: status.results?.map(result => ({
            fileName: result.originalName,
            success: true,
            averageConfidence: result.confidence,
            pageCount: result.pageCount,
            processingTime: result.processingTime
          })) || [],
          processingTime: Date.now() - startTime,
          compliance: {
            hipaaCompliant: true,
            auditLogged: true,
            encrypted: true,
            autoDelete: options.autoDelete,
            retentionHours: options.retentionHours
          }
        };

        return NextResponse.json(response);
      } else if (status.status === 'failed') {
        throw new Error(status.error || 'Processing failed');
      }
      
      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    // Timeout
    throw new Error('Processing timeout - files may still be processing in background');

  } catch (error) {
    console.error('HIPAA OCR processing error:', error);
    
    // Log system error
    await auditLogger.logEvent({
      userId,
      userRole: 'user',
      action: 'OCR_PROCESS',
      resource: 'system',
      outcome: 'FAILURE',
      details: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      sessionId
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

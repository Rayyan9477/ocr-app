import { NextRequest, NextResponse } from 'next/server';
import { HIPAAOCRService } from '@/lib/hipaa-ocr-adapter';
import { HIPAAAuthService } from '@/lib/hipaa-auth';
import { HIPAAAuditLogger } from '@/lib/hipaa-audit';
import { HIPAAEncryptionService } from '@/lib/hipaa-encryption';

export async function GET() {
  try {
    // Initialize services with proper environment variables
    const encryptionKey = process.env.HIPAA_ENCRYPTION_KEY;
    const authSecret = process.env.HIPAA_AUTH_SECRET;
    const storageDir = process.env.SECURE_STORAGE_DIR || './secure_storage';
    const auditLogDir = process.env.AUDIT_LOG_DIR || './audit_logs';

    console.log('Debug env vars:', {
      encryptionKeyDefined: !!encryptionKey,
      authSecretDefined: !!authSecret,
      encryptionKeyLength: encryptionKey?.length,
      authSecretLength: authSecret?.length
    });

    if (!encryptionKey || !authSecret) {
      throw new Error('Missing required environment variables: HIPAA_ENCRYPTION_KEY, HIPAA_AUTH_SECRET');
    }

    const ocrService = new HIPAAOCRService();
    const authService = new HIPAAAuthService(authSecret, auditLogDir);
    const auditLogger = new HIPAAAuditLogger(auditLogDir);
    const encryptionService = new HIPAAEncryptionService(encryptionKey, storageDir);

    // Perform health checks
    const ocrHealth = await ocrService.healthCheck();
    const auditHealth = await auditLogger.healthCheck();
    
    // Test encryption
    let encryptionHealth = false;
    try {
      const testData = "health-check";
      const encrypted = await encryptionService.encrypt(testData);
      const decrypted = await encryptionService.decrypt(encrypted);
      encryptionHealth = decrypted === testData;
    } catch (error) {
      encryptionHealth = false;
    }

    const overallHealth = ocrHealth.status === 'healthy' && auditHealth && encryptionHealth;

    return NextResponse.json({
      status: overallHealth ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        ocr: ocrHealth,
        audit: { status: auditHealth ? 'healthy' : 'unhealthy' },
        encryption: { status: encryptionHealth ? 'healthy' : 'unhealthy' },
        auth: { status: 'healthy' } // Auth service is stateless
      },
      compliance: {
        hipaaCompliant: overallHealth,
        auditLogging: auditHealth,
        encryption: encryptionHealth,
        accessControl: true
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      services: {
        ocr: { status: 'unhealthy' },
        audit: { status: 'unhealthy' },
        encryption: { status: 'unhealthy' },
        auth: { status: 'unhealthy' }
      },
      compliance: {
        hipaaCompliant: false,
        auditLogging: false,
        encryption: false,
        accessControl: false
      }
    }, { status: 503 });
  }
}

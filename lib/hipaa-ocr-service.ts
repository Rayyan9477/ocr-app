import { HIPAAEncryptionService, type EncryptedFile } from './hipaa-encryption';
import { HIPAAAuditLogger } from './hipaa-audit';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import path from 'path';

interface ProcessingRequest {
  id: string;
  userId: string;
  sessionId: string;
  files: EncryptedFile[];
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: ProcessingResult[];
  error?: string;
}

interface ProcessingResult {
  fileId: string;
  originalName: string;
  ocrText: string;
  confidence: number;
  processingTime: number;
  pageCount: number;
  checksum: string;
}

interface HIPAACompliantConfig {
  maxFileSize: number;
  allowedFileTypes: string[];
  maxProcessingTime: number;
  dataRetentionHours: number;
  enableWatermarking: boolean;
  auditAllAccess: boolean;
}

class HIPAACompliantOCRService {
  private encryptionService: HIPAAEncryptionService;
  private auditLogger: HIPAAAuditLogger;
  private config: HIPAACompliantConfig;
  
  // In-memory storage for demo - use database in production
  private processingRequests: Map<string, ProcessingRequest> = new Map();

  constructor(
    encryptionKey: string,
    config: Partial<HIPAACompliantConfig> = {}
  ) {
    this.encryptionService = new HIPAAEncryptionService(encryptionKey);
    this.auditLogger = new HIPAAAuditLogger();
    
    this.config = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedFileTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.tiff'],
      maxProcessingTime: 300000, // 5 minutes
      dataRetentionHours: 24,
      enableWatermarking: true,
      auditAllAccess: true,
      ...config
    };
  }

  async processFiles(
    files: File[],
    userId: string,
    sessionId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<ProcessingRequest> {
    const requestId = crypto.randomUUID();
    
    try {
      // Validate files
      await this.validateFiles(files);
      
      // Log processing initiation
      await this.auditLogger.logEvent(
        userId,
        'user',
        'OCR_PROCESS',
        `processing_request:${requestId}`,
        'SUCCESS',
        {
          fileCount: files.length,
          totalSize: files.reduce((sum, f) => sum + f.size, 0),
        },
        { ip: ipAddress, userAgent, sessionId }
      );

      // Create processing request
      const request: ProcessingRequest = {
        id: requestId,
        userId,
        sessionId,
        files: [],
        createdAt: new Date(),
        status: 'pending',
      };

      this.processingRequests.set(requestId, request);

      // Encrypt and store files
      for (const file of files) {
        const tempPath = path.join('/tmp', `upload_${crypto.randomUUID()}`);
        await this.saveTemporaryFile(file, tempPath);
        
        const encryptedFile = await this.encryptionService.encryptFile(
          tempPath,
          file.name,
          this.config.dataRetentionHours
        );
        
        request.files.push(encryptedFile);
        
        // Log file encryption
        await this.auditLogger.logEvent(
          userId,
          'user',
          'FILE_UPLOAD',
          `file:${encryptedFile.id}`,
          'SUCCESS',
          {
            originalName: file.name,
            size: file.size,
            encrypted: true,
          },
          { ip: ipAddress, userAgent, sessionId }
        );
      }

      // Start async processing
      this.processOCRAsync(request, { ip: ipAddress, userAgent, sessionId });
      
      return request;
      
    } catch (error) {
      await this.auditLogger.logEvent(
        userId,
        'user',
        'OCR_PROCESS',
        `processing_request:${requestId}`,
        'FAILURE',
        { error: error.message },
        { ip: ipAddress, userAgent, sessionId }
      );
      
      throw error;
    }
  }

  private async validateFiles(files: File[]): Promise<void> {
    for (const file of files) {
      // Check file size
      if (file.size > this.config.maxFileSize) {
        throw new Error(`File ${file.name} exceeds maximum size limit`);
      }
      
      // Check file type
      const ext = path.extname(file.name).toLowerCase();
      if (!this.config.allowedFileTypes.includes(ext)) {
        throw new Error(`File type ${ext} is not allowed`);
      }
      
      // Additional security checks
      await this.scanFileForThreats(file);
    }
  }

  private async scanFileForThreats(file: File): Promise<void> {
    // Implement virus scanning, malware detection
    // For demo purposes, we'll do basic checks
    
    // Check for suspicious file names
    const suspiciousPatterns = [
      /\.exe$/i,
      /\.scr$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.com$/i,
      /\.pif$/i,
      /\.vbs$/i,
      /\.js$/i,
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
      throw new Error('Suspicious file type detected');
    }
  }

  private async saveTemporaryFile(file: File, tempPath: string): Promise<void> {
    const buffer = await file.arrayBuffer();
    await fs.writeFile(tempPath, new Uint8Array(buffer));
  }

  private async processOCRAsync(
    request: ProcessingRequest,
    requestInfo: { ip: string; userAgent: string; sessionId: string }
  ): Promise<void> {
    try {
      request.status = 'processing';
      request.results = [];
      
      for (const encryptedFile of request.files) {
        const result = await this.processEncryptedFile(
          encryptedFile,
          request.userId,
          requestInfo
        );
        request.results.push(result);
      }
      
      request.status = 'completed';
      
      // Log completion
      await this.auditLogger.logEvent(
        request.userId,
        'user',
        'OCR_PROCESS',
        `processing_request:${request.id}`,
        'SUCCESS',
        {
          filesProcessed: request.results.length,
          totalProcessingTime: request.results.reduce((sum, r) => sum + r.processingTime, 0),
        },
        requestInfo
      );
      
    } catch (error) {
      request.status = 'failed';
      request.error = error.message;
      
      await this.auditLogger.logEvent(
        request.userId,
        'user',
        'OCR_PROCESS',
        `processing_request:${request.id}`,
        'FAILURE',
        { error: error.message },
        requestInfo
      );
    }
  }

  private async processEncryptedFile(
    encryptedFile: EncryptedFile,
    userId: string,
    requestInfo: { ip: string; userAgent: string; sessionId: string }
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Log file access
      await this.auditLogger.logEvent(
        userId,
        'user',
        'FILE_ACCESS',
        `file:${encryptedFile.id}`,
        'SUCCESS',
        { purpose: 'OCR_PROCESSING' },
        requestInfo
      );
      
      // Decrypt file for processing
      const tempPath = path.join('/tmp', `process_${crypto.randomUUID()}`);
      await this.encryptionService.decryptFile(encryptedFile, tempPath);
      
      // Perform OCR (simplified for demo)
      const ocrResult = await this.performOCR(tempPath);
      
      // Clean up temporary file
      await fs.unlink(tempPath);
      
      const processingTime = Date.now() - startTime;
      
      const result: ProcessingResult = {
        fileId: encryptedFile.id,
        originalName: encryptedFile.originalName,
        ocrText: ocrResult.text,
        confidence: ocrResult.confidence,
        processingTime,
        pageCount: ocrResult.pageCount,
        checksum: crypto.createHash('sha256').update(ocrResult.text).digest('hex'),
      };
      
      // Add watermark if enabled
      if (this.config.enableWatermarking) {
        result.ocrText = this.addWatermark(result.ocrText, userId);
      }
      
      return result;
      
    } catch (error) {
      await this.auditLogger.logEvent(
        userId,
        'user',
        'FILE_ACCESS',
        `file:${encryptedFile.id}`,
        'FAILURE',
        { error: error.message },
        requestInfo
      );
      
      throw error;
    }
  }

  private async performOCR(filePath: string): Promise<{
    text: string;
    confidence: number;
    pageCount: number;
  }> {
    // This is a simplified OCR implementation
    // In production, use Tesseract.js or similar
    
    // Simulate OCR processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      text: 'Sample OCR text from processed document',
      confidence: 95.5,
      pageCount: 1,
    };
  }

  private addWatermark(text: string, userId: string): string {
    const watermark = `\n\n[PROCESSED BY OCR SYSTEM - USER: ${userId} - DATE: ${new Date().toISOString()}]`;
    return text + watermark;
  }

  async getProcessingStatus(requestId: string, userId: string): Promise<ProcessingRequest | null> {
    const request = this.processingRequests.get(requestId);
    
    if (!request || request.userId !== userId) {
      return null;
    }
    
    return request;
  }

  async downloadResult(
    requestId: string,
    fileId: string,
    userId: string,
    requestInfo: { ip: string; userAgent: string; sessionId: string }
  ): Promise<string | null> {
    const request = this.processingRequests.get(requestId);
    
    if (!request || request.userId !== userId || request.status !== 'completed') {
      return null;
    }
    
    const result = request.results?.find(r => r.fileId === fileId);
    
    if (!result) {
      return null;
    }
    
    // Log download
    await this.auditLogger.logEvent(
      userId,
      'user',
      'FILE_DOWNLOAD',
      `file:${fileId}`,
      'SUCCESS',
      {
        requestId,
        originalName: result.originalName,
        downloadType: 'OCR_RESULT',
      },
      requestInfo
    );
    
    return result.ocrText;
  }

  async deleteProcessingRequest(
    requestId: string,
    userId: string,
    requestInfo: { ip: string; userAgent: string; sessionId: string }
  ): Promise<void> {
    const request = this.processingRequests.get(requestId);
    
    if (!request || request.userId !== userId) {
      throw new Error('Processing request not found or access denied');
    }
    
    // Securely delete encrypted files
    for (const file of request.files) {
      await this.encryptionService.secureDelete(file.encryptedPath);
      
      // Log deletion
      await this.auditLogger.logEvent(
        userId,
        'user',
        'FILE_DELETE',
        `file:${file.id}`,
        'SUCCESS',
        { requestId, originalName: file.originalName },
        requestInfo
      );
    }
    
    // Remove from memory
    this.processingRequests.delete(requestId);
    
    // Log request deletion
    await this.auditLogger.logEvent(
      userId,
      'user',
      'FILE_DELETE',
      `processing_request:${requestId}`,
      'SUCCESS',
      { filesDeleted: request.files.length },
      requestInfo
    );
  }

  async cleanupExpiredRequests(): Promise<void> {
    const now = new Date();
    const expiredRequests = Array.from(this.processingRequests.values()).filter(
      request => {
        const expiryTime = new Date(request.createdAt);
        expiryTime.setHours(expiryTime.getHours() + this.config.dataRetentionHours);
        return now > expiryTime;
      }
    );
    
    for (const request of expiredRequests) {
      try {
        await this.deleteProcessingRequest(
          request.id,
          request.userId,
          { ip: 'SYSTEM', userAgent: 'CLEANUP', sessionId: 'SYSTEM' }
        );
      } catch (error) {
        console.error(`Failed to cleanup request ${request.id}:`, error);
      }
    }
  }
}

// Export with the expected name for compatibility
export { HIPAACompliantOCRService as HIPAAOCRService, type ProcessingRequest, type ProcessingResult };

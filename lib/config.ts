/**
 * Simple configuration file
 */

export interface AppConfig {
  ocrTimeout: number;
  uploadDir: string;
  processedDir: string;
  maxFileSize: number;
  jbig2Path?: string;
  confidence: {
    enableConfidenceTracking: boolean;
    minConfidence: number;
  };
}

const appConfig: AppConfig = {
  ocrTimeout: Number(process.env.OCR_TIMEOUT) || 600000,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  processedDir: process.env.PROCESSED_DIR || 'processed',
  maxFileSize: Number(process.env.MAX_FILE_SIZE) || 52428800,
  jbig2Path: process.env.JBIG2_PATH || undefined,
  confidence: {
    enableConfidenceTracking: process.env.ENABLE_CONFIDENCE_TRACKING === 'true' || false,
    minConfidence: Number(process.env.MIN_CONFIDENCE) || 70
  }
};

export default appConfig;

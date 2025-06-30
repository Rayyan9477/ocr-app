import path from 'path';

// Configuration utility to manage environment variables with defaults and validation
class AppConfig {
  // Server
  port: number = parseInt(process.env.PORT || '3000');
  nodeEnv: string = process.env.NODE_ENV || 'development';
  debug: boolean = process.env.DEBUG === 'true';
  
  // File limits
  maxUploadSize: number = parseInt(process.env.MAX_UPLOAD_SIZE || '10'); // in MB
  nodeMemory: number = parseInt(process.env.NODE_MEMORY || '4096'); // in MB
  
  // OCR configuration
  defaultLanguage: string = process.env.DEFAULT_LANGUAGE || 'eng';
  enableOptimization: boolean = process.env.ENABLE_OPTIMIZATION !== 'false';
  ocrTimeout: number = parseInt(process.env.OCR_TIMEOUT || '300000'); // in ms
  jbig2Path: string = process.env.JBIG2_PATH || '';
  
  // Storage paths
  uploadsDir: string = path.join(process.cwd(), 'uploads');
  processedDir: string = path.join(process.cwd(), 'output');
  tempDir: string = path.join(process.cwd(), 'tmp');
  
  // Cleanup configuration
  cleanupInterval: number = parseInt(process.env.CLEANUP_INTERVAL || '3600000'); // in ms
  maxStorageAge: number = parseInt(process.env.MAX_STORAGE_AGE || '86400000'); // in ms
  
  // Medical OCR configuration
  enableMedicalEnhancements: boolean = process.env.ENABLE_MEDICAL_ENHANCEMENTS !== 'false';
  medicalConfig = {
    removeDiacritics: true,
    handleEmptyPages: true,
    enhanceHandwriting: true,
    retryFailedFiles: true,
    usePdfOutput: true
  };
  
  // Confidence detection configuration
  confidence = {
    pageWarningThreshold: 0.8,
    pageErrorThreshold: 0.6,
    enableConfidenceTracking: true
  };
  
  // OCR Engine Paths
  pythonPath: string = process.env.PYTHON_PATH || 'python3';
  pythonModulePath: string = process.env.PYTHON_MODULE_PATH || '';
  
  // Model paths
  modelPaths = {
    documentClassifier: path.join(process.cwd(), 'models/tfjs_model/document_classifier'),
    layoutDetector: path.join(process.cwd(), 'models/tfjs_model/layout_detector'),
    structuredData: path.join(process.cwd(), 'models/tfjs_model/structured_data'),
    medicalEntities: path.join(process.cwd(), 'models/tfjs_model/medical_entities')
  };
}

const appConfig = new AppConfig();
export default appConfig;

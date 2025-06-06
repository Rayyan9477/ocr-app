export interface OCRResult {
  text: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface ModelService {
  initialize(): Promise<void>;
  processImage(imagePath: string): Promise<OCRResult>;
  getCapabilities(): Promise<Record<string, any>>;
}

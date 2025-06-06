export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  source: 'huggingface' | 'local';
  repository?: string;
  capabilities: {
    handwriting: boolean;
    tables: boolean;
    medical: boolean;
    languages: string[];
  };
  requirements: {
    memory: number;  // MB
    diskSpace: number;  // MB
    gpu?: boolean;
  };
}

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

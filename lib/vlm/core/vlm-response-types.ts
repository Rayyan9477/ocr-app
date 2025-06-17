/**
 * VLM Response Types
 * 
 * Standardized response interfaces for VLM operations
 * to ensure consistent data formats across different models.
 */

/**
 * Base interface for all VLM responses
 */
export interface VLMResponse {
  /**
   * Whether the operation was successful
   */
  success: boolean;
  
  /**
   * Confidence score for the result (0-1)
   */
  confidence: number;
  
  /**
   * Processing time in milliseconds
   */
  processingTimeMs: number;
  
  /**
   * Timestamp when the processing was completed
   */
  timestamp: string;
  
  /**
   * Model used for processing
   */
  model: {
    id: string;
    name: string;
    version?: string;
  };
  
  /**
   * Error information if success is false
   */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  
  /**
   * Deployment information
   */
  deployment?: {
    type: 'local' | 'cloud' | 'hybrid';
    provider?: string;
  };
  
  /**
   * Raw model response for debugging (optional)
   */
  rawResponse?: any;
}

/**
 * Response for document analysis operations
 */
export interface DocumentAnalysisResponse extends VLMResponse {
  /**
   * Document type classification
   */
  documentType: string;
  
  /**
   * Document quality assessment
   */
  quality: {
    overall: number;
    resolution: number;
    noise: number;
    contrast: number;
  };
  
  /**
   * Document content characteristics
   */
  content: {
    hasHandwriting: boolean;
    hasTables: boolean;
    hasHighlights: boolean;
    hasImages: boolean;
    hasSignatures: boolean;
    languagePrediction?: string[];
  };
  
  /**
   * Document layout information
   */
  layout?: {
    type: 'paragraph' | 'table' | 'image' | 'form' | 'header' | 'footer' | 'title' | 'other';
    bbox: [number, number, number, number]; // [x1, y1, x2, y2] normalized 0-1
    confidence: number;
  }[];
  
  /**
   * Recommended processing strategies
   */
  recommendations?: {
    preferredEngine: string;
    preprocessingSteps: string[];
    confidenceThreshold?: number;
    priority?: 'accuracy' | 'speed' | 'balanced';
  };
}

/**
 * Response for text extraction operations
 */
export interface TextExtractionResponse extends VLMResponse {
  /**
   * Extracted full text
   */
  text: string;
  
  /**
   * Text blocks with position information
   */
  blocks?: {
    text: string;
    bbox: [number, number, number, number]; // [x1, y1, x2, y2] normalized 0-1
    confidence: number;
    isHandwritten?: boolean;
    isHighlighted?: boolean;
  }[];
  
  /**
   * Text corrections applied
   */
  corrections?: {
    original: string;
    corrected: string;
    confidence: number;
  }[];
  
  /**
   * Detected languages in the text
   */
  languages?: {
    code: string;
    confidence: number;
  }[];
}

/**
 * Response for structured data extraction operations
 */
export interface StructuredDataResponse extends VLMResponse {
  /**
   * Extracted key-value pairs
   */
  keyValuePairs?: {
    key: string;
    value: string;
    confidence: number;
    bbox?: [number, number, number, number]; // [x1, y1, x2, y2] normalized 0-1
  }[];
  
  /**
   * Extracted tables
   */
  tables?: {
    tableId: string;
    bbox: [number, number, number, number]; // [x1, y1, x2, y2] normalized 0-1
    confidence: number;
    headers?: string[];
    rows: string[][];
  }[];
  
  /**
   * Detected forms
   */
  forms?: {
    formId: string;
    fields: {
      name: string;
      value: string;
      confidence: number;
      bbox?: [number, number, number, number]; // [x1, y1, x2, y2] normalized 0-1
    }[];
  }[];
  
  /**
   * Extracted medical entities (if applicable)
   */
  medicalEntities?: {
    entity: string;
    type: string;
    value: string;
    confidence: number;
  }[];
  
  /**
   * Structured representation of the entire document
   */
  documentStructure?: Record<string, any>;
}

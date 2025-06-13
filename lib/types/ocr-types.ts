/**
 * OCR Types - Standardized interfaces for OCR processing
 */

export interface ConfidenceData {
  averageConfidence: number;
  pageConfidence?: {[page: number]: number};
  wordConfidence?: {[word: string]: number};
  sectionConfidence?: {[section: string]: number};
}

/**
 * Standard result interface with consistent confidence handling
 */
export interface StandardOCRResult {
  text: string;
  confidence: number | ConfidenceData;
  engine?: string;
  metadata?: Record<string, any>;
  processingTime?: number;
}

/**
 * Safely normalizes confidence data to ensure consistent structure
 * regardless of whether it's a simple number or complex object
 */
export function normalizeConfidenceData(confidence: number | ConfidenceData | any): ConfidenceData {
  // If it's a number, convert to standard format
  if (typeof confidence === 'number') {
    return {
      averageConfidence: confidence
    };
  }
  
  // If it's already a confidence data object
  if (confidence && typeof confidence === 'object') {
    // Ensure averageConfidence exists and is a number
    if (typeof confidence.averageConfidence !== 'number') {
      // Try to find a numeric value to use
      const fallbackValue = 
        (typeof confidence.confidence === 'number') ? confidence.confidence :
        (typeof confidence.score === 'number') ? confidence.score :
        (typeof confidence.average === 'number') ? confidence.average : 
        0;
      
      return {
        averageConfidence: fallbackValue,
        ...(confidence.pageConfidence ? { pageConfidence: confidence.pageConfidence } : {}),
        ...(confidence.wordConfidence ? { wordConfidence: confidence.wordConfidence } : {}),
        ...(confidence.sectionConfidence ? { sectionConfidence: confidence.sectionConfidence } : {})
      };
    }
    
    // Return existing object with required properties
    return {
      averageConfidence: confidence.averageConfidence,
      ...(confidence.pageConfidence ? { pageConfidence: confidence.pageConfidence } : {}),
      ...(confidence.wordConfidence ? { wordConfidence: confidence.wordConfidence } : {}),
      ...(confidence.sectionConfidence ? { sectionConfidence: confidence.sectionConfidence } : {})
    };
  }
  
  // Default fallback for unknown formats
  return {
    averageConfidence: 0
  };
}

/**
 * Safely extracts the average confidence value regardless of format
 */
export function getAverageConfidence(confidence: number | ConfidenceData | any): number {
  if (typeof confidence === 'number') {
    return confidence;
  }
  
  if (confidence && typeof confidence === 'object') {
    if (typeof confidence.averageConfidence === 'number') {
      return confidence.averageConfidence;
    }
    
    if (typeof confidence.confidence === 'number') {
      return confidence.confidence;
    }
  }
  
  return 0;
}

export interface DocumentConfidence {
  overall: number;
  pages: {[page: number]: number};
  metadata?: {
    processedWith: string;
    timestamp: number;
  };
}

export interface OCRResult {
  text: string;
  confidence: ConfidenceData | number;
  metadata?: Record<string, any>;
  processingTime?: number;
  engineName?: string;
}

export interface ProcessingOptions {
  enhancementMode?: 'standard' | 'aggressive';
  timeout?: number;
  language?: string;
  handleLargePdf?: boolean;
  maxPagesPerChunk?: number;
  confidenceThreshold?: number;
}

export interface LargePdfProcessingResult {
  success: boolean;
  text: string;
  confidence: ConfidenceData;
  processingTime: number;
  chunkCount?: number;
  chunkSizes?: number[];
}

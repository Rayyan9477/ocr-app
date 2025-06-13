/**
 * OCR Types and Confidence Data Handling
 */

// Base confidence data structure
export interface ConfidenceData {
  averageConfidence: number;
  pageConfidence?: number | {[page: number]: number};
  pageConfidences?: number[];
  wordConfidence?: number;
  sectionConfidence?: number;
  hasLowConfidencePages?: boolean;
  warningPages?: number[];
  errorPages?: number[];
  pageCount?: number;
}

// Document analysis result
export interface DocumentAnalysisResult {
  documentType: string;
  language: string;
  quality: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'complex';
  hasImages: boolean;
  hasText: boolean;
  pageCount: number;
  confidence: ConfidenceData;
}

/**
 * Normalizes confidence data to ensure consistent structure
 * regardless of whether it's a simple number or complex object
 */
export function normalizeConfidenceData(confidence: number | ConfidenceData | any): ConfidenceData {
  // If it's a number, convert to standard format
  if (typeof confidence === 'number') {
    return {
      averageConfidence: Math.max(0, Math.min(100, confidence))
    };
  }
  
  // If it's null or undefined
  if (!confidence) {
    return {
      averageConfidence: 0
    };
  }
  
  // If it's already a confidence data object
  if (confidence && typeof confidence === 'object') {
    // Ensure averageConfidence exists and is a number
    if (typeof confidence.averageConfidence !== 'number') {
      // Try to extract from other properties
      let avgConfidence = 0;
      if (typeof confidence.overall === 'number') {
        avgConfidence = confidence.overall;
      } else if (typeof confidence.average === 'number') {
        avgConfidence = confidence.average;
      } else if (typeof confidence.confidence === 'number') {
        avgConfidence = confidence.confidence;
      } else if (Array.isArray(confidence.pageConfidences) && confidence.pageConfidences.length > 0) {
        const validConfidences = confidence.pageConfidences.filter((c: any) => typeof c === 'number');
        if (validConfidences.length > 0) {
          avgConfidence = validConfidences.reduce((sum: number, c: number) => sum + c, 0) / validConfidences.length;
        }
      }
      
      confidence.averageConfidence = avgConfidence;
    }
    
    // Return existing object with required properties and value clamping
    return {
      averageConfidence: Math.max(0, Math.min(100, confidence.averageConfidence)),
      ...(confidence.pageConfidence ? { pageConfidence: confidence.pageConfidence } : {}),
      ...(confidence.pageConfidences ? { pageConfidences: confidence.pageConfidences } : {}),
      ...(confidence.wordConfidence ? { wordConfidence: confidence.wordConfidence } : {}),
      ...(confidence.sectionConfidence ? { sectionConfidence: confidence.sectionConfidence } : {}),
      ...(typeof confidence.hasLowConfidencePages === 'boolean' ? { hasLowConfidencePages: confidence.hasLowConfidencePages } : {}),
      ...(Array.isArray(confidence.warningPages) ? { warningPages: confidence.warningPages } : {}),
      ...(Array.isArray(confidence.errorPages) ? { errorPages: confidence.errorPages } : {}),
      ...(typeof confidence.pageCount === 'number' ? { pageCount: confidence.pageCount } : {})
    };
  }
  
  // Default fallback for unknown formats
  return {
    averageConfidence: 0
  };
}

/**
 * Get average confidence from confidence data
 */
export function getAverageConfidence(confidence: number | ConfidenceData | any): number {
  const normalized = normalizeConfidenceData(confidence);
  return normalized.averageConfidence;
}

/**
 * Check if confidence data indicates low confidence pages
 */
export function hasLowConfidencePages(confidence: ConfidenceData, threshold: number = 70): boolean {
  if (confidence.hasLowConfidencePages !== undefined) {
    return confidence.hasLowConfidencePages;
  }
  
  if (confidence.pageConfidences && confidence.pageConfidences.length > 0) {
    return confidence.pageConfidences.some(c => c < threshold);
  }
  
  return confidence.averageConfidence < threshold;
}

/**
 * Calculate confidence statistics from an array of confidence values
 */
export function calculateConfidenceStats(confidences: number[]): {
  average: number;
  min: number;
  max: number;
  median: number;
  lowCount: number;
  highCount: number;
} {
  if (confidences.length === 0) {
    return {
      average: 0,
      min: 0,
      max: 0,
      median: 0,
      lowCount: 0,
      highCount: 0
    };
  }
  
  const sorted = [...confidences].sort((a, b) => a - b);
  const average = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  const median = sorted.length % 2 === 0 
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  return {
    average,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median,
    lowCount: confidences.filter(c => c < 70).length,
    highCount: confidences.filter(c => c >= 90).length
  };
}

/**
 * Merge multiple confidence data objects
 */
export function mergeConfidenceData(confidenceArray: ConfidenceData[]): ConfidenceData {
  if (confidenceArray.length === 0) {
    return { averageConfidence: 0 };
  }
  
  if (confidenceArray.length === 1) {
    return normalizeConfidenceData(confidenceArray[0]);
  }
  
  const allPageConfidences: number[] = [];
  const allWarningPages: number[] = [];
  const allErrorPages: number[] = [];
  let totalWeight = 0;
  let weightedSum = 0;
  
  confidenceArray.forEach((confidence, index) => {
    const normalized = normalizeConfidenceData(confidence);
    const weight = normalized.pageCount || 1;
    
    weightedSum += normalized.averageConfidence * weight;
    totalWeight += weight;
    
    if (normalized.pageConfidences) {
      allPageConfidences.push(...normalized.pageConfidences);
    }
    
    if (normalized.warningPages) {
      allWarningPages.push(...normalized.warningPages.map(p => p + allPageConfidences.length));
    }
    
    if (normalized.errorPages) {
      allErrorPages.push(...normalized.errorPages.map(p => p + allPageConfidences.length));
    }
  });
  
  const averageConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;
  
  return {
    averageConfidence,
    pageConfidences: allPageConfidences,
    hasLowConfidencePages: allPageConfidences.some(c => c < 70) || allWarningPages.length > 0 || allErrorPages.length > 0,
    warningPages: [...new Set(allWarningPages)],
    errorPages: [...new Set(allErrorPages)],
    pageCount: allPageConfidences.length
  };
}

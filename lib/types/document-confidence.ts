/**
 * TypeScript definitions for document confidence data structures
 */

/**
 * Standard confidence data interface used throughout the application
 */
export interface ConfidenceData {
  /**
   * Average confidence score (0-100)
   */
  averageConfidence: number;
  
  /**
   * Page-level confidence scores (optional)
   */
  pageConfidence?: { [pageNumber: number]: number };
  
  /**
   * Word-level confidence scores (optional)
   */
  wordConfidence?: { [word: string]: number };
  
  /**
   * Section-level confidence scores (optional)
   */
  sectionConfidence?: { [section: string]: number };
  
  /**
   * Pages with warning-level confidence (optional)
   */
  warningPages?: number[];
  
  /**
   * Pages with error-level confidence (optional)
   */
  errorPages?: number[];
  
  /**
   * Additional metadata about the confidence scores (optional)
   */
  metadata?: {
    /**
     * OCR engine that generated the confidence scores
     */
    engine?: string;
    
    /**
     * Timestamp when the confidence was calculated
     */
    timestamp?: number;
    
    /**
     * Method used to calculate confidence
     */
    method?: string;
    
    /**
     * Any additional properties
     */
    [key: string]: any;
  };
  
  /**
   * Any additional properties that might be engine-specific
   */
  [key: string]: any;
}

/**
 * Confidence thresholds for different quality levels
 */
export interface ConfidenceThresholds {
  /**
   * Minimum acceptable confidence score (0-100)
   */
  minimum: number;
  
  /**
   * Warning threshold - below this is considered warning level (0-100)
   */
  warning: number;
  
  /**
   * Good threshold - above this is considered good quality (0-100)
   */
  good: number;
  
  /**
   * Excellent threshold - above this is considered excellent quality (0-100)
   */
  excellent: number;
}

/**
 * Default confidence thresholds
 */
export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  minimum: 50,
  warning: 70,
  good: 85,
  excellent: 95
};

/**
 * Get confidence quality level based on score and thresholds
 */
export function getConfidenceQualityLevel(
  confidence: number | ConfidenceData,
  thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS
): 'error' | 'warning' | 'good' | 'excellent' {
  // Extract numeric confidence value
  const confidenceValue = typeof confidence === 'number' 
    ? confidence 
    : confidence.averageConfidence;
  
  if (confidenceValue < thresholds.minimum) return 'error';
  if (confidenceValue < thresholds.warning) return 'warning';
  if (confidenceValue < thresholds.good) return 'good';
  return 'excellent';
}

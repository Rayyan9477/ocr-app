/**
 * Utilities for handling OCR confidence data
 */
import { ConfidenceData, normalizeConfidenceData, getAverageConfidence } from './types/ocr-types';

/**
 * Normalizes confidence data to a consistent structure, handling both
 * number and object formats safely
 * 
 * @param confidence Confidence data that could be a number or object
 * @returns Normalized ConfidenceData object
 */
export function normalizeConfidenceData(confidence: number | ConfidenceData | any): ConfidenceData {
  // If confidence is a number, convert to standard format
  if (typeof confidence === 'number') {
    return {
      averageConfidence: confidence
    };
  }
  
  // If confidence is null or undefined, return default confidence
  if (!confidence) {
    return {
      averageConfidence: 0
    };
  }
  
  // If confidence is already an object with averageConfidence, ensure it's properly structured
  if (typeof confidence === 'object') {
    // Handle case where averageConfidence might be missing
    if (typeof confidence.averageConfidence !== 'number') {
      // Try to extract from other properties or use a default
      const avgConfidence = 
        typeof confidence.overall === 'number' ? confidence.overall :
        typeof confidence.average === 'number' ? confidence.average : 
        typeof confidence.confidence === 'number' ? confidence.confidence : 0;
      
      return {
        ...confidence,
        averageConfidence: avgConfidence
      };
    }
    
    // Check if the object might have a nested structure
    if (confidence.confidence && typeof confidence.confidence === 'object' && 
        typeof confidence.confidence.averageConfidence === 'number') {
      return {
        ...confidence,
        averageConfidence: confidence.confidence.averageConfidence,
        // Preserve any existing data in the confidence object
        ...(confidence.confidence.pageConfidence && { pageConfidence: confidence.confidence.pageConfidence }),
        ...(confidence.confidence.wordConfidence && { wordConfidence: confidence.confidence.wordConfidence }),
        ...(confidence.confidence.sectionConfidence && { sectionConfidence: confidence.confidence.sectionConfidence })
      };
    }
    
    // Return the already well-formed confidence object
    return confidence;
  }
  
  // Fallback for unexpected formats
  return {
    averageConfidence: 0
  };
}

/**
 * Safely gets a confidence value, with fallback
 * 
 * @param confidence Confidence data that could be a number or object
 * @param defaultValue Default value if confidence is invalid
 * @returns Confidence as a number
 */
export function getConfidenceValue(
  confidence: number | ConfidenceData | null | undefined,
  defaultValue: number = 0
): number {
  if (typeof confidence === 'number') {
    return confidence;
  }
  
  if (confidence && typeof confidence === 'object') {
    // Handle nested confidence objects
    if ('confidence' in confidence && typeof confidence.confidence === 'object' && 
        'averageConfidence' in confidence.confidence) {
      return typeof confidence.confidence.averageConfidence === 'number' 
        ? confidence.confidence.averageConfidence 
        : defaultValue;
    }
    
    // Handle direct averageConfidence property
    if ('averageConfidence' in confidence) {
      return typeof confidence.averageConfidence === 'number' 
        ? confidence.averageConfidence 
        : defaultValue;
    }
    
    // Try alternative properties
    if ('overall' in confidence && typeof confidence.overall === 'number') {
      return confidence.overall;
    }
    
    if ('average' in confidence && typeof confidence.average === 'number') {
      return confidence.average;
    }
  }
  
  return defaultValue;
}

/**
 * Safely combines confidence data from multiple sources
 * 
 * @param confidenceValues Array of confidence values (can be numbers or ConfidenceData objects)
 * @returns Normalized ConfidenceData object with combined values
 */
export function combineConfidenceData(confidenceValues: Array<number | ConfidenceData | any>): ConfidenceData {
  if (!confidenceValues || confidenceValues.length === 0) {
    return { averageConfidence: 0 };
  }

  // If only one value, just normalize it
  if (confidenceValues.length === 1) {
    return normalizeConfidenceData(confidenceValues[0]);
  }

  // Get all numeric confidence values
  const numericValues = confidenceValues.map(value => getAverageConfidence(value));
  
  // Calculate average of all valid values
  const validValues = numericValues.filter(value => typeof value === 'number' && !isNaN(value));
  const averageConfidence = validValues.length > 0 
    ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length 
    : 0;

  // Combine page confidence data if available
  const pageConfidence: {[page: number]: number} = {};
  confidenceValues.forEach(value => {
    const normalized = normalizeConfidenceData(value);
    if (normalized.pageConfidence) {
      Object.entries(normalized.pageConfidence).forEach(([page, confidence]) => {
        const pageNum = Number(page);
        if (!isNaN(pageNum)) {
          if (pageConfidence[pageNum] === undefined) {
            pageConfidence[pageNum] = confidence;
          } else {
            // Average if we already have a value for this page
            pageConfidence[pageNum] = (pageConfidence[pageNum] + confidence) / 2;
          }
        }
      });
    }
  });

  return {
    averageConfidence,
    ...(Object.keys(pageConfidence).length > 0 ? { pageConfidence } : {})
  };
}

/**
 * Calculate confidence percentile thresholds
 */
export function getConfidenceThresholds(values: number[]): { 
  low: number, 
  medium: number, 
  high: number 
} {
  if (!values || values.length === 0) {
    return { low: 60, medium: 80, high: 95 };
  }
  
  // Filter out invalid values
  const validValues = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (validValues.length === 0) {
    return { low: 60, medium: 80, high: 95 };
  }

  // Sort values
  const sortedValues = [...validValues].sort((a, b) => a - b);
  
  // Calculate percentiles
  const lowThreshold = sortedValues[Math.floor(sortedValues.length * 0.25)] || 60;
  const mediumThreshold = sortedValues[Math.floor(sortedValues.length * 0.5)] || 80;
  const highThreshold = sortedValues[Math.floor(sortedValues.length * 0.75)] || 95;
  
  return {
    low: lowThreshold,
    medium: mediumThreshold,
    high: highThreshold
  };
}

// Re-export the normalization functions for convenience
export { normalizeConfidenceData, getAverageConfidence };

/**
 * Utilities for handling OCR confidence data
 */
import { ConfidenceData, getAverageConfidence } from './types/ocr-types';

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
    const clampedConfidence = Math.max(0, Math.min(100, confidence));
    return {
      averageConfidence: clampedConfidence
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
    let avgConfidence = 0;
    
    // Handle case where averageConfidence might be missing or invalid
    if (typeof confidence.averageConfidence === 'number' && !isNaN(confidence.averageConfidence)) {
      avgConfidence = confidence.averageConfidence;
    } else {
      // Try to extract from other properties
      if (typeof confidence.overall === 'number' && !isNaN(confidence.overall)) {
        avgConfidence = confidence.overall;
      } else if (typeof confidence.average === 'number' && !isNaN(confidence.average)) {
        avgConfidence = confidence.average;
      } else if (typeof confidence.confidence === 'number' && !isNaN(confidence.confidence)) {
        avgConfidence = confidence.confidence;
      } else if (Array.isArray(confidence.pageConfidences) && confidence.pageConfidences.length > 0) {
        // Handle legacy pageConfidences averaging
        const validConfidences = confidence.pageConfidences.filter((conf: any) => 
          typeof conf === 'number' && !isNaN(conf));
        if (validConfidences.length > 0) {
          avgConfidence = validConfidences.reduce((sum: number, conf: number) => sum + conf, 0) / validConfidences.length;
        }
      }
    }
    
    // Clamp the confidence value
    const clampedConfidence = Math.max(0, Math.min(100, avgConfidence));
    
    const result: ConfidenceData = {
      averageConfidence: clampedConfidence
    };
    
    // Add optional properties if they exist and are valid
    if (confidence.pageConfidence !== undefined) {
      result.pageConfidence = confidence.pageConfidence;
    }
    if (Array.isArray(confidence.pageConfidences)) {
      result.pageConfidences = confidence.pageConfidences;
    }
    if (confidence.wordConfidence !== undefined) {
      result.wordConfidence = confidence.wordConfidence;
    }
    if (confidence.sectionConfidence !== undefined) {
      result.sectionConfidence = confidence.sectionConfidence;
    }
    
    return result;
  }
  
  // Fallback for unexpected formats
  console.warn('Unexpected confidence format, using default:', confidence);
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
    if ('confidence' in confidence && 
        typeof (confidence as any).confidence === 'object' && 
        (confidence as any).confidence !== null &&
        'averageConfidence' in (confidence as any).confidence) {
      return typeof (confidence as any).confidence.averageConfidence === 'number' 
        ? (confidence as any).confidence.averageConfidence 
        : defaultValue;
    }
    
    // Handle direct averageConfidence property
    if ('averageConfidence' in confidence) {
      return typeof (confidence as any).averageConfidence === 'number' 
        ? (confidence as any).averageConfidence 
        : defaultValue;
    }
    
    // Try alternative properties
    if ('overall' in confidence && typeof (confidence as any).overall === 'number') {
      return (confidence as any).overall;
    }
    
    if ('average' in confidence && typeof (confidence as any).average === 'number') {
      return (confidence as any).average;
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

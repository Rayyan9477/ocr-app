/**
 * Enhanced Preprocessing Pipeline Types and Interfaces
 * Provides advanced preprocessing options for improved OCR accuracy
 */

import { PreprocessingOptions, PreprocessingResult } from './preprocessing-service';
import { HighlightRegion } from './highlight-detector';

/**
 * Enhanced preprocessing options extending the base options
 */
export interface EnhancedPreprocessingOptions extends PreprocessingOptions {
  // CLAHE (Contrast Limited Adaptive Histogram Equalization)
  applyCLAHE?: boolean;
  claheClipLimit?: number;       // Limit for contrast enhancement (default: 2.0)
  claheTileSize?: number;        // Tile size for CLAHE (default: 8)
  
  // Edge Enhancement
  enhanceEdges?: boolean;
  edgeStrength?: number;         // Edge enhancement strength (0.5-2.0)
  
  // Advanced Normalization
  normalize?: boolean;           // Apply advanced normalization
  
  // Perspective Correction
  perspectiveCorrection?: boolean;
  
  // Enhanced Deskewing
  deskew?: boolean;              // Improved deskewing algorithm
  
  // Highlighted Text Optimization
  optimizeHighlightedText?: boolean;
  
  // Document Type Auto-Detection
  autoDetectDocumentType?: boolean;
  
  // Output path for enhanced processing
  outputPath?: string;
}

/**
 * Enhanced preprocessing result with additional metadata
 */
export interface EnhancedPreprocessingResult extends PreprocessingResult {
  preprocessingOperations: string[];
  sessionDir?: string;
  highlightRegions?: HighlightRegion[];
  documentQualityScore?: number;
  processingTime?: number;
}

/**
 * Document quality assessment
 */
export interface DocumentQualityAssessment {
  overallQuality: number;        // 0-100 quality score
  issues: {
    skew: number;               // 0-1 skew severity
    noise: number;              // 0-1 noise level
    poorContrast: number;       // 0-1 contrast issues
    lowResolution: boolean;     // Resolution below threshold
    shadows: boolean;           // Shadow artifacts detected
  };
  recommendations: PreprocessingRecommendation[];
}

/**
 * Preprocessing recommendation from analysis
 */
export interface PreprocessingRecommendation {
  technique: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  expectedImprovement: number;   // 0-100 expected improvement percentage
  parameters?: Record<string, any>;
}

/**
 * Enhanced processing session metadata
 */
export interface ProcessingSession {
  id: string;
  inputPath: string;
  outputPath: string;
  startTime: number;
  endTime?: number;
  operations: string[];
  success: boolean;
  error?: string;
}

/**
 * CLAHE-specific options
 */
export interface CLAHEOptions {
  clipLimit: number;            // 1.0-4.0, controls contrast limiting
  tileGridSize: number;         // 8-16, size of grid for local adaptation
  equalizeHistogram: boolean;   // Additional histogram equalization
}

/**
 * Edge enhancement options
 */
export interface EdgeEnhancementOptions {
  strength: number;             // 0.5-2.0, enhancement strength
  method: 'unsharp' | 'laplacian' | 'sobel';
  preserveDetails: boolean;     // Preserve fine details during enhancement
}

/**
 * Perspective correction options
 */
export interface PerspectiveCorrectionOptions {
  autoDetect: boolean;          // Auto-detect document corners
  cornerThreshold: number;      // Sensitivity for corner detection
  maxAngle: number;             // Maximum correction angle in degrees
}

/**
 * Highlight optimization options
 */
export interface HighlightOptimizationOptions {
  enhanceContrast: boolean;     // Enhance contrast in highlighted regions
  normalizeColors: boolean;     // Normalize colors for better OCR
  separateProcessing: boolean;  // Process highlighted regions separately
  backgroundSuppression: boolean; // Suppress highlight background
}

// All interfaces are already exported above, no need for additional export

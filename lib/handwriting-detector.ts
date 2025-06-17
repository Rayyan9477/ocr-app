/**
 * Handwriting Detection and Enhancement Utilities
 * Specialized for medical documents and poor quality handwritten text
 */

import logger from './logger';

export interface HandwritingMetrics {
  isHandwritten: boolean;
  confidence: number;
  characteristics: {
    irregularity: number;    // 0-1, how irregular the text appears
    strokeVariation: number; // 0-1, variation in stroke width
    slant: number;          // 0-1, italic/slanted appearance
    spacing: number;        // 0-1, inconsistent spacing
    baseline: number;       // 0-1, baseline variation
  };
  qualityFactors: {
    clarity: number;        // 0-1, overall clarity
    contrast: number;       // 0-1, ink vs background contrast
    completeness: number;   // 0-1, how complete characters appear
  };
  suggestions: string[];    // Enhancement suggestions
}

export interface HandwritingPattern {
  pattern: RegExp;
  description: string;
  medicalRelevance: boolean;
  commonMistakes: string[];
  corrections: Map<string, string>;
}

export class HandwritingDetector {
  private medicalPatterns: HandwritingPattern[] = [];
  private commonMedicalTerms: Map<string, string[]> = new Map(); // term -> variations
  private handwritingIndicators: RegExp[] = [];

  constructor() {
    this.initializeMedicalPatterns();
    this.initializeCommonTerms();
    this.initializeHandwritingIndicators();
  }

  /**
   * Analyze text block for handwriting characteristics
   */
  analyzeHandwriting(
    text: string,
    confidence: number,
    boundingBox?: { x0: number; y0: number; x1: number; y1: number },
    hocrData?: any
  ): HandwritingMetrics {
    const characteristics = this.calculateCharacteristics(text, confidence, hocrData);
    const qualityFactors = this.calculateQualityFactors(text, confidence, boundingBox);
    const isHandwritten = this.determineIfHandwritten(text, confidence, characteristics);
    
    const suggestions = this.generateSuggestions(
      text, 
      confidence, 
      characteristics, 
      qualityFactors,
      isHandwritten
    );

    return {
      isHandwritten,
      confidence: this.calculateHandwritingConfidence(characteristics, qualityFactors),
      characteristics,
      qualityFactors,
      suggestions
    };
  }

  /**
   * Initialize medical-specific patterns
   */
  private initializeMedicalPatterns(): void {
    this.medicalPatterns = [
      {
        pattern: /\b(mg|ml|cc|mcg|units?|doses?)\b/i,
        description: "Medical dosage units",
        medicalRelevance: true,
        commonMistakes: ["mg->mq", "ml->mi", "cc->ce"],
        corrections: new Map([
          ["mq", "mg"],
          ["mi", "ml"],
          ["ce", "cc"],
          ["urnts", "units"],
          ["dose", "dose"]
        ])
      },
      {
        pattern: /\b(bid|tid|qid|qd|q\d+h|prn|ac|pc|hs)\b/i,
        description: "Medical frequency abbreviations",
        medicalRelevance: true,
        commonMistakes: ["bid->bld", "tid->tld", "qid->qld"],
        corrections: new Map([
          ["bld", "bid"],
          ["tld", "tid"],
          ["qld", "qid"],
          ["pn", "prn"],
          ["pr", "prn"]
        ])
      },
      {
        pattern: /\b(hypertension|diabetes|asthma|copd|cad|chf|afib)\b/i,
        description: "Common medical conditions",
        medicalRelevance: true,
        commonMistakes: ["diabetes->diabetos", "asthma->asma"],
        corrections: new Map([
          ["diabetos", "diabetes"],
          ["diabetis", "diabetes"],
          ["asma", "asthma"],
          ["astma", "asthma"],
          ["hyperension", "hypertension"]
        ])
      },
      {
        pattern: /\$\d+(\.\d{2})?|\d+\.\d{2}|\bcosts?\b|\bfees?\b|\bbills?\b/i,
        description: "Medical billing amounts",
        medicalRelevance: true,
        commonMistakes: ["$->S", "0->O", "1->I"],
        corrections: new Map([
          ["S", "$"],
          ["O", "0"],
          ["I", "1"]
        ])
      }
    ];
  }

  /**
   * Initialize common medical terms and their variations
   */
  private initializeCommonTerms(): void {
    this.commonMedicalTerms = new Map([
      ["patient", ["patint", "pationt", "patiant", "pt"]],
      ["doctor", ["dr", "doc", "docter", "doctr"]],
      ["prescription", ["rx", "presc", "prescr", "perscription"]],
      ["medicine", ["med", "medication", "medicne", "meds"]],
      ["insurance", ["ins", "insurence", "insuranse"]],
      ["diagnosis", ["dx", "diag", "diagnos", "diagosis"]],
      ["treatment", ["tx", "treat", "treatmnt", "trtmnt"]],
      ["hospital", ["hosp", "hospitl", "hosptal"]],
      ["clinic", ["clnic", "clinc", "clnc"]],
      ["emergency", ["emrg", "emerg", "emergcy", "er"]],
      ["appointment", ["appt", "appointmnt", "apointment"]],
      ["symptoms", ["sx", "symptms", "symtoms", "symptom"]],
      ["allergies", ["allergy", "alergies", "allergys"]],
      ["copayment", ["copay", "co-pay", "copaymnt"]],
      ["deductible", ["ded", "deduct", "deductble"]]
    ]);
  }

  /**
   * Initialize handwriting detection patterns
   */
  private initializeHandwritingIndicators(): void {
    this.handwritingIndicators = [
      /[il1|]{3,}/,  // Common OCR confusion in handwriting
      /[oO0]{2,}/,   // o/O/0 confusion
      /[rn|n]{3,}/,  // r/n confusion
      /[vw]+/,       // v/w confusion
      /[cl]{2,}/,    // c/l confusion
      /[FP]+/,       // F/P confusion
      /\b[a-z]{1,2}\b.*\b[a-z]{1,2}\b/i, // Many short words (fragmented text)
      /[^\w\s]{3,}/, // Many special characters (OCR errors)
      /\d[a-z]+\d/i, // Mixed digits and letters
      /[A-Z]{1}[a-z]{1}[A-Z]{1}/, // Inconsistent capitalization
    ];
  }

  /**
   * Calculate handwriting characteristics
   */
  private calculateCharacteristics(
    text: string,
    confidence: number,
    hocrData?: any
  ): HandwritingMetrics['characteristics'] {
    const irregularity = this.calculateIrregularity(text);
    const strokeVariation = this.calculateStrokeVariation(text, hocrData);
    const slant = this.calculateSlant(text);
    const spacing = this.calculateSpacing(text);
    const baseline = this.calculateBaseline(text, hocrData);

    return {
      irregularity,
      strokeVariation,
      slant,
      spacing,
      baseline
    };
  }

  /**
   * Calculate quality factors
   */
  private calculateQualityFactors(
    text: string,
    confidence: number,
    boundingBox?: { x0: number; y0: number; x1: number; y1: number }
  ): HandwritingMetrics['qualityFactors'] {
    const clarity = confidence / 100; // Base clarity from OCR confidence
    const contrast = this.estimateContrast(text, confidence);
    const completeness = this.calculateCompleteness(text);

    return {
      clarity,
      contrast,
      completeness
    };
  }

  /**
   * Determine if text is handwritten based on various factors
   */
  private determineIfHandwritten(
    text: string,
    confidence: number,
    characteristics: HandwritingMetrics['characteristics']
  ): boolean {
    // Low confidence is often an indicator of handwriting
    if (confidence < 60) {
      return true;
    }

    // Check for handwriting indicators
    const indicatorScore = this.handwritingIndicators.reduce((score, pattern) => {
      return score + (pattern.test(text) ? 1 : 0);
    }, 0);

    if (indicatorScore >= 2) {
      return true;
    }

    // Check characteristics
    const characteristicScore = (
      characteristics.irregularity +
      characteristics.strokeVariation +
      characteristics.spacing +
      characteristics.baseline
    ) / 4;

    return characteristicScore > 0.6;
  }

  /**
   * Calculate handwriting confidence
   */
  private calculateHandwritingConfidence(
    characteristics: HandwritingMetrics['characteristics'],
    qualityFactors: HandwritingMetrics['qualityFactors']
  ): number {
    const characteristicWeight = 0.6;
    const qualityWeight = 0.4;

    const characteristicScore = (
      characteristics.irregularity * 0.3 +
      characteristics.strokeVariation * 0.2 +
      characteristics.spacing * 0.2 +
      characteristics.baseline * 0.2 +
      characteristics.slant * 0.1
    );

    const qualityScore = (
      qualityFactors.clarity * 0.5 +
      qualityFactors.contrast * 0.3 +
      qualityFactors.completeness * 0.2
    );

    return Math.min(
      (characteristicScore * characteristicWeight) + (qualityScore * qualityWeight),
      1.0
    );
  }

  /**
   * Calculate text irregularity
   */
  private calculateIrregularity(text: string): number {
    let irregularityScore = 0;

    // Check for inconsistent character patterns
    const words = text.split(/\s+/);
    let totalWords = words.length;
    let irregularWords = 0;

    for (const word of words) {
      if (word.length === 0) continue;

      // Check for mixed case in unexpected places
      if (/[a-z][A-Z]/.test(word) || /[A-Z][a-z][A-Z]/.test(word)) {
        irregularWords++;
      }

      // Check for unusual character combinations
      if (/[^\w\s]/.test(word)) {
        irregularWords++;
      }

      // Check for very short fragmented words
      if (word.length === 1 && !/[aAiI]/.test(word)) {
        irregularWords++;
      }
    }

    irregularityScore = totalWords > 0 ? irregularWords / totalWords : 0;
    return Math.min(irregularityScore, 1.0);
  }

  /**
   * Calculate stroke variation (simplified)
   */
  private calculateStrokeVariation(text: string, hocrData?: any): number {
    // In absence of actual image data, estimate based on OCR patterns
    let variationScore = 0;

    // Characters that are often confused in handwriting
    const confusionPairs = ['il1|', 'oO0', 'rn', 'cl', 'vw', 'FP'];
    
    for (const pair of confusionPairs) {
      if (text.includes(pair)) {
        variationScore += 0.2;
      }
    }

    return Math.min(variationScore, 1.0);
  }

  /**
   * Calculate slant estimation
   */
  private calculateSlant(text: string): number {
    // Look for patterns that might indicate italic/slanted text
    const italicIndicators = text.match(/[\/\\]/g) || [];
    return Math.min(italicIndicators.length / text.length, 1.0);
  }

  /**
   * Calculate spacing irregularity
   */
  private calculateSpacing(text: string): number {
    const words = text.split(/\s+/);
    if (words.length < 2) return 0;

    // Check for inconsistent word lengths (might indicate spacing issues)
    const lengths = words.map(w => w.length).filter(l => l > 0);
    if (lengths.length === 0) return 0;

    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    
    return Math.min(variance / 20, 1.0); // Normalize variance
  }

  /**
   * Calculate baseline variation (simplified)
   */
  private calculateBaseline(text: string, hocrData?: any): number {
    // Without actual positioning data, estimate based on text patterns
    // Look for mixed case that might indicate baseline issues
    const baselineIndicators = text.match(/[a-z][A-Z]|[A-Z][a-z]/g) || [];
    return Math.min(baselineIndicators.length / text.length, 1.0);
  }

  /**
   * Estimate contrast (simplified)
   */
  private estimateContrast(text: string, confidence: number): number {
    // Higher confidence generally indicates better contrast
    let contrastScore = confidence / 100;

    // Very low confidence might indicate poor contrast
    if (confidence < 30) {
      contrastScore *= 0.5;
    }

    return contrastScore;
  }

  /**
   * Calculate text completeness
   */
  private calculateCompleteness(text: string): number {
    if (text.length === 0) return 0;

    // Check for fragmented words or excessive special characters
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const completeWords = words.filter(w => 
      w.length >= 2 && !/[^\w\s]/.test(w) && !/^\d+$/.test(w)
    );

    return words.length > 0 ? completeWords.length / words.length : 0;
  }

  /**
   * Generate enhancement suggestions
   */
  private generateSuggestions(
    text: string,
    confidence: number,
    characteristics: HandwritingMetrics['characteristics'],
    qualityFactors: HandwritingMetrics['qualityFactors'],
    isHandwritten: boolean
  ): string[] {
    const suggestions: string[] = [];

    if (isHandwritten) {
      suggestions.push("Text appears to be handwritten");
      
      if (confidence < 70) {
        suggestions.push("Use Enhanced Tesseract for better handwriting recognition");
      }
      
      if (qualityFactors.clarity < 0.5) {
        suggestions.push("Consider image preprocessing to improve clarity");
      }
      
      if (characteristics.irregularity > 0.7) {
        suggestions.push("High irregularity detected - manual review recommended");
      }
    }

    if (confidence < 50) {
      suggestions.push("Very low confidence - consider alternative OCR engine");
    }

    if (qualityFactors.contrast < 0.4) {
      suggestions.push("Poor contrast detected - enhance image contrast");
    }

    if (characteristics.spacing > 0.8) {
      suggestions.push("Inconsistent spacing - check for merged/split words");
    }

    // Check for medical context
    const medicalPatternMatches = this.medicalPatterns.filter(pattern => 
      pattern.pattern.test(text)
    );

    if (medicalPatternMatches.length > 0) {
      suggestions.push("Medical content detected - verify medical terminology");
      
      for (const match of medicalPatternMatches) {
        if (match.commonMistakes.length > 0) {
          suggestions.push(`Check for common errors in ${match.description.toLowerCase()}`);
        }
      }
    }

    return suggestions;
  }

  /**
   * Apply medical-specific corrections
   */
  applyMedicalCorrections(text: string): string {
    let correctedText = text;

    for (const pattern of this.medicalPatterns) {
      for (const [mistake, correction] of pattern.corrections) {
        const regex = new RegExp(`\\b${mistake}\\b`, 'gi');
        correctedText = correctedText.replace(regex, correction);
      }
    }

    // Apply common medical term corrections
    for (const [correct, variations] of this.commonMedicalTerms) {
      for (const variation of variations) {
        const regex = new RegExp(`\\b${variation}\\b`, 'gi');
        correctedText = correctedText.replace(regex, correct);
      }
    }

    return correctedText;
  }

  /**
   * Get handwriting enhancement recommendations
   */
  getEnhancementRecommendations(text: string, confidence: number): {
    useSpecializedEngine: boolean;
    preprocessingSteps: string[];
    ocrParameters: Record<string, any>;
    reviewRequired: boolean;
  } {
    const metrics = this.analyzeHandwriting(text, confidence);
    
    return {
      useSpecializedEngine: metrics.isHandwritten && confidence < 75,
      preprocessingSteps: this.getPreprocessingSteps(metrics),
      ocrParameters: this.getOptimalOCRParameters(metrics),
      reviewRequired: confidence < 60 || metrics.characteristics.irregularity > 0.8
    };
  }

  /**
   * Get preprocessing steps for handwriting
   */
  private getPreprocessingSteps(metrics: HandwritingMetrics): string[] {
    const steps: string[] = [];

    if (metrics.qualityFactors.contrast < 0.5) {
      steps.push("contrast_enhancement");
    }

    if (metrics.characteristics.irregularity > 0.6) {
      steps.push("noise_reduction");
    }

    if (metrics.qualityFactors.clarity < 0.4) {
      steps.push("sharpening");
    }

    if (metrics.characteristics.slant > 0.5) {
      steps.push("deskew");
    }

    if (metrics.isHandwritten) {
      steps.push("handwriting_enhancement");
    }

    return steps;
  }

  /**
   * Get optimal OCR parameters for handwriting
   */
  private getOptimalOCRParameters(metrics: HandwritingMetrics): Record<string, any> {
    const params: Record<string, any> = {};

    if (metrics.isHandwritten) {
      params.psm = 6; // Uniform block of text
      params.oem = 1; // LSTM only for handwriting
      params.dpi = 300; // Higher DPI for handwriting
    }

    if (metrics.characteristics.spacing > 0.7) {
      params.preserve_interword_spaces = 1;
    }

    if (metrics.qualityFactors.clarity < 0.5) {
      params.tessedit_char_blacklist = ""; // Don't blacklist characters for poor quality
    }

    return params;
  }
}

export default HandwritingDetector;

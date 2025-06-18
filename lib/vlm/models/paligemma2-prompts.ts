/**
 * PaliGemma2 Prompts
 * 
 * Model-specific prompt templates for the PaliGemma2 model
 */

/**
 * Prompt categories for different tasks
 */
export enum PromptCategory {
  DOCUMENT_ANALYSIS = 'document_analysis',
  TEXT_EXTRACTION = 'text_extraction',
  STRUCTURED_DATA = 'structured_data_extraction',
  HIGHLIGHT_DETECTION = 'highlight_detection',
  TABLE_EXTRACTION = 'table_extraction',
  FORM_EXTRACTION = 'form_extraction',
  HANDWRITING_RECOGNITION = 'handwriting_recognition',
  OCR_CORRECTION = 'ocr_correction',
  DOCUMENT_CLASSIFICATION = 'document_classification',
  LAYOUT_ANALYSIS = 'layout_analysis',
  QUALITY_ASSESSMENT = 'quality_assessment',
  // New integration categories
  ENGINE_RECOMMENDATION = 'engine_recommendation',
  PREPROCESSING_RECOMMENDATION = 'preprocessing_recommendation',
  CONFIDENCE_ASSESSMENT = 'confidence_assessment',
  RESULT_ENHANCEMENT = 'result_enhancement',
  SEMANTIC_VALIDATION = 'semantic_validation'
}

/**
 * Base prompt template interface
 */
export interface PromptTemplate {
  /**
   * Category of the prompt
   */
  category: PromptCategory;
  
  /**
   * Main template text with placeholders
   */
  template: string;
  
  /**
   * Description of the prompt
   */
  description: string;
  
  /**
   * Expected response format (if applicable)
   */
  responseFormat?: string;
  
  /**
   * Required placeholders (if any)
   */
  requiredPlaceholders?: string[];
  
  /**
   * Optional placeholders with default values
   */
  optionalPlaceholders?: Record<string, string>;
}

/**
 * Document analysis prompt
 */
export const documentAnalysisPrompt: PromptTemplate = {
  category: PromptCategory.DOCUMENT_ANALYSIS,
  template: `Analyze this document image in detail and provide structured information. Include:

1. Document type and purpose
2. Quality assessment (resolution, noise, contrast)
3. Content features (handwriting, tables, highlights, images, signatures)
4. Layout analysis
5. Recommendations for optimal OCR processing

{taskDescription}

Respond in JSON format with the following structure:
{
  "documentType": "string",
  "quality": {
    "overall": float,
    "resolution": float,
    "noise": float,
    "contrast": float
  },
  "content": {
    "hasHandwriting": boolean,
    "hasTables": boolean,
    "hasHighlights": boolean,
    "hasImages": boolean,
    "hasSignatures": boolean,
    "languagePrediction": ["string"]
  },
  "layout": [
    {
      "type": "string",
      "bbox": [x1, y1, x2, y2],
      "confidence": float
    }
  ],
  "recommendations": {
    "preferredEngine": "string",
    "preprocessingSteps": ["string"],
    "confidenceThreshold": float,
    "priority": "string"
  }
}`,
  description: 'Analyzes document properties and structure for optimal processing',
  responseFormat: 'JSON',
  requiredPlaceholders: [],
  optionalPlaceholders: {
    'taskDescription': 'Focus on detecting challenging elements like low quality regions, handwriting, and complex layouts.'
  }
};

/**
 * Text extraction prompt
 */
export const textExtractionPrompt: PromptTemplate = {
  category: PromptCategory.TEXT_EXTRACTION,
  template: `Extract all text from this document image. 

{taskDescription}

For handwritten text, make your best effort to recognize the content.
For tables, preserve row and column structure as much as possible.
If text quality is poor, apply correction and mark confidence level.

Respond with:
1. The full extracted text
2. Confidence level (0-1) for your extraction
3. Any corrections you made to improve readability
4. Detected language(s)`,
  description: 'Extracts all text from a document image with high accuracy',
  requiredPlaceholders: [],
  optionalPlaceholders: {
    'taskDescription': 'Maintain the original formatting and layout as much as possible.'
  }
};

/**
 * Structured data extraction prompt
 */
export const structuredDataExtractionPrompt: PromptTemplate = {
  category: PromptCategory.STRUCTURED_DATA,
  template: `Extract structured data from this document image.

{taskDescription}

Extract the following elements:
1. Key-value pairs (field names and their values)
2. Tables (with headers and all rows)
3. Forms (all fields and their values)
4. Any specific entities relevant to document type

Respond in JSON format with the following structure:
{
  "keyValuePairs": [
    {"key": "string", "value": "string", "confidence": float}
  ],
  "tables": [
    {
      "tableId": "string",
      "headers": ["string"],
      "rows": [["string"]],
      "confidence": float
    }
  ],
  "forms": [
    {
      "formId": "string",
      "fields": [
        {"name": "string", "value": "string", "confidence": float}
      ]
    }
  ],
  "entities": [
    {"entity": "string", "type": "string", "value": "string", "confidence": float}
  ]
}`,
  description: 'Extracts structured data elements like tables, forms, and key-value pairs',
  responseFormat: 'JSON',
  requiredPlaceholders: [],
  optionalPlaceholders: {
    'taskDescription': 'Focus on accurately extracting tables and form fields with their values.'
  }
};

/**
 * Highlight detection prompt
 */
export const highlightDetectionPrompt: PromptTemplate = {
  category: PromptCategory.HIGHLIGHT_DETECTION,
  template: `Detect and extract highlighted text from this document image.

{taskDescription}

For each highlighted region:
1. Extract the highlighted text
2. Determine the importance/context of the highlighting
3. Describe the highlighting style (color, underline, etc.)
4. Estimate confidence in your detection

Respond in JSON format with:
{
  "highlightedRegions": [
    {
      "text": "string",
      "importance": "string",
      "style": "string",
      "bbox": [x1, y1, x2, y2],
      "confidence": float
    }
  ],
  "summary": "string"
}`,
  description: 'Detects and extracts highlighted text regions in documents',
  responseFormat: 'JSON',
  requiredPlaceholders: [],
  optionalPlaceholders: {
    'taskDescription': 'Pay special attention to different highlighting styles (marker, underline, box) and colors.'
  }
};

/**
 * OCR correction prompt
 */
export const ocrCorrectionPrompt: PromptTemplate = {
  category: PromptCategory.OCR_CORRECTION,
  template: `Review and correct the OCR text from a document image.

Original OCR text:
{originalText}

{taskDescription}

Specifically:
1. Fix any character recognition errors
2. Correct word spacing and line breaks
3. Fix formatting issues
4. Preserve special characters and numbers
5. Handle domain-specific terminology correctly

Respond with:
1. The corrected text
2. Confidence score for each correction
3. Explanation of significant changes made`,
  description: 'Corrects errors in OCR text using visual context',
  requiredPlaceholders: ['originalText'],
  optionalPlaceholders: {
    'taskDescription': 'Focus on correcting typical OCR errors while maintaining original formatting.'
  }
};

/**
 * Handwriting recognition prompt
 */
export const handwritingRecognitionPrompt: PromptTemplate = {
  category: PromptCategory.HANDWRITING_RECOGNITION,
  template: `Recognize and transcribe handwritten text from this document image.

{taskDescription}

Consider:
1. Different handwriting styles
2. Poor quality or faded writing
3. Cursive vs. print handwriting
4. Numbers and special characters
5. Context to resolve ambiguities

Respond with:
1. The transcribed text, preserving layout
2. Confidence level for each section
3. Any uncertain sections marked with [?]
4. Brief explanation of challenging areas`,
  description: 'Recognizes and transcribes handwritten text with high accuracy',
  requiredPlaceholders: [],
  optionalPlaceholders: {
    'taskDescription': 'This document contains handwritten notes that need to be accurately transcribed.'
  }
};

/**
 * Engine recommendation prompt
 */
export const engineRecommendationPrompt: PromptTemplate = {
  category: PromptCategory.ENGINE_RECOMMENDATION,
  template: `Analyze this document image and recommend the optimal OCR engine based on document characteristics.

Available engines:
- tesseract: General purpose OCR, good for printed text with clear formatting
- ocrmypdf: PDF-optimized engine with good layout preservation
- paddleocr: Strong on complex layouts and multilingual content
- kraken: Specialized for handwriting recognition

{taskDescription}

Consider these document properties:
1. Content type (printed vs. handwritten)
2. Layout complexity
3. Image quality
4. Text density and size
5. Special elements (tables, forms, etc.)

Respond in JSON format:
{
  "recommendedEngine": "string",
  "confidence": float,
  "reasoning": "string",
  "documentProperties": {
    "contentType": "string",
    "layoutComplexity": float,
    "imageQuality": float,
    "hasHandwriting": boolean,
    "hasTables": boolean,
    "hasComplexLayout": boolean,
    "isPoorQuality": boolean
  },
  "alternativeEngine": "string"
}`,
  description: 'Recommends the optimal OCR engine based on document characteristics',
  responseFormat: 'JSON',
  requiredPlaceholders: [],
  optionalPlaceholders: {
    'taskDescription': 'Determine the best OCR engine to process this document for maximum accuracy.'
  }
};

/**
 * Preprocessing recommendation prompt
 */
export const preprocessingRecommendationPrompt: PromptTemplate = {
  category: PromptCategory.PREPROCESSING_RECOMMENDATION,
  template: `Analyze this document image and recommend preprocessing techniques to improve OCR results.

Available preprocessing techniques:
- deskew: Corrects document rotation/alignment
- denoise: Removes noise artifacts
- contrast: Enhances text-background contrast
- binarization: Converts to pure black and white
- resolution: Increases effective resolution
- crop: Removes irrelevant margins
- shadow-removal: Removes shadow artifacts

{taskDescription}

For each recommended technique, explain why it's needed and its expected impact.

Respond in JSON format:
{
  "recommendations": [
    {
      "technique": "string",
      "priority": "high|medium|low",
      "reason": "string",
      "expectedImprovement": float
    }
  ],
  "documentIssues": {
    "skew": float,
    "noise": float,
    "poorContrast": float,
    "shadows": boolean,
    "lowResolution": boolean
  },
  "overallQuality": float
}`,
  description: 'Recommends preprocessing techniques to optimize OCR quality',
  responseFormat: 'JSON',
  requiredPlaceholders: [],
  optionalPlaceholders: {
    'taskDescription': 'Identify preprocessing steps that would improve OCR accuracy for this document.'
  }
};

/**
 * Confidence assessment prompt
 */
export const confidenceAssessmentPrompt: PromptTemplate = {
  category: PromptCategory.CONFIDENCE_ASSESSMENT,
  template: `Evaluate the confidence level of this OCR result by comparing it with the source document image.

OCR Text:
{ocrText}

{taskDescription}

Consider:
1. Character recognition accuracy
2. Word recognition completeness
3. Layout preservation
4. Special character handling
5. Numeric data accuracy
6. Domain-specific terminology

Respond in JSON format:
{
  "overallConfidence": float,
  "regionConfidences": [
    {
      "region": "string",
      "confidence": float,
      "issues": ["string"]
    }
  ],
  "potentialErrors": [
    {
      "detected": "string",
      "probable": "string",
      "confidence": float
    }
  ],
  "recommendations": {
    "needsReprocessing": boolean,
    "suggestedEngine": "string"
  }
}`,
  description: 'Assesses OCR confidence by comparing results with the source image',
  responseFormat: 'JSON',
  requiredPlaceholders: ['ocrText'],
  optionalPlaceholders: {
    'taskDescription': 'Provide a detailed confidence assessment for different regions of the OCR result.'
  }
};

/**
 * Result enhancement prompt
 */
export const resultEnhancementPrompt: PromptTemplate = {
  category: PromptCategory.RESULT_ENHANCEMENT,
  template: `Enhance this OCR result by comparing it with the source document image and fixing errors.

Original OCR Text:
{ocrText}

{taskDescription}

Enhance the OCR result by:
1. Fixing character recognition errors
2. Restoring missing text
3. Correcting layout issues
4. Fixing formatting problems
5. Standardizing inconsistencies

Respond with:
1. The enhanced text (preserving original format)
2. Confidence score for each enhancement
3. Summary of improvements made`,
  description: 'Enhances OCR results by correcting errors using visual context',
  requiredPlaceholders: ['ocrText'],
  optionalPlaceholders: {
    'taskDescription': 'Focus on enhancing the OCR result without changing the original format significantly.'
  }
};

/**
 * Semantic validation prompt
 */
export const semanticValidationPrompt: PromptTemplate = {
  category: PromptCategory.SEMANTIC_VALIDATION,
  template: `Validate the semantic consistency of this OCR result against the source document image.

OCR Text:
{ocrText}

{taskDescription}

Validate for semantic consistency:
1. Dates (chronological order, valid formats)
2. Amounts and calculations
3. Identifiers and reference numbers
4. Names and addresses
5. Domain-specific terminology

Respond in JSON format:
{
  "isConsistent": boolean,
  "inconsistencies": [
    {
      "type": "string",
      "detected": "string",
      "expected": "string",
      "confidence": float,
      "impact": "string"
    }
  ],
  "suggestions": [
    {
      "original": "string",
      "suggested": "string",
      "reason": "string"
    }
  ],
  "semanticConfidence": float
}`,
  description: 'Validates OCR results for semantic consistency and logical coherence',
  responseFormat: 'JSON',
  requiredPlaceholders: ['ocrText'],
  optionalPlaceholders: {
    'taskDescription': 'Check for logical inconsistencies in dates, amounts, calculations, and references.'
  }
};

/**
 * All prompt templates
 */
export const promptTemplates: Record<PromptCategory, PromptTemplate> = {
  [PromptCategory.DOCUMENT_ANALYSIS]: documentAnalysisPrompt,
  [PromptCategory.TEXT_EXTRACTION]: textExtractionPrompt,
  [PromptCategory.STRUCTURED_DATA]: structuredDataExtractionPrompt,
  [PromptCategory.HIGHLIGHT_DETECTION]: highlightDetectionPrompt,
  [PromptCategory.OCR_CORRECTION]: ocrCorrectionPrompt,
  [PromptCategory.HANDWRITING_RECOGNITION]: handwritingRecognitionPrompt,
  
  // Additional templates (placeholder definitions)
  [PromptCategory.TABLE_EXTRACTION]: {
    category: PromptCategory.TABLE_EXTRACTION,
    template: `Extract all tables from this document image.`,
    description: 'Extracts tables from documents'
  },
  [PromptCategory.FORM_EXTRACTION]: {
    category: PromptCategory.FORM_EXTRACTION,
    template: `Extract form fields and values from this document.`,
    description: 'Extracts form fields and values'
  },
  [PromptCategory.DOCUMENT_CLASSIFICATION]: {
    category: PromptCategory.DOCUMENT_CLASSIFICATION,
    template: `Classify this document by type and purpose.`,
    description: 'Classifies documents by type'
  },
  [PromptCategory.LAYOUT_ANALYSIS]: {
    category: PromptCategory.LAYOUT_ANALYSIS,
    template: `Analyze the layout of this document.`,
    description: 'Analyzes document layout'
  },
  [PromptCategory.QUALITY_ASSESSMENT]: {
    category: PromptCategory.QUALITY_ASSESSMENT,
    template: `Assess the quality of this document image.`,
    description: 'Assesses document image quality'
  },
  
  // Integration templates
  [PromptCategory.ENGINE_RECOMMENDATION]: engineRecommendationPrompt,
  [PromptCategory.PREPROCESSING_RECOMMENDATION]: preprocessingRecommendationPrompt,
  [PromptCategory.CONFIDENCE_ASSESSMENT]: confidenceAssessmentPrompt,
  [PromptCategory.RESULT_ENHANCEMENT]: resultEnhancementPrompt,
  [PromptCategory.SEMANTIC_VALIDATION]: semanticValidationPrompt
};

/**
 * Get a prompt template by category
 */
export function getPromptTemplate(category: PromptCategory): PromptTemplate {
  return promptTemplates[category];
}

/**
 * Apply values to a prompt template
 * 
 * @param template The prompt template
 * @param values Values to apply to template placeholders
 * @returns Filled prompt template
 */
export function applyPromptTemplate(template: PromptTemplate, values: Record<string, string> = {}): string {
  let result = template.template;
  
  // Apply required placeholders
  if (template.requiredPlaceholders) {
    for (const placeholder of template.requiredPlaceholders) {
      if (!values[placeholder]) {
        throw new Error(`Required placeholder "${placeholder}" is missing`);
      }
      result = result.replace(new RegExp(`{${placeholder}}`, 'g'), values[placeholder]);
    }
  }
  
  // Apply optional placeholders or use defaults
  if (template.optionalPlaceholders) {
    for (const [placeholder, defaultValue] of Object.entries(template.optionalPlaceholders)) {
      const value = values[placeholder] || defaultValue;
      result = result.replace(new RegExp(`{${placeholder}}`, 'g'), value);
    }
  }
  
  // Apply any other values provided
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  
  return result;
}

/**
 * Get a filled prompt for a specific category
 * 
 * @param category Prompt category
 * @param values Values to apply to template
 * @returns Filled prompt string
 */
export function getPrompt(category: PromptCategory, values: Record<string, string> = {}): string {
  const template = getPromptTemplate(category);
  return applyPromptTemplate(template, values);
}

export default promptTemplates;

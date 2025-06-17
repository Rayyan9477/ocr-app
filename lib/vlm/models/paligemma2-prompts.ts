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
  QUALITY_ASSESSMENT = 'quality_assessment'
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
  }
};

/**
 * Get a prompt template by category
 */
export function getPromptTemplate(category: PromptCategory): PromptTemplate {
  return promptTemplates[category];
}

export default promptTemplates;

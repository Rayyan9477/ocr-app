/**
 * PaliGemma2 Parser
 * 
 * Parses raw responses from the PaliGemma2 model
 * into structured data formats
 */

import { DocumentAnalysisResponse, TextExtractionResponse, StructuredDataResponse } from '../core/vlm-response-types';
import { VLMError, VLMErrorCode } from '../core/vlm-error-types';
import logger from '../../logger';

/**
 * Parser for PaliGemma2 model responses
 */
export class PaliGemma2Parser {
  /**
   * Parse raw response for document analysis
   */
  parseDocumentAnalysis(rawResponse: any): Partial<DocumentAnalysisResponse> {
    try {
      // If response is already parsed
      if (typeof rawResponse === 'object' && rawResponse !== null && !Buffer.isBuffer(rawResponse)) {
        return this.normalizeDocumentAnalysis(rawResponse);
      }
      
      // If response is a string, try to parse JSON
      if (typeof rawResponse === 'string') {
        try {
          // Extract JSON from the string (model might return text before/after JSON)
          const jsonMatch = rawResponse.match(/\{(?:[^{}]|(\{(?:[^{}]|{[^{}]*})*\}))*\}/);
          if (jsonMatch && jsonMatch[0]) {
            const parsedJson = JSON.parse(jsonMatch[0]);
            return this.normalizeDocumentAnalysis(parsedJson);
          }
        } catch (jsonError) {
          logger.warn(`Failed to parse JSON from model response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
          // Continue with text parsing as fallback
        }
        
        // Parse structured text response (non-JSON)
        return this.parseDocumentAnalysisText(rawResponse);
      }
      
      // Fallback for unexpected response type
      throw new VLMError(
        VLMErrorCode.PROCESSING_FAILED,
        `Unexpected response type: ${typeof rawResponse}`,
        { responseType: typeof rawResponse },
        false
      );
    } catch (error) {
      logger.error(`Error parsing document analysis response: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return default values on parse error
      return {
        documentType: 'unknown',
        quality: {
          overall: 0.5,
          resolution: 0.5,
          noise: 0.5,
          contrast: 0.5
        },
        content: {
          hasHandwriting: false,
          hasTables: false,
          hasHighlights: false,
          hasImages: false,
          hasSignatures: false
        },
        confidence: 0.5
      };
    }
  }
  
  /**
   * Parse raw response for text extraction
   */
  parseTextExtraction(rawResponse: any): Partial<TextExtractionResponse> {
    try {
      // If response is already parsed
      if (typeof rawResponse === 'object' && rawResponse !== null && !Buffer.isBuffer(rawResponse)) {
        return this.normalizeTextExtraction(rawResponse);
      }
      
      // If response is a string
      if (typeof rawResponse === 'string') {
        try {
          // Try to parse as JSON first
          const jsonMatch = rawResponse.match(/\{(?:[^{}]|(\{(?:[^{}]|{[^{}]*})*\}))*\}/);
          if (jsonMatch && jsonMatch[0]) {
            const parsedJson = JSON.parse(jsonMatch[0]);
            return this.normalizeTextExtraction(parsedJson);
          }
        } catch (jsonError) {
          // Continue with text parsing
        }
        
        // Parse as plain text
        return {
          text: rawResponse.trim(),
          confidence: this.estimateConfidence(rawResponse),
          blocks: [
            {
              text: rawResponse.trim(),
              bbox: [0, 0, 1, 1], // Full document
              confidence: this.estimateConfidence(rawResponse)
            }
          ]
        };
      }
      
      // Fallback for unexpected response type
      throw new VLMError(
        VLMErrorCode.PROCESSING_FAILED,
        `Unexpected response type: ${typeof rawResponse}`,
        { responseType: typeof rawResponse },
        false
      );
    } catch (error) {
      logger.error(`Error parsing text extraction response: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return default values on parse error
      return {
        text: '',
        confidence: 0.5
      };
    }
  }
  
  /**
   * Parse raw response for structured data extraction
   */
  parseStructuredData(rawResponse: any): Partial<StructuredDataResponse> {
    try {
      // If response is already parsed
      if (typeof rawResponse === 'object' && rawResponse !== null && !Buffer.isBuffer(rawResponse)) {
        return this.normalizeStructuredData(rawResponse);
      }
      
      // If response is a string
      if (typeof rawResponse === 'string') {
        try {
          // Try to parse as JSON
          const jsonMatch = rawResponse.match(/\{(?:[^{}]|(\{(?:[^{}]|{[^{}]*})*\}))*\}/);
          if (jsonMatch && jsonMatch[0]) {
            const parsedJson = JSON.parse(jsonMatch[0]);
            return this.normalizeStructuredData(parsedJson);
          }
        } catch (jsonError) {
          logger.warn(`Failed to parse JSON from structured data response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
        }
        
        // Fallback for non-JSON response
        return {
          confidence: 0.5,
          documentStructure: {
            rawText: rawResponse.trim()
          }
        };
      }
      
      // Fallback for unexpected response type
      throw new VLMError(
        VLMErrorCode.PROCESSING_FAILED,
        `Unexpected response type: ${typeof rawResponse}`,
        { responseType: typeof rawResponse },
        false
      );
    } catch (error) {
      logger.error(`Error parsing structured data response: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return default values on parse error
      return {
        confidence: 0.5
      };
    }
  }
  
  /**
   * Normalize document analysis response
   */
  private normalizeDocumentAnalysis(data: any): Partial<DocumentAnalysisResponse> {
    // Extract and normalize document type
    const documentType = data.documentType || data.document_type || 'unknown';
    
    // Extract and normalize quality
    const quality = {
      overall: this.normalizeValue(data.quality?.overall || data.overall_quality || 0.5),
      resolution: this.normalizeValue(data.quality?.resolution || data.resolution_quality || 0.5),
      noise: this.normalizeValue(data.quality?.noise || data.noise_level || 0.5),
      contrast: this.normalizeValue(data.quality?.contrast || data.contrast_quality || 0.5)
    };
    
    // Extract and normalize content features
    const content = {
      hasHandwriting: Boolean(data.content?.hasHandwriting || data.has_handwriting || false),
      hasTables: Boolean(data.content?.hasTables || data.has_tables || false),
      hasHighlights: Boolean(data.content?.hasHighlights || data.has_highlights || false),
      hasImages: Boolean(data.content?.hasImages || data.has_images || false),
      hasSignatures: Boolean(data.content?.hasSignatures || data.has_signatures || false),
      languagePrediction: data.content?.languagePrediction || data.language || ['en']
    };
    
    // Extract and normalize layout
    const layout = Array.isArray(data.layout) ? data.layout.map((item: any) => ({
      type: item.type || 'unknown',
      bbox: Array.isArray(item.bbox) ? item.bbox : [0, 0, 1, 1],
      confidence: this.normalizeValue(item.confidence || 0.8)
    })) : [];
    
    // Extract and normalize recommendations
    const recommendations = {
      preferredEngine: data.recommendations?.preferredEngine || data.preferred_engine || 'default',
      preprocessingSteps: data.recommendations?.preprocessingSteps || data.preprocessing_steps || [],
      confidenceThreshold: this.normalizeValue(data.recommendations?.confidenceThreshold || data.confidence_threshold || 0.7),
      priority: data.recommendations?.priority || data.priority || 'balanced'
    };
    
    // Calculate overall confidence
    const confidence = this.normalizeValue(data.confidence || quality.overall || 0.8);
    
    return {
      documentType,
      quality,
      content,
      layout,
      recommendations,
      confidence
    };
  }
  
  /**
   * Normalize text extraction response
   */
  private normalizeTextExtraction(data: any): Partial<TextExtractionResponse> {
    // Extract and normalize text
    const text = data.text || (typeof data === 'string' ? data : '');
    
    // Extract and normalize blocks
    const blocks = Array.isArray(data.blocks) ? data.blocks.map((block: any) => ({
      text: block.text || '',
      bbox: Array.isArray(block.bbox) ? block.bbox : [0, 0, 1, 1],
      confidence: this.normalizeValue(block.confidence || 0.8),
      isHandwritten: Boolean(block.isHandwritten || block.is_handwritten || false),
      isHighlighted: Boolean(block.isHighlighted || block.is_highlighted || false)
    })) : [
      {
        text,
        bbox: [0, 0, 1, 1],
        confidence: this.normalizeValue(data.confidence || 0.8)
      }
    ];
    
    // Extract and normalize corrections
    const corrections = Array.isArray(data.corrections) ? data.corrections.map((correction: any) => ({
      original: correction.original || '',
      corrected: correction.corrected || '',
      confidence: this.normalizeValue(correction.confidence || 0.8)
    })) : [];
    
    // Extract and normalize languages
    const languages = Array.isArray(data.languages) ? data.languages.map((lang: any) => ({
      code: lang.code || lang,
      confidence: this.normalizeValue(lang.confidence || 0.8)
    })) : data.language ? [{ code: data.language, confidence: 0.9 }] : [];
    
    // Calculate overall confidence
    const confidence = this.normalizeValue(data.confidence || 0.8);
    
    return {
      text,
      blocks,
      corrections,
      languages,
      confidence
    };
  }
  
  /**
   * Normalize structured data response
   */
  private normalizeStructuredData(data: any): Partial<StructuredDataResponse> {
    // Extract and normalize key-value pairs
    const keyValuePairs = Array.isArray(data.keyValuePairs || data.key_value_pairs) 
      ? (data.keyValuePairs || data.key_value_pairs).map((pair: any) => ({
          key: pair.key || '',
          value: pair.value || '',
          confidence: this.normalizeValue(pair.confidence || 0.8),
          bbox: Array.isArray(pair.bbox) ? pair.bbox : undefined
        }))
      : [];
    
    // Extract and normalize tables
    const tables = Array.isArray(data.tables) 
      ? data.tables.map((table: any) => ({
          tableId: table.tableId || table.table_id || `table-${Math.random().toString(36).substr(2, 9)}`,
          bbox: Array.isArray(table.bbox) ? table.bbox : [0, 0, 1, 1],
          confidence: this.normalizeValue(table.confidence || 0.8),
          headers: Array.isArray(table.headers) ? table.headers : [],
          rows: Array.isArray(table.rows) ? table.rows : []
        }))
      : [];
    
    // Extract and normalize forms
    const forms = Array.isArray(data.forms)
      ? data.forms.map((form: any) => ({
          formId: form.formId || form.form_id || `form-${Math.random().toString(36).substr(2, 9)}`,
          fields: Array.isArray(form.fields) 
            ? form.fields.map((field: any) => ({
                name: field.name || '',
                value: field.value || '',
                confidence: this.normalizeValue(field.confidence || 0.8),
                bbox: Array.isArray(field.bbox) ? field.bbox : undefined
              }))
            : []
        }))
      : [];
    
    // Extract and normalize medical entities
    const medicalEntities = Array.isArray(data.medicalEntities || data.medical_entities || data.entities)
      ? (data.medicalEntities || data.medical_entities || data.entities).map((entity: any) => ({
          entity: entity.entity || entity.name || '',
          type: entity.type || 'unknown',
          value: entity.value || '',
          confidence: this.normalizeValue(entity.confidence || 0.8)
        }))
      : [];
    
    // Extract document structure
    const documentStructure = data.documentStructure || data.document_structure || data;
    
    // Calculate overall confidence
    const confidence = this.normalizeValue(data.confidence || 0.8);
    
    return {
      keyValuePairs,
      tables,
      forms,
      medicalEntities,
      documentStructure,
      confidence
    };
  }
  
  /**
   * Parse document analysis from free text
   */
  private parseDocumentAnalysisText(text: string): Partial<DocumentAnalysisResponse> {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    // Attempt to extract document type
    let documentType = 'unknown';
    const documentTypeMatch = text.match(/document\s+type\s*[:-]?\s*([^,.\n]+)/i);
    if (documentTypeMatch && documentTypeMatch[1]) {
      documentType = documentTypeMatch[1].trim();
    }
    
    // Attempt to extract quality metrics
    const quality = {
      overall: this.extractNumberFromText(text, /overall\s+quality\s*[:-]?\s*(\d+\.?\d*)/i, 0.5),
      resolution: this.extractNumberFromText(text, /resolution\s*[:-]?\s*(\d+\.?\d*)/i, 0.5),
      noise: this.extractNumberFromText(text, /noise\s*[:-]?\s*(\d+\.?\d*)/i, 0.5),
      contrast: this.extractNumberFromText(text, /contrast\s*[:-]?\s*(\d+\.?\d*)/i, 0.5)
    };
    
    // Attempt to extract content features
    const content = {
      hasHandwriting: /handwriting|handwritten/i.test(text),
      hasTables: /tables|tabular/i.test(text),
      hasHighlights: /highlight|highlighted/i.test(text),
      hasImages: /images|graphics|pictures/i.test(text),
      hasSignatures: /signature|signed/i.test(text),
      languagePrediction: this.extractLanguageFromText(text)
    };
    
    // Estimate confidence based on text quality
    const confidence = this.estimateConfidence(text);
    
    return {
      documentType,
      quality,
      content,
      confidence
    };
  }
  
  /**
   * Extract a number from text using a regex pattern
   */
  private extractNumberFromText(text: string, pattern: RegExp, defaultValue: number): number {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = parseFloat(match[1]);
      return isNaN(value) ? defaultValue : this.normalizeValue(value);
    }
    return defaultValue;
  }
  
  /**
   * Extract language from text
   */
  private extractLanguageFromText(text: string): string[] {
    const languageMatch = text.match(/language\s*[:-]?\s*([^,.\n]+)/i);
    if (languageMatch && languageMatch[1]) {
      const language = languageMatch[1].trim().toLowerCase();
      return [language];
    }
    return ['en']; // Default to English
  }
  
  /**
   * Estimate confidence based on text quality
   */
  private estimateConfidence(text: string): number {
    if (!text || text.length === 0) {
      return 0.5;
    }
    
    // Higher confidence if response has good structure
    let confidence = 0.7;
    
    // Check for uncertainty markers
    const uncertaintyMarkers = ['uncertain', 'unclear', 'difficult to read', 'illegible', 'can\'t determine'];
    const hasUncertainty = uncertaintyMarkers.some(marker => text.toLowerCase().includes(marker));
    if (hasUncertainty) {
      confidence -= 0.2;
    }
    
    // Check for confidence statements
    const highConfidenceMarkers = ['confident', 'clear', 'certain', 'definitely', 'easily readable'];
    const hasHighConfidence = highConfidenceMarkers.some(marker => text.toLowerCase().includes(marker));
    if (hasHighConfidence) {
      confidence += 0.1;
    }
    
    // Check for explicit confidence scores
    const confidenceMatch = text.match(/confidence\s*[:-]?\s*(\d+\.?\d*)/i);
    if (confidenceMatch && confidenceMatch[1]) {
      const explicitConfidence = parseFloat(confidenceMatch[1]);
      if (!isNaN(explicitConfidence)) {
        // If score is 0-1, use it directly
        if (explicitConfidence >= 0 && explicitConfidence <= 1) {
          return explicitConfidence;
        }
        // If score is 0-100, normalize it
        if (explicitConfidence >= 0 && explicitConfidence <= 100) {
          return explicitConfidence / 100;
        }
      }
    }
    
    return this.normalizeValue(confidence);
  }
  
  /**
   * Normalize a value to be between 0 and 1
   */
  private normalizeValue(value: number): number {
    // If value is already between 0 and 1, return it
    if (value >= 0 && value <= 1) {
      return value;
    }
    
    // If value is between 0 and 100, normalize it
    if (value >= 0 && value <= 100) {
      return value / 100;
    }
    
    // Otherwise, clamp to 0-1 range
    return Math.max(0, Math.min(1, value));
  }
}

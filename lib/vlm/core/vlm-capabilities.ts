/**
 * VLM Capabilities Definition
 * 
 * Defines the various capabilities that can be supported by VLM implementations.
 * Used for capability negotiation and feature detection.
 */

/**
 * Enumeration of possible VLM capabilities
 */
export enum VLMCapability {
  // Document Analysis Capabilities
  DOCUMENT_TYPE_DETECTION = 'document_type_detection',
  LAYOUT_ANALYSIS = 'layout_analysis',
  QUALITY_ASSESSMENT = 'quality_assessment',
  HANDWRITING_DETECTION = 'handwriting_detection',
  TABLE_DETECTION = 'table_detection',
  HIGHLIGHT_DETECTION = 'highlight_detection',
  SIGNATURE_DETECTION = 'signature_detection',
  
  // Text Extraction Capabilities
  TEXT_EXTRACTION = 'text_extraction',
  HANDWRITING_RECOGNITION = 'handwriting_recognition',
  LOW_QUALITY_TEXT_RECOGNITION = 'low_quality_text_recognition',
  ROTATED_TEXT_RECOGNITION = 'rotated_text_recognition',
  WATERMARK_HANDLING = 'watermark_handling',
  
  // Structured Data Capabilities
  TABLE_EXTRACTION = 'table_extraction',
  FORM_EXTRACTION = 'form_extraction',
  KEY_VALUE_EXTRACTION = 'key_value_extraction',
  MEDICAL_ENTITY_EXTRACTION = 'medical_entity_extraction',
  
  // Enhancement Capabilities
  TEXT_CORRECTION = 'text_correction',
  MISSING_TEXT_RECOVERY = 'missing_text_recovery',
  SEMANTIC_VALIDATION = 'semantic_validation',
  CONFIDENCE_SCORING = 'confidence_scoring',
  
  // Processing Capabilities
  BATCH_PROCESSING = 'batch_processing',
  LOW_MEMORY_PROCESSING = 'low_memory_processing',
  STREAMING_PROCESSING = 'streaming_processing',
  MULTI_PAGE_PROCESSING = 'multi_page_processing'
}

/**
 * Interface describing VLM capability metadata
 */
export interface VLMCapabilityInfo {
  /**
   * The capability identifier
   */
  capability: VLMCapability;
  
  /**
   * Human-readable description of the capability
   */
  description: string;
  
  /**
   * Confidence score (0-1) indicating how well this capability is supported
   */
  confidence: number;
  
  /**
   * Any limitations or constraints on this capability
   */
  limitations?: string[];
  
  /**
   * Whether this capability is experimental/beta
   */
  experimental?: boolean;
}

/**
 * Helper function to check if a VLM implementation supports a capability
 */
export function hasCapability(
  capabilities: VLMCapability[],
  capability: VLMCapability
): boolean {
  return capabilities.includes(capability);
}

/**
 * Helper function to check if a VLM implementation supports a set of capabilities
 */
export function hasCapabilities(
  capabilities: VLMCapability[],
  requiredCapabilities: VLMCapability[]
): boolean {
  return requiredCapabilities.every(cap => capabilities.includes(cap));
}

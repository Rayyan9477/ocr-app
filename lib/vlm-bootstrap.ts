/**
 * VLM Bootstrap
 * 
 * Initializes and registers VLM models with the VLM registry.
 * This ensures that VLM models are available for use.
 */

import { vlmRegistry } from './vlm/core/vlm-registry';
import { PaliGemma2Adapter } from './vlm/models/paligemma2-adapter';
import { VLMCapability } from './vlm/core/vlm-capabilities';
import logger from './logger';

/**
 * Initialize and register all available VLM models
 */
export function initializeVLMModels(): void {
  try {
    // Register PaliGemma2 models
    vlmRegistry.register({
      id: 'paligemma2-3b-mix-224',
      name: 'PaliGemma2 3B Mix 224',
      implementation: PaliGemma2Adapter,
      deploymentStrategies: ['local', 'cloud'],
      capabilities: [
        VLMCapability.TEXT_EXTRACTION,
        VLMCapability.DOCUMENT_TYPE_DETECTION,
        VLMCapability.LAYOUT_ANALYSIS,
        VLMCapability.QUALITY_ASSESSMENT,
        VLMCapability.HANDWRITING_RECOGNITION,
        VLMCapability.LOW_QUALITY_TEXT_RECOGNITION,
        VLMCapability.TEXT_CORRECTION,
        VLMCapability.TABLE_EXTRACTION,
        VLMCapability.FORM_EXTRACTION,
        VLMCapability.KEY_VALUE_EXTRACTION
      ],
      sizeInMB: 3000,
      isDefault: true,
      metadata: {
        modelType: 'paligemma2',
        version: '3b-mix-224',
        description: 'PaliGemma2 3B model with mixed training for document analysis'
      }
    });

    // Register additional PaliGemma2 variants
    vlmRegistry.register({
      id: 'paligemma2-3b-mix-448',
      name: 'PaliGemma2 3B Mix 448',
      implementation: PaliGemma2Adapter,
      deploymentStrategies: ['local', 'cloud'],
      capabilities: [
        VLMCapability.TEXT_EXTRACTION,
        VLMCapability.DOCUMENT_TYPE_DETECTION,
        VLMCapability.LAYOUT_ANALYSIS,
        VLMCapability.QUALITY_ASSESSMENT,
        VLMCapability.HANDWRITING_RECOGNITION,
        VLMCapability.LOW_QUALITY_TEXT_RECOGNITION,
        VLMCapability.TEXT_CORRECTION,
        VLMCapability.TABLE_EXTRACTION,
        VLMCapability.FORM_EXTRACTION,
        VLMCapability.KEY_VALUE_EXTRACTION
      ],
      sizeInMB: 3000,
      isDefault: false,
      metadata: {
        modelType: 'paligemma2',
        version: '3b-mix-448',
        description: 'PaliGemma2 3B model with higher resolution (448x448) for detailed analysis'
      }
    });

    vlmRegistry.register({
      id: 'paligemma2-10b-mix-224',
      name: 'PaliGemma2 10B Mix 224',
      implementation: PaliGemma2Adapter,
      deploymentStrategies: ['local', 'cloud'],
      capabilities: [
        VLMCapability.TEXT_EXTRACTION,
        VLMCapability.DOCUMENT_TYPE_DETECTION,
        VLMCapability.LAYOUT_ANALYSIS,
        VLMCapability.QUALITY_ASSESSMENT,
        VLMCapability.HANDWRITING_RECOGNITION,
        VLMCapability.LOW_QUALITY_TEXT_RECOGNITION,
        VLMCapability.TEXT_CORRECTION,
        VLMCapability.TABLE_EXTRACTION,
        VLMCapability.FORM_EXTRACTION,
        VLMCapability.KEY_VALUE_EXTRACTION
      ],
      sizeInMB: 10000,
      isDefault: false,
      metadata: {
        modelType: 'paligemma2',
        version: '10b-mix-224',
        description: 'PaliGemma2 10B model for high-accuracy document analysis'
      }
    });

    logger.info('VLM models registered successfully');
    logger.info(`Default VLM model: ${vlmRegistry.getAllImplementations().find(impl => impl.isDefault)?.name || 'None'}`);
    logger.info(`Total registered models: ${vlmRegistry.getAllImplementations().length}`);
    
  } catch (error) {
    logger.error(`Failed to initialize VLM models: ${error}`);
    throw error;
  }
}

/**
 * Get the status of VLM model registrations
 */
export function getVLMStatus() {
  const implementations = vlmRegistry.getAllImplementations();
  const defaultImplementation = vlmRegistry.getDefaultImplementation();
  
  return {
    totalModels: implementations.length,
    models: implementations.map(impl => ({
      id: impl.id,
      name: impl.name,
      deploymentStrategies: impl.deploymentStrategies,
      capabilities: impl.capabilities,
      sizeInMB: impl.sizeInMB,
      isDefault: impl.isDefault,
      metadata: impl.metadata
    })),
    hasDefaultModel: !!defaultImplementation,
    isInitialized: implementations.length > 0
  };
}

// Auto-initialize on module load
initializeVLMModels();

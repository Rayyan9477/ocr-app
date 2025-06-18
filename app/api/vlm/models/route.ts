import { NextRequest, NextResponse } from 'next/server';
import { vlmManager } from '../../../../lib/vlm/core/vlm-manager';
import { vlmRegistry } from '../../../../lib/vlm/core/vlm-registry';
import { VLMCapability } from '../../../../lib/vlm/core/vlm-capabilities';
import logger from '../../../../lib/logger';

// Ensure VLM models are registered
import '../../../../lib/vlm-bootstrap';

/**
 * GET /api/vlm/models - Get available VLM models and their capabilities
 */
export async function GET() {
  try {
    // Get all registered VLM implementations
    const implementations = vlmRegistry.getAllImplementations();
    
    const models = implementations.map(entry => ({
      id: entry.id,
      name: entry.name,
      deploymentStrategies: entry.deploymentStrategies,
      capabilities: entry.capabilities,
      sizeInMB: entry.sizeInMB,
      isDefault: entry.isDefault,
      metadata: entry.metadata || {}
    }));
    
    // Get capability descriptions
    const capabilityDescriptions: Record<string, string> = {
      [VLMCapability.DOCUMENT_TYPE_DETECTION]: 'Detect document type (invoice, receipt, form, etc.)',
      [VLMCapability.LAYOUT_ANALYSIS]: 'Analyze document layout and structure',
      [VLMCapability.QUALITY_ASSESSMENT]: 'Assess image quality and readability',
      [VLMCapability.HANDWRITING_DETECTION]: 'Detect presence of handwritten content',
      [VLMCapability.TABLE_DETECTION]: 'Detect tables and tabular data',
      [VLMCapability.TEXT_EXTRACTION]: 'Extract text with VLM capabilities',
      [VLMCapability.HANDWRITING_RECOGNITION]: 'Recognize handwritten text',
      [VLMCapability.LOW_QUALITY_TEXT_RECOGNITION]: 'Handle poor quality text',
      [VLMCapability.TABLE_EXTRACTION]: 'Extract structured table data',
      [VLMCapability.FORM_EXTRACTION]: 'Extract form fields and values',
      [VLMCapability.KEY_VALUE_EXTRACTION]: 'Extract key-value pairs',
      [VLMCapability.TEXT_CORRECTION]: 'Correct OCR errors and inconsistencies',
      [VLMCapability.SEMANTIC_VALIDATION]: 'Validate text for semantic consistency',
      [VLMCapability.CONFIDENCE_SCORING]: 'Provide detailed confidence assessments'
    };
    
    return NextResponse.json({
      success: true,
      models,
      capabilities: capabilityDescriptions,
      totalModels: models.length
    });
  } catch (error) {
    logger.error(`Failed to get VLM models: ${error}`);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get VLM models',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}

/**
 * POST /api/vlm/models - Register a new VLM model (for development/testing)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { id, name, deploymentStrategies, capabilities } = body;
    
    if (!id || !name || !deploymentStrategies || !capabilities) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: id, name, deploymentStrategies, capabilities' 
        }, 
        { status: 400 }
      );
    }
    
    // Note: In a real implementation, you would register the model
    // For now, we'll just return success to indicate the endpoint works
    return NextResponse.json({
      success: true,
      message: 'Model registration endpoint available (implementation pending)',
      receivedData: body
    });
  } catch (error) {
    logger.error(`Failed to register VLM model: ${error}`);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to register VLM model',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}

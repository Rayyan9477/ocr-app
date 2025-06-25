import { NextRequest, NextResponse } from 'next/server';
import { VLMModelManager } from '@/lib/vlm-model-manager';
import logger from '../../../../lib/logger.mjs';

// Create VLM manager instance
const vlmManager = new VLMModelManager();

/**
 * GET /api/vlm/models - Get available VLM models (PaliGemma2 only)
 */
export async function GET() {
  try {
    // Get PaliGemma2 model status
    const status = vlmManager.getModelStatus();
    
    const models = Object.entries(status).map(([key, info]) => ({
      id: key,
      name: 'PaliGemma2 3B Mix 224 ONNX',
      deploymentStrategies: ['local'],
      capabilities: [
        'text_extraction',
        'document_analysis', 
        'structured_data_extraction',
        'image_captioning',
        'question_answering',
        'object_detection'
      ],
      sizeInMB: 2800, // Approximate size
      isDefault: true,
      loaded: info.loaded,
      health: info.health,
      metadata: {
        type: 'vision-language-model',
        framework: 'paligemma2',
        optimization: 'onnx',
        description: info.config.description
      }
    }));
    
    // Capability descriptions for PaliGemma2
    const capabilityDescriptions: Record<string, string> = {
      'text_extraction': 'Extract text with advanced vision-language understanding',
      'document_analysis': 'Analyze document content and structure',
      'structured_data_extraction': 'Extract structured data from documents',
      'image_captioning': 'Generate detailed image descriptions',
      'question_answering': 'Answer questions about image content',
      'object_detection': 'Detect and identify objects in images'
    };
    
    return NextResponse.json({
      success: true,
      models,
      capabilities: capabilityDescriptions,
      totalModels: models.length,
      note: 'Only PaliGemma2 model is supported in this configuration'
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

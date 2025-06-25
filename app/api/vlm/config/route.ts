import { NextRequest, NextResponse } from 'next/server';
import VLMModelManager from '../../../../lib/vlm-model-manager.js';
import logger from '../../../../lib/logger.mjs';

type ModelStatus = {
  paligemma2?: {
    loaded: boolean;
    health: string;
  };
  [key: string]: any; // Allow for other model statuses
};

// Create VLM manager instance
const vlmManager = new VLMModelManager();

/**
 * GET /api/vlm/config - Get current VLM configuration (PaliGemma2 only)
 */
export async function GET() {
  try {
    const status: ModelStatus = vlmManager.getModelStatus();
    
    const config = {
      enabled: true,
      primaryModel: 'google/paligemma2-3b-pt-224',
      deploymentStrategy: 'local',
      healthCheckIntervalMs: 60000,
      globalOptions: {
        resolution: {
          width: 224,
          height: 224
        },
        timeoutMs: 30000,
        maxRetries: 3
      },
      modelConfigs: {
        paligemma2: {
          id: 'google/paligemma2-3b-pt-224',
          type: 'PaliGemma2Simple',
          description: 'PaliGemma2 3B vision-language model for OCR and document understanding (ONNX optimized)',
          loaded: status.paligemma2?.loaded || false,
          health: status.paligemma2?.health || 'unknown'
        }
      }
    };
    
    return NextResponse.json({      success: true,
      config,
      note: 'This is a simplified PaliGemma2-only configuration'
    });
  } catch (error) {
    logger.error(`Failed to get VLM config: ${error}`);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get VLM configuration',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}

/**
 * POST /api/vlm/config - Update VLM configuration (limited for PaliGemma2-only system)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    logger.info('VLM config update requested - PaliGemma2 system has limited configuration options');
    
    // For now, just acknowledge the request but don't actually change anything
    // since our PaliGemma2 system is simplified
    
    return NextResponse.json({
      success: true,
      message: 'Configuration acknowledged (PaliGemma2 system uses fixed configuration)',
      note: 'PaliGemma2 system uses a simplified, fixed configuration'
    });
  } catch (error) {
    logger.error(`Failed to update VLM config: ${error}`);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update VLM configuration',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}

/**
 * PUT /api/vlm/config - Reset VLM configuration (no-op for PaliGemma2-only system)
 */
export async function PUT() {
  try {
    return NextResponse.json({
      success: true,
      message: 'Configuration reset acknowledged (PaliGemma2 system uses fixed configuration)',
      note: 'PaliGemma2 system uses a simplified, fixed configuration'
    });
  } catch (error) {
    logger.error(`Failed to reset VLM config: ${error}`);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to reset VLM configuration',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}

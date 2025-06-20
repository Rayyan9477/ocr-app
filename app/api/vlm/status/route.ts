import { NextRequest, NextResponse } from 'next/server';
import VLMModelManager from '../../../../lib/vlm-model-manager.js';
import logger from '../../../../lib/logger';

// Create VLM manager instance
const vlmManager = new VLMModelManager();

/**
 * GET /api/vlm/status - Get VLM system status (PaliGemma2 only)
 */
export async function GET() {
  try {
    // Get PaliGemma2 model status
    const status = vlmManager.getModelStatus();
    
    const modelStatuses: Record<string, any> = {};
    
    for (const [key, info] of Object.entries(status)) {
      modelStatuses[key] = {
        modelId: info.config.id,
        type: info.config.type,
        description: info.config.description,
        loaded: info.loaded,
        health: info.health,
        hasProcessor: info.hasProcessor || false,
        hasModel: info.hasModel || false,
        lastCheckTime: new Date().toISOString()
      };
    }
    
    const healthyModels = Object.values(status).filter(s => s.health === 'healthy').length;
    const isHealthy = healthyModels > 0;
    
    return NextResponse.json({
      success: true,
      status: {
        overall: {
          isHealthy,
          timestamp: new Date().toISOString(),
          totalModels: Object.keys(status).length,
          healthyModels,
          modelType: 'PaliGemma2 Only'
        },
        models: modelStatuses
      }
    });
  } catch (error) {
    logger.error(`VLM status check failed: ${error}`);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get VLM status',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}

/**
 * POST /api/vlm/status - Force health check
 */
export async function POST() {
  try {
    // Force a fresh health check
    await vlmHealthMonitor.checkAllModels();
    
    // Return updated status
    return GET();
  } catch (error) {
    logger.error(`VLM health check failed: ${error}`);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to perform health check',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}

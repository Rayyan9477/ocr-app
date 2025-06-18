import { NextRequest, NextResponse } from 'next/server';
import { vlmHealthMonitor } from '../../../../lib/vlm/core/vlm-health-monitor';
import { vlmManager } from '../../../../lib/vlm/core/vlm-manager';
import logger from '../../../../lib/logger';

/**
 * GET /api/vlm/status - Get VLM system status
 */
export async function GET() {
  try {
    // Get overall health status
    const isHealthy = vlmHealthMonitor.isHealthy;
    
    // Get health status for all models
    const allStatuses = vlmHealthMonitor.getAllHealthStatuses();
    
    // Convert Map to object for JSON serialization
    const modelStatuses: Record<string, any> = {};
    for (const [key, status] of allStatuses.entries()) {
      modelStatuses[key] = {
        modelId: status.modelId,
        deploymentStrategy: status.deploymentStrategy,
        isHealthy: status.isHealthy,
        lastCheckTime: status.lastCheckTime.toISOString(),
        memoryUsageMB: status.memoryUsageMB,
        avgResponseTimeMs: status.avgResponseTimeMs,
        uptimeSeconds: status.uptimeSeconds,
        errorMessage: status.lastError?.message
      };
    }
    
    return NextResponse.json({
      success: true,
      status: {
        overall: {
          isHealthy,
          timestamp: new Date().toISOString(),
          totalModels: allStatuses.size,
          healthyModels: Array.from(allStatuses.values()).filter(s => s.isHealthy).length
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

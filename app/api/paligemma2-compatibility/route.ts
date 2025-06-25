import { NextRequest, NextResponse } from 'next/server';
import { compatibilityMonitor } from '../../../lib/paligemma2-compatibility-monitor.js';
import logger from '../../../lib/logger';

/**
 * API endpoint to check PaliGemma2 compatibility
 */
export async function GET(request: NextRequest) {
  try {
    // Get current compatibility status
    const status = await compatibilityMonitor.checkCompatibility();
    
    // Return status
    return NextResponse.json({
      success: true,
      status: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error checking PaliGemma2 compatibility: ${error}`);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to check compatibility',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Upgrade transformers.js to the latest version
 */
export async function POST(request: NextRequest) {
  try {
    // Upgrade transformers.js
    const success = await compatibilityMonitor.upgradeTransformers();
    
    // Return result
    return NextResponse.json({
      success: success,
      message: success 
        ? 'Successfully upgraded transformers.js' 
        : 'Failed to upgrade transformers.js',
      status: await compatibilityMonitor.checkCompatibility(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error upgrading transformers.js: ${error}`);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to upgrade transformers.js',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Add forcing dynamic runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

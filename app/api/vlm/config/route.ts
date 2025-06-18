import { NextRequest, NextResponse } from 'next/server';
import { getVLMConfig, updateVLMConfig } from '../../../../lib/vlm/config/vlm-config';
import logger from '../../../../lib/logger';

/**
 * GET /api/vlm/config - Get current VLM configuration
 */
export async function GET() {
  try {
    const config = getVLMConfig();
    
    // Remove sensitive information like API keys
    const safeConfig = {
      ...config,
      // Don't expose API keys or sensitive data
      modelConfigs: Object.keys(config.modelConfigs).reduce((acc, key) => {
        const modelConfig = config.modelConfigs[key];
        acc[key] = {
          ...modelConfig,
          options: modelConfig.options ? {
            ...modelConfig.options,
            // Remove sensitive fields
            apiKey: modelConfig.options.apiKey ? '[REDACTED]' : undefined
          } : undefined
        };
        return acc;
      }, {} as any)
    };
    
    return NextResponse.json({
      success: true,
      config: safeConfig
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
 * POST /api/vlm/config - Update VLM configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate configuration update
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid configuration data' 
        }, 
        { status: 400 }
      );
    }
    
    // Update configuration
    const updatedConfig = updateVLMConfig(body);
    
    // Return updated configuration (without sensitive data)
    const safeConfig = {
      ...updatedConfig,
      modelConfigs: Object.keys(updatedConfig.modelConfigs).reduce((acc, key) => {
        const modelConfig = updatedConfig.modelConfigs[key];
        acc[key] = {
          ...modelConfig,
          options: modelConfig.options ? {
            ...modelConfig.options,
            apiKey: modelConfig.options.apiKey ? '[REDACTED]' : undefined
          } : undefined
        };
        return acc;
      }, {} as any)
    };
    
    return NextResponse.json({
      success: true,
      message: 'VLM configuration updated successfully',
      config: safeConfig
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
 * PUT /api/vlm/config - Reset VLM configuration to defaults
 */
export async function PUT() {
  try {
    // Reset to default configuration
    const defaultConfig = updateVLMConfig({});
    
    return NextResponse.json({
      success: true,
      message: 'VLM configuration reset to defaults',
      config: defaultConfig
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

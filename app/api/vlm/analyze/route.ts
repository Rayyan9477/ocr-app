import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { vlmManager } from '../../../../lib/vlm/core/vlm-manager';
import { VLMCapability } from '../../../../lib/vlm/core/vlm-capabilities';
import { initializeDirectories } from '../../../../lib/initialize-dirs';
import logger from '../../../../lib/logger';

// Ensure VLM models are registered
import '../../../../lib/vlm-bootstrap';

// Initialize directories on module load
initializeDirectories();

/**
 * POST /api/vlm/analyze - Direct VLM document analysis
 */
export async function POST(request: NextRequest) {
  let inputPath = "";
  
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File || formData.get('file') as File;
    const analysisType = formData.get('analysisType') as string || 'document_analysis';
    const modelId = formData.get('modelId') as string || 'paligemma2-3b-mix-224';
    const deploymentStrategy = formData.get('deploymentStrategy') as string || 'local';
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Save the uploaded file
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const fileName = `${Date.now()}_${file.name}`;
    inputPath = path.join(uploadsDir, fileName);
    
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(inputPath, fileBuffer);
    
    // Get VLM instance
    const vlm = await vlmManager.getVLM({
      modelId,
      deploymentStrategy: deploymentStrategy as 'local' | 'cloud' | 'hybrid'
    });
    
    let result;
    
    // Perform analysis based on type
    switch (analysisType) {
      case 'document_analysis':
        result = await vlm.analyzeDocument(inputPath);
        break;
        
      case 'text_extraction':
        result = await vlm.extractText(inputPath);
        break;
        
      case 'structured_data':
        result = await vlm.extractStructuredData(inputPath);
        break;
        
      case 'custom_prompt':
        const customPrompt = formData.get('prompt') as string;
        if (!customPrompt) {
          return NextResponse.json({ error: 'Custom prompt required for custom_prompt analysis' }, { status: 400 });
        }
        result = await vlm.processWithPrompt(inputPath, customPrompt);
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      analysisType,
      model: {
        id: vlm.id,
        name: vlm.name,
        capabilities: vlm.capabilities
      },
      result: {
        ...result,
        // Remove raw response for cleaner output
        rawResponse: undefined
      }
    });
    
  } catch (error) {
    logger.error(`VLM analysis failed: ${error}`);
    return NextResponse.json(
      { 
        success: false, 
        error: 'VLM analysis failed',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  } finally {
    // Cleanup uploaded file
    if (inputPath && fs.existsSync(inputPath)) {
      try {
        fs.unlinkSync(inputPath);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup uploaded file: ${cleanupError}`);
      }
    }
  }
}

/**
 * GET /api/vlm/analyze - Get available analysis types and capabilities
 */
export async function GET() {
  try {
    const analysisTypes = {
      document_analysis: {
        description: 'Analyze document properties, type, quality, and structure',
        capabilities: [
          VLMCapability.DOCUMENT_TYPE_DETECTION,
          VLMCapability.LAYOUT_ANALYSIS,
          VLMCapability.QUALITY_ASSESSMENT
        ]
      },
      text_extraction: {
        description: 'Extract and enhance text from documents',
        capabilities: [
          VLMCapability.TEXT_EXTRACTION,
          VLMCapability.HANDWRITING_RECOGNITION,
          VLMCapability.LOW_QUALITY_TEXT_RECOGNITION,
          VLMCapability.TEXT_CORRECTION
        ]
      },
      structured_data: {
        description: 'Extract structured data like tables, forms, and key-value pairs',
        capabilities: [
          VLMCapability.TABLE_EXTRACTION,
          VLMCapability.FORM_EXTRACTION,
          VLMCapability.KEY_VALUE_EXTRACTION
        ]
      },
      custom_prompt: {
        description: 'Process with custom prompts for specialized analysis',
        capabilities: ['Custom analysis based on provided prompt']
      }
    };
    
    return NextResponse.json({
      success: true,
      analysisTypes,
      supportedFormats: ['jpg', 'jpeg', 'png', 'pdf', 'tiff', 'bmp'],
      maxFileSize: '100MB'
    });
  } catch (error) {
    logger.error(`Failed to get VLM analysis info: ${error}`);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get analysis information',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}

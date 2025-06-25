import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import VLMModelManager from '../../../../lib/vlm-model-manager.js';
import { initializeDirectories } from '../../../../lib/initialize-dirs';
import logger from '../../../../lib/logger.mjs';

// Initialize directories on module load
initializeDirectories();

// Create VLM manager instance
const vlmManager = new VLMModelManager();

/**
 * POST /api/vlm/analyze - Direct VLM document analysis using PaliGemma2
 */
export async function POST(request: NextRequest) {
  let inputPath = "";
  
  try {
    const formData = await request.formData();
    const fileField = formData.get('image') || formData.get('file');
    const analysisType = formData.get('analysisType') as string || 'document_analysis';
    const customPrompt = formData.get('prompt') as string || '';
    
    if (!fileField) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    let fileName = 'unknown.pdf';
    let fileBuffer;
    if (typeof fileField === 'object' && fileField !== null) {
      if ('name' in fileField && typeof fileField.name === 'string') {
        fileName = fileField.name;
      }
      if ('arrayBuffer' in fileField && typeof fileField.arrayBuffer === 'function') {
        const arrayBuffer = await fileField.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else {
        return NextResponse.json({ error: 'Invalid file format' }, { status: 400 });
      }
    }
    
    // Save the uploaded file
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const safeFileName = `${Date.now()}_${fileName}`;
    inputPath = path.join(uploadsDir, safeFileName);
    
    fs.writeFileSync(inputPath, fileBuffer);
    
    let result;
    
    // Perform analysis based on type using PaliGemma2
    switch (analysisType) {
      case 'document_analysis':
        result = await vlmManager.processImage(inputPath, '<image>analyze this document');
        break;
        
      case 'text_extraction':
        result = await vlmManager.extractText(inputPath);
        break;
        
      case 'structured_data':
        result = await vlmManager.processImage(inputPath, '<image>extract structured data');
        break;
        
      case 'custom_prompt':
        if (!customPrompt) {
          return NextResponse.json({ error: 'Custom prompt required for custom_prompt analysis' }, { status: 400 });
        }
        result = await vlmManager.processImage(inputPath, `<image>${customPrompt}`);
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      analysisType,
      model: {
        id: 'paligemma2',
        name: 'PaliGemma2 3B Mix 224 ONNX',
        type: 'PaliGemma2Simple'
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

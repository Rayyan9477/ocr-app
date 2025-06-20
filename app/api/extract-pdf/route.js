import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import VLMModelManager from '@/lib/vlm-model-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(os.tmpdir(), 'pdf-uploads');
const RESULT_DIR = path.join(process.cwd(), 'public', 'results');

// Ensure directories exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(RESULT_DIR)) {
  fs.mkdirSync(RESULT_DIR, { recursive: true });
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get('pdf');
    
    if (!pdfFile || !pdfFile.name || !pdfFile.type.includes('pdf')) {
      return NextResponse.json(
        { message: 'Invalid or missing PDF file' },
        { status: 400 }
      );
    }
    
    // Get options from form data
    const options = {
      preserveLayout: formData.get('preserveLayout') === 'true',
      enhanceOCR: formData.get('enhanceOCR') === 'true',
      processAllPages: formData.get('processAllPages') === 'true',
      addMetadata: formData.get('addMetadata') === 'true',
      optimizeOutput: formData.get('optimizeOutput') === 'true',
    };
    
    // Save uploaded file
    const buffer = Buffer.from(await pdfFile.arrayBuffer());
    const filename = `${Date.now()}-${pdfFile.name}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    
    // Initialize VLM Model Manager with OLMOCR enabled but no fallbacks
    const modelManager = new VLMModelManager({
      enableOLMOCR: true,
      fallbackToSimple: false,
      enableCloudFallback: false,
      useEnhancedIntegration: true
    });
    
    // Load OLMOCR model
    await modelManager.loadModel('olmocr');
    
    // Process the PDF to make it extractable
    const processedPdfPath = await modelManager.makeExtractablePdf(filepath, options);
    
    // Copy the processed PDF to the public directory for download
    const resultFilename = `extractable-${filename}`;
    const publicPath = path.join(RESULT_DIR, resultFilename);
    fs.copyFileSync(processedPdfPath, publicPath);
    
    // Clean up
    try {
      fs.unlinkSync(filepath);
      fs.unlinkSync(processedPdfPath);
    } catch (e) {
      console.warn('Failed to clean up temporary files:', e);
    }
    
    // Return the URL for download
    return NextResponse.json({
      message: 'PDF processed successfully',
      url: `/results/${resultFilename}`,
      filename: resultFilename
    });
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    return NextResponse.json(
      { message: `Error processing PDF: ${error.message}` },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false, // Disable body parsing, handle it manually with formData
    responseLimit: '50mb',
  },
};

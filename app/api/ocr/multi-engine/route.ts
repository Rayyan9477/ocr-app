import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { multiEngineOCR } from '@/lib/multi-engine-ocr';

export async function POST(request: NextRequest) {
  let inputPath = '';
  try {
    const formData = await request.formData();
    const fileField = formData.get('image') || formData.get('file');
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
    const uploadsDir = path.join(process.cwd(), 'uploads');
    inputPath = path.join(uploadsDir, `${Date.now()}_${fileName}`);
    fs.writeFileSync(inputPath, fileBuffer);
    const outputDir = path.join(process.cwd(), 'processed');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    // Run multi-engine ensemble OCR
    let result;
    try {
      result = await multiEngineOCR.processDocument(inputPath, outputDir, {
        useVlmEnhancement: true,
        confidenceThreshold: 0.75,
        useAllEngines: true
      });
    } catch (error) {
      return NextResponse.json({ error: `Multi-engine OCR failed: ${error.message || error}` }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      engine: 'multi-engine-ensemble',
      outputFile: path.basename(inputPath),
      text: result.text,
      confidence: result.confidence || 0,
      processingTime: result.processingTime || null,
      enginesUsed: result.enginesUsed || [],
      allResults: result.allResults || []
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process document' }, { status: 500 });
  }
} 
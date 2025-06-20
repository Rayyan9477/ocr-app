import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { PaliGemma2Simple } from '@/lib/paligemma2-simple.js';

const paligemma2 = new PaliGemma2Simple();

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
    // Ensure Paligemma2 is initialized
    try {
      await paligemma2.initialize();
    } catch (error) {
      return NextResponse.json({ error: `Failed to initialize Paligemma2: ${error.message || error}` }, { status: 500 });
    }
    // Run Paligemma2 OCR
    let result;
    try {
      result = await paligemma2.processImage(inputPath, '<image>Extract all text from this document with high accuracy. Preserve formatting, line breaks, and document structure. Include all visible text including headers, footers, and page numbers.');
    } catch (error) {
      return NextResponse.json({ error: `Paligemma2 OCR failed: ${error.message || error}` }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      engine: 'paligemma2',
      outputFile: path.basename(inputPath),
      text: result.text,
      confidence: result.confidence || 0.9,
      processingTime: result.processingTime || null
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process document' }, { status: 500 });
  }
} 
// app/api/ocr-process/route.js
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

/**
 * API handler for OCR processing requests
 * Uses our enhanced OCR processor to handle documents
 */
export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: "File is required" 
      }, { status: 400 });
    }
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const processedDir = path.join(process.cwd(), 'processed');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }
    
    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Use originalname if available, otherwise generate a name
    const originalFilename = file.name || `upload_${Date.now()}${path.extname(file.name || '.pdf')}`;
    const safeFilename = originalFilename.replace(/[^a-zA-Z0-9\._-]/g, '_');
    const filePath = path.join(uploadsDir, safeFilename);
    
    fs.writeFileSync(filePath, buffer);
    
    // Process with enhanced-ocr-processor using Node.js
    const result = await new Promise((resolve, reject) => {
      const nodeCmd = `node -e "
        const { processWithMultipleEngines } = require('./lib/enhanced-ocr-processor');
        
        async function processFile() {
          try {
            const result = await processWithMultipleEngines('${filePath}', '${processedDir}', {});
            console.log(JSON.stringify(result));
            process.exit(0);
          } catch (error) {
            console.error(error);
            process.exit(1);
          }
        }
        
        processFile();
      "`;
      
      exec(nodeCmd, (error, stdout, stderr) => {
        if (error) {
          console.error('OCR Processing Error:', error);
          console.error('stderr:', stderr);
          reject(error);
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (parseError) {
          console.error('Error parsing OCR result:', parseError);
          console.error('stdout:', stdout);
          reject(parseError);
        }
      });
    });
    
    // Prepare API response
    return NextResponse.json({
      success: true,
      filename: safeFilename,
      outputFile: path.basename(result.outputFile || ''),
      text: result.text ? result.text.substring(0, 1000) + (result.text.length > 1000 ? '...' : '') : null,
      engine: result.engine,
      details: result.details,
      truncated: result.text && result.text.length > 1000 ? true : false
    });
    
  } catch (error) {
    console.error('API Error:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || "An error occurred during OCR processing" 
    }, { status: 500 });
  }
}

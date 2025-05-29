const { exec } = require('child_process');
const { promisify } = require('util');
const { existsSync } = require('fs');
const { join } = require('path');

const execAsync = promisify(exec);

async function manualTest() {
  console.log('=== Manual Confidence Detection Test ===');
  
  const inputFile = './uploads/test_3page.pdf';
  const tempDir = join(process.cwd(), 'tmp', 'manual_test_' + Date.now());
  
  try {
    // Create temp directory
    await execAsync(`mkdir -p "${tempDir}"`);
    console.log('✓ Created temp directory:', tempDir);
    
    // Step 1: Check if file exists
    if (!existsSync(inputFile)) {
      console.log('❌ Input file does not exist:', inputFile);
      return;
    }
    console.log('✓ Input file exists:', inputFile);
    
    // Step 2: Check PDF page count with pdfinfo
    try {
      const { stdout } = await execAsync(`pdfinfo "${inputFile}"`);
      const pageMatch = stdout.match(/Pages:\s+(\d+)/);
      const pageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
      console.log('✓ PDF page count from pdfinfo:', pageCount);
    } catch (error) {
      console.log('⚠ Could not get page count from pdfinfo:', error.message);
    }
    
    // Step 3: Convert PDF to images
    const imageDir = join(tempDir, 'pages');
    await execAsync(`mkdir -p "${imageDir}"`);
    console.log('✓ Created image directory');
    
    console.log('Converting PDF to images...');
    await execAsync(`pdftoppm -png -r 150 "${inputFile}" "${imageDir}/page"`);
    console.log('✓ PDF converted to images');
    
    // Step 4: List generated images
    const { readdir } = require('fs').promises;
    const imageFiles = (await readdir(imageDir))
      .filter(f => f.endsWith('.png'))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/(\d+)\.png$/)?.[1] || '0');
        const bNum = parseInt(b.match(/(\d+)\.png$/)?.[1] || '0');
        return aNum - bNum;
      });
    
    console.log('✓ Generated images:', imageFiles.length);
    imageFiles.forEach((file, i) => {
      console.log(`  Page ${i + 1}: ${file}`);
    });
    
    // Step 5: Test Tesseract on first page only
    if (imageFiles.length > 0) {
      console.log('Testing Tesseract on first page...');
      const firstImage = join(imageDir, imageFiles[0]);
      const hocrOutput = join(tempDir, 'page1');
      
      const tesseractCmd = `tesseract "${firstImage}" "${hocrOutput}" -l eng --psm 1 hocr`;
      console.log('Running:', tesseractCmd);
      
      const start = Date.now();
      await execAsync(tesseractCmd);
      const duration = Date.now() - start;
      
      console.log('✓ Tesseract completed in', duration, 'ms');
      
      const hocrFile = hocrOutput + '.hocr';
      if (existsSync(hocrFile)) {
        const fs = require('fs');
        const hocrContent = fs.readFileSync(hocrFile, 'utf-8');
        console.log('✓ hOCR file generated, size:', hocrContent.length, 'bytes');
        
        // Quick check for confidence data
        const confMatches = hocrContent.match(/x_wconf\s+(\d+)/g);
        if (confMatches) {
          console.log('✓ Found', confMatches.length, 'confidence values');
          const confidences = confMatches.map(m => parseInt(m.match(/(\d+)/)[1]));
          const avgConf = confidences.reduce((a, b) => a + b, 0) / confidences.length;
          console.log('✓ Average confidence:', avgConf.toFixed(2) + '%');
        } else {
          console.log('⚠ No confidence values found in hOCR');
        }
      } else {
        console.log('❌ hOCR file not generated');
      }
    }
    
    console.log('\n=== Manual Test Summary ===');
    console.log('Expected pages:', imageFiles.length);
    console.log('Temp directory:', tempDir);
    
  } catch (error) {
    console.error('❌ Error during manual test:', error);
  }
}

manualTest();

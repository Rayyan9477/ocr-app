const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

async function testPageCount() {
  const testFile = 'test_3page.pdf';
  
  if (!fs.existsSync(testFile)) {
    console.log('Creating test PDF...');
    await execAsync('python3 create_3page_test.py');
  }
  
  // Check actual page count using pdfinfo
  try {
    const { stdout } = await execAsync(`pdfinfo "${testFile}"`);
    const pageMatch = stdout.match(/Pages:\s+(\d+)/);
    const actualPageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
    console.log(`Actual page count (pdfinfo): ${actualPageCount}`);
  } catch (error) {
    console.log('pdfinfo not available, trying pdftk...');
    try {
      const { stdout } = await execAsync(`pdftk "${testFile}" dump_data`);
      const pageCount = (stdout.match(/NumberOfPages: (\d+)/)?.[1]) || '0';
      console.log(`Actual page count (pdftk): ${pageCount}`);
    } catch (error2) {
      console.log('No PDF tools available for page counting');
    }
  }
  
  // Test PDF to image conversion
  const tempDir = 'tmp_test_' + Date.now();
  await execAsync(`mkdir -p "${tempDir}"`);
  
  try {
    console.log('Converting PDF to images...');
    await execAsync(`pdftoppm -png -r 150 "${testFile}" "${tempDir}/page"`);
    
    const imageFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.png'));
    console.log(`Images generated: ${imageFiles.length}`);
    console.log('Image files:', imageFiles);
    
    // Test running tesseract on each page
    const hocrFiles = [];
    for (let i = 0; i < imageFiles.length; i++) {
      const imagePath = path.join(tempDir, imageFiles[i]);
      const hocrPath = path.join(tempDir, `page_${i + 1}.hocr`);
      
      try {
        await execAsync(`tesseract "${imagePath}" "${hocrPath.replace('.hocr', '')}" -l eng --psm 1 hocr`);
        if (fs.existsSync(hocrPath)) {
          hocrFiles.push(hocrPath);
          console.log(`Successfully processed page ${i + 1}`);
        }
      } catch (tesseractError) {
        console.log(`Tesseract failed for page ${i + 1}:`, tesseractError.message);
      }
    }
    
    console.log(`hOCR files generated: ${hocrFiles.length}`);
    
    // Test combining hOCR files
    if (hocrFiles.length > 0) {
      let combinedHocr = '';
      
      for (let i = 0; i < hocrFiles.length; i++) {
        const pageContent = fs.readFileSync(hocrFiles[i], 'utf-8');
        
        if (i === 0) {
          combinedHocr = pageContent;
        } else {
          const pageStartMatch = pageContent.match(/<div class='ocr_page'[^>]*>/);
          if (pageStartMatch) {
            const startIndex = pageContent.indexOf(pageStartMatch[0]);
            const bodyEndIndex = pageContent.indexOf('</body>');
            
            if (startIndex !== -1 && bodyEndIndex !== -1) {
              const pageDiv = pageContent.substring(startIndex, bodyEndIndex).trim();
              combinedHocr = combinedHocr.replace(
                /<\/body>\s*<\/html>\s*$/,
                pageDiv + '\n</body>\n</html>'
              );
            }
          }
        }
      }
      
      const combinedPath = path.join(tempDir, 'combined.hocr');
      fs.writeFileSync(combinedPath, combinedHocr, 'utf-8');
      console.log('Combined hOCR file created');
      
      // Test page detection in combined hOCR
      const pageRegex = /<div class='ocr_page'[^>]*>/g;
      let pageMatch;
      const pageStarts = [];
      
      while ((pageMatch = pageRegex.exec(combinedHocr)) !== null) {
        pageStarts.push(pageMatch.index);
      }
      
      console.log(`Pages detected in combined hOCR: ${pageStarts.length}`);
      
      // Show first few characters of each page div
      pageStarts.forEach((start, index) => {
        const pageDiv = combinedHocr.substring(start, start + 100);
        console.log(`Page ${index + 1} starts with: ${pageDiv}...`);
      });
    }
    
  } finally {
    // Cleanup
    await execAsync(`rm -rf "${tempDir}"`).catch(() => {});
  }
}

testPageCount().catch(console.error);

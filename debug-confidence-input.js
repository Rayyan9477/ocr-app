const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

async function debugConfidenceInput() {
  const testFile = 'test_3page.pdf';
  
  console.log('=== DEBUG: What does confidence detector receive? ===');
  
  // Check the actual API processing 
  console.log('1. Testing API processing...');
  
  try {
    const response = await fetch('http://localhost:3000/api/smart-ocr', {
      method: 'POST',
      body: (() => {
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(testFile);
        const blob = new Blob([fileBuffer], { type: 'application/pdf' });
        formData.append('file', blob, testFile);
        formData.append('engine', 'tesseract');
        return formData;
      })()
    });
    
    const result = await response.json();
    console.log('API Response pageCount:', result.confidence?.pageCount);
    console.log('Best engine used:', result.engine);
    console.log('Output file:', result.outputFile);
    
    // Check if the processed file exists and its page count
    const processedDir = 'processed';
    const outputFile = path.join(processedDir, result.outputFile);
    
    if (fs.existsSync(outputFile)) {
      console.log('2. Checking processed output file...');
      try {
        const { stdout } = await execAsync(`pdfinfo "${outputFile}"`);
        const pageMatch = stdout.match(/Pages:\s+(\d+)/);
        const processedPageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
        console.log(`Processed file page count: ${processedPageCount}`);
      } catch (error) {
        console.log('Could not check processed file page count:', error.message);
      }
    } else {
      console.log('Processed output file not found:', outputFile);
    }
    
  } catch (error) {
    console.log('API test failed:', error.message);
  }
}

debugConfidenceInput().catch(console.error);

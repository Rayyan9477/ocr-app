const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testPageCount() {
  try {
    console.log('Testing multi-page PDF processing...');
    
    const form = new FormData();
    form.append('file', fs.createReadStream('test_3page.pdf'));
    form.append('usePreprocessing', 'false');
    form.append('engines', 'tesseract');
    form.append('outputFormat', 'json');
    
    console.log('Sending request to API...');
    const response = await fetch('http://localhost:3003/api/smart-ocr', {
      method: 'POST',
      body: form
    });
    
    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('\n=== RESULTS ===');
    console.log('Page Count:', result.pageCount);
    console.log('Confidence:', result.confidence + '%');
    console.log('Engine Used:', result.engine);
    console.log('Text Length:', result.text ? result.text.length : 0);
    console.log('Success:', result.success);
    
    if (result.pageCount === 3) {
      console.log('\n✅ SUCCESS: Page count is correctly reported as 3!');
    } else {
      console.log('\n❌ ISSUE: Page count is still incorrect:', result.pageCount);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testPageCount();

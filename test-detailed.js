#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

// Create a simple test text file
const testFile = '/tmp/test-document.txt';
fs.writeFileSync(testFile, 'This is a test document for adaptive OCR processing. Medical terms: blood pressure, diagnosis, patient care.');

try {
    console.log('🧪 Testing detailed adaptive mode response...\n');
    
    const curlCommand = `curl -s -X POST http://localhost:3002/api/smart-ocr \\
        -F "file=@${testFile}" \\
        -F "mode=adaptive" \\
        -F "enableAdaptiveMode=true" \\
        -F "confidenceThreshold=80" \\
        -F "documentType=medical"`;
    
    const result = execSync(curlCommand, { encoding: 'utf8', timeout: 30000 });
    const response = JSON.parse(result);
    
    console.log('📋 Full Response Structure:');
    console.log(JSON.stringify(response, null, 2));
    
} catch (error) {
    console.error('❌ Error:', error.message);
} finally {
    // Clean up
    if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
    }
}

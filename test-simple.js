#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple test using curl for POST requests
async function testPostEndpoint() {
    console.log('🧪 Testing POST endpoint with adaptive modes...\n');
    
    // Create a simple test text file
    const testFile = '/tmp/test-document.txt';
    fs.writeFileSync(testFile, 'This is a test document for adaptive OCR processing. Medical terms: blood pressure, diagnosis, patient care.');
    
    const testModes = ['fast', 'balanced', 'accuracy', 'medical', 'adaptive'];
    
    for (const mode of testModes) {
        console.log(`\n🔍 Testing ${mode} mode...`);
        
        try {
            const { execSync } = require('child_process');
            
            const curlCommand = `curl -s -X POST http://localhost:3002/api/smart-ocr \\
                -F "file=@${testFile}" \\
                -F "mode=${mode}" \\
                -F "enableAdaptiveMode=true" \\
                -F "confidenceThreshold=80" \\
                -F "performanceTarget=balanced"`;
            
            const result = execSync(curlCommand, { encoding: 'utf8', timeout: 30000 });
            const response = JSON.parse(result);
            
            console.log(`✅ ${mode} mode result:`);
            console.log(`   - Success: ${response.success}`);
            console.log(`   - Mode used: ${response.mode || 'unknown'}`);
            console.log(`   - Text found: ${response.text ? 'Yes' : 'No'}`);
            console.log(`   - Text length: ${response.text ? response.text.length : 0} characters`);
            console.log(`   - Confidence: ${response.confidence || 'N/A'}`);
            console.log(`   - Processing time: ${response.processingTime || 'N/A'}ms`);
            
            if (response.adaptiveMetrics) {
                console.log(`   - Selected mode: ${response.adaptiveMetrics.selectedMode}`);
                console.log(`   - Confidence score: ${response.adaptiveMetrics.confidenceScore}`);
            }
            
            if (response.error) {
                console.log(`   - Error: ${response.error}`);
            }
            
        } catch (error) {
            console.error(`❌ Error testing ${mode} mode:`, error.message);
        }
    }
    
    // Clean up
    if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
    }
    
    console.log('\n✨ Testing completed!');
}

testPostEndpoint().catch(console.error);

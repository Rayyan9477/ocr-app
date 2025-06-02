#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testAdaptiveMode(mode, testFile) {
    console.log(`\n🧪 Testing ${mode} mode with ${testFile}...`);
    
    try {
        const form = new FormData();
        
        // Create a simple test image if it doesn't exist
        if (!fs.existsSync(testFile)) {
            console.log(`Creating test file: ${testFile}`);
            // Create a simple test text file for demonstration
            fs.writeFileSync(testFile, 'This is a test document for OCR processing.');
        }
        
        form.append('file', fs.createReadStream(testFile));
        form.append('mode', mode);
        form.append('enableAdaptiveMode', 'true');
        form.append('confidenceThreshold', '0.8');
        form.append('performanceTarget', 'balanced');
        
        const response = await fetch('http://localhost:3002/api/smart-ocr', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        
        console.log(`✅ ${mode} mode result:`);
        console.log(`   - Success: ${result.success}`);
        console.log(`   - Mode used: ${result.mode || 'unknown'}`);
        console.log(`   - Text length: ${result.text ? result.text.length : 0} characters`);
        console.log(`   - Confidence: ${result.confidence || 'N/A'}`);
        console.log(`   - Processing time: ${result.processingTime || 'N/A'}ms`);
        
        if (result.adaptiveMetrics) {
            console.log(`   - Selected mode: ${result.adaptiveMetrics.selectedMode}`);
            console.log(`   - Confidence score: ${result.adaptiveMetrics.confidenceScore}`);
        }
        
        return result;
        
    } catch (error) {
        console.error(`❌ Error testing ${mode} mode:`, error.message);
        return null;
    }
}

async function runTests() {
    console.log('🚀 Starting Adaptive Mode Testing...\n');
    
    // Test different modes
    const testModes = [
        'fast',
        'balanced', 
        'accuracy',
        'medical',
        'handwritten',
        'adaptive'
    ];
    
    const testFile = '/tmp/test-document.txt';
    
    for (const mode of testModes) {
        await testAdaptiveMode(mode, testFile);
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n✨ Testing completed!');
    
    // Clean up
    if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
    }
}

// Check if server is running first
async function checkServer() {
    try {
        const response = await fetch('http://localhost:3002/api/smart-ocr');
        if (response.ok) {
            console.log('✅ Server is running on port 3002');
            return true;
        }
    } catch (error) {
        console.log('❌ Server not running on port 3002');
        return false;
    }
}

async function main() {
    const serverRunning = await checkServer();
    if (!serverRunning) {
        console.log('Please start the development server first: npm run dev');
        process.exit(1);
    }
    
    await runTests();
}

main().catch(console.error);

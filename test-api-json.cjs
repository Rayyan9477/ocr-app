// Test script for testing JSON sanitization directly with both APIs
// This script creates a JSON file with problematic content and tests both APIs

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create a test file with various problematic content
const testJsonPath = path.join(__dirname, 'test-problematic.json');

// Test cases with problematic characters
const testCases = [
  {
    name: 'Simple text',
    text: 'This is a normal text'
  },
  {
    name: 'Newlines and tabs',
    text: 'Text with\nnewlines\nand\ttabs\t\t'
  },
  {
    name: 'Backslashes',
    text: 'Text with backslashes \\\\ and more \\\\\\\\'
  },
  {
    name: 'Double escaped sequences',
    text: 'Double escaped \\\\n \\\\t \\\\r sequences'
  },
  {
    name: 'Triple escaped sequences',
    text: 'Triple escaped \\\\\\n \\\\\\t \\\\\\r sequences'
  },
  {
    name: 'JSON control characters',
    text: 'Text with quotes " and apostrophes \' and backslashes \\'
  },
  {
    name: 'Unicode quotes',
    text: 'Unicode "quotes" and \'quotes\''
  },
  {
    name: 'Control characters',
    text: 'Control chars: \u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008\u000B\u000C\u000E\u000F'
  },
  {
    name: 'Emojis and special characters',
    text: 'Emojis 😀 🚀 💯 and special characters ☺ ♥ ♦ ♣ ♠'
  },
  {
    name: 'Very long text',
    text: 'This is a repeating text. '.repeat(100)
  }
];

// Create the JSON file with all test cases
const testJson = {
  version: "1.0.0",
  testTime: new Date().toISOString(),
  testCases: testCases
};

fs.writeFileSync(testJsonPath, JSON.stringify(testJson, null, 2));
console.log(`Created test JSON file: ${testJsonPath}`);

// Test both APIs with curl commands
console.log('\n=== Testing API Endpoints with Problematic JSON Content ===\n');

// Check which port the server is running on
console.log('Detecting server port...');
let serverPort = 3000;
try {
  // Try ports 3000, 3001, 3002
  const ports = [3000, 3001, 3002];
  let foundPort = false;
  
  for (const port of ports) {
    try {
      const healthCheck = execSync(`curl -s http://localhost:${port}/api/health`, { encoding: 'utf8' });
      if (healthCheck && healthCheck.includes('OK')) {
        serverPort = port;
        foundPort = true;
        console.log(`Server detected on port ${serverPort}`);
        break;
      }
    } catch (e) {
      // Port not working, try next
    }
  }
  
  if (!foundPort) {
    console.log('Could not detect server port, defaulting to 3000');
  }
} catch (error) {
  console.log('Error detecting server port:', error.message);
}

// Test the OCR route
console.log(`\nTesting /api/ocr endpoint on port ${serverPort}...`);
try {
  const ocrResult = execSync(`curl -s -X POST http://localhost:${serverPort}/api/ocr/json-test -H "Content-Type: application/json" -d @${testJsonPath}`, { encoding: 'utf8' });
  
  
  console.log('Response from OCR API:');
  try {
    // Try to parse the response as JSON
    const jsonResponse = JSON.parse(ocrResult);
    console.log('✓ SUCCESS: Valid JSON response');
    console.log(`Response contains ${jsonResponse.testCases ? jsonResponse.testCases.length : 0} test cases`);
  } catch (error) {
    console.log(`✗ FAILURE: Invalid JSON response - ${error.message}`);
    console.log(`Raw response (first 100 chars): ${ocrResult.substring(0, 100)}...`);
  }
} catch (error) {
  console.log(`✗ ERROR executing curl command: ${error.message}`);
}

console.log('\n');

// Test the Smart OCR route
console.log(`Testing /api/smart-ocr endpoint on port ${serverPort}...`);
try {
  const smartOcrResult = execSync(`curl -s -X POST http://localhost:${serverPort}/api/smart-ocr/json-test -H "Content-Type: application/json" -d @${testJsonPath}`, { encoding: 'utf8' });
  
  console.log('Response from Smart OCR API:');
  console.log('Raw response length: ' + smartOcrResult.length + ' bytes');
  
  // Check if it's an HTML response (error) or valid JSON
  if (smartOcrResult.startsWith('<!DOCTYPE html>') || smartOcrResult.startsWith('<html>')) {
    console.log('✗ FAILURE: Received HTML instead of JSON response');
    console.log(`Raw response (first 100 chars): ${smartOcrResult.substring(0, 100)}...`);
    
    // Let's check for a 404 error in the HTML
    if (smartOcrResult.includes('404') && smartOcrResult.includes('This page could not be found')) {
      console.log('Route appears to be missing (404). Check that the smart-ocr/json-test endpoint is set up correctly.');
    }
  } else {
    try {
      // Try to parse the response as JSON
      const jsonResponse = JSON.parse(smartOcrResult);
      console.log('✓ SUCCESS: Valid JSON response');
      console.log(`Response contains ${jsonResponse.testCases ? jsonResponse.testCases.length : 0} test cases`);
    } catch (error) {
      console.log(`✗ FAILURE: Invalid JSON response - ${error.message}`);
      console.log(`Raw response (first 100 chars): ${smartOcrResult.substring(0, 100)}...`);
    }
  }
} catch (error) {
  console.log(`✗ ERROR executing curl command: ${error.message}`);
}

console.log('\n=== Testing complete ===');

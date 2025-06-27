// Comprehensive test script for OCR API JSON response validation
// This script will test both API endpoints with problematic text content

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');

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
    text: 'This is a repeating text. '.repeat(1000)
  }
];

// Helper function to make HTTP requests
async function makeRequest(endpoint, method, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          // Try to parse the response as JSON
          const jsonData = JSON.parse(responseData);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData,
            raw: responseData
          });
        } catch (error) {
          // If parsing fails, return the raw response
          resolve({
            status: res.statusCode,
            headers: res.headers,
            error: error.message,
            raw: responseData
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test the OCR API endpoint
async function testOcrEndpoint() {
  console.log('=== Testing /api/ocr Endpoint ===\n');
  let successCount = 0;
  let failureCount = 0;
  
  for (const testCase of testCases) {
    console.log(`Testing case: ${testCase.name}`);
    
    try {
      const response = await makeRequest('/api/ocr', 'POST', { 
        text: testCase.text,
        engine: 'test',
        success: true,
        confidence: 0.95
      });
      
      if (response.status === 200 && !response.error) {
        console.log(`✓ SUCCESS - Valid JSON response (${response.raw.length} bytes)`);
        successCount++;
      } else {
        console.log(`✗ FAILURE - Invalid JSON response: ${response.error || 'Status ' + response.status}`);
        console.log(`Raw response: ${response.raw.substring(0, 100)}...`);
        failureCount++;
      }
    } catch (error) {
      console.log(`✗ ERROR - Request failed: ${error.message}`);
      failureCount++;
    }
    
    console.log('');
  }
  
  console.log(`Results: ${successCount} successes, ${failureCount} failures\n`);
}

// Test the Smart OCR API endpoint
async function testSmartOcrEndpoint() {
  console.log('=== Testing /api/smart-ocr Endpoint ===\n');
  let successCount = 0;
  let failureCount = 0;
  
  for (const testCase of testCases) {
    console.log(`Testing case: ${testCase.name}`);
    
    try {
      const response = await makeRequest('/api/smart-ocr', 'POST', { 
        text: testCase.text,
        engine: 'test',
        success: true,
        confidence: 0.95
      });
      
      if (response.status === 200 && !response.error) {
        console.log(`✓ SUCCESS - Valid JSON response (${response.raw.length} bytes)`);
        successCount++;
      } else {
        console.log(`✗ FAILURE - Invalid JSON response: ${response.error || 'Status ' + response.status}`);
        console.log(`Raw response: ${response.raw.substring(0, 100)}...`);
        failureCount++;
      }
    } catch (error) {
      console.log(`✗ ERROR - Request failed: ${error.message}`);
      failureCount++;
    }
    
    console.log('');
  }
  
  console.log(`Results: ${successCount} successes, ${failureCount} failures\n`);
}

// Run the tests
async function runTests() {
  try {
    console.log('Starting API tests...\n');
    
    // Test both endpoints
    await testOcrEndpoint();
    await testSmartOcrEndpoint();
    
    console.log('All tests completed!');
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Check if server is running before tests
exec('curl -s http://localhost:3001/api/health', (error, stdout, stderr) => {
  if (error) {
    console.log('Server not running. Please start the server on port 3001 first.');
    return;
  }
  
  // Start the tests
  runTests();
});

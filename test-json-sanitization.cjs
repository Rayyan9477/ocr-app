// Test JSON sanitization for the OCR API
// This script will test our sanitization and validation logic
// by creating problematic text inputs and verifying they are handled correctly

// Create inline versions of the sanitization functions for testing
// These are direct copies from our codebase

// From multi-engine-ocr.ts
function sanitizeForJson(text) {
  if (!text) return '';
  
  try {
    // First handle multi-level escaped backslashes and sequences that can cause JSON issues
    let sanitized = text;
    
    // Handle triple and double escaped sequences - must be done in order from most escaped to least
    sanitized = sanitized
      .replace(/\\\\\\n/g, '\\n')
      .replace(/\\\\\\r/g, '\\r')
      .replace(/\\\\\\t/g, '\\t')
      .replace(/\\\\\\"/g, '\\"')
      .replace(/\\\\\\\\/g, '\\\\')
      // Now handle double escaped sequences
      .replace(/\\\\n/g, '\n')
      .replace(/\\\\r/g, '\r')
      .replace(/\\\\t/g, '\t')
      .replace(/\\\\\\/g, '\\')
      // Handle any normal escaped sequences
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
      
    // Remove control characters except newlines, tabs, and carriage returns
    sanitized = sanitized
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      
      // Replace problematic quotes and apostrophes with simple versions
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      
      // Replace tabs with spaces in most contexts
      .replace(/\t/g, ' ')
      
      // Normalize multiple spaces
      .replace(/\s+/g, ' ');
    
    // Extra safety - specifically handle backslash sequences that might cause issues
    sanitized = sanitized
      .replace(/\\\\/g, '\\')  // Convert double backslashes to single
      .replace(/\\"/g, '"')    // Convert escaped quotes to regular quotes
      .replace(/\\'/g, "'")    // Convert escaped single quotes to regular single quotes
      .replace(/\\([^nrt\\"])/g, '$1'); // Remove unnecessary escapes

    // Final JSON validation check
    try {
      const testObj = { text: sanitized };
      const serialized = JSON.stringify(testObj);
      JSON.parse(serialized); // This will throw if invalid
    } catch (jsonError) {
      // If there's still a JSON issue, use more aggressive sanitization
      console.warn('JSON validation failed after initial sanitization, applying more aggressive cleaning');
      // Fall back to ASCII-only content with safe newlines
      sanitized = sanitized
        .replace(/[^\x20-\x7E\n]/g, '')
        .trim();
      
      // One more validation attempt
      try {
        JSON.stringify({ text: sanitized });
      } catch (finalError) {
        // If still failing, return a very safe fallback
        console.error(`Critical JSON sanitization failure: ${finalError.message}`);
        return 'Text content unavailable due to encoding issues';
      }
    }
    
    return sanitized.trim();
  } catch (e) {
    console.error(`Error sanitizing text for JSON: ${e.message}`);
    return 'Text sanitization error';
  }
}

// From multi-engine-ocr.ts
function truncateTextForResponse(text, maxLength = 300) {
  if (!text) {
    return '';
  }
  
  try {
    // Handle excessively large text content
    const truncated = text.length <= maxLength
      ? text
      : text.substring(0, maxLength) + '... [truncated - full text available in output file]';
    
    // Always sanitize after truncation to ensure JSON safety
    return sanitizeForJson(truncated);
  } catch (error) {
    console.error(`Error truncating text for response: ${error.message}`);
    return 'Text truncation error - content available in output file';
  }
}

// From smart-ocr/route.ts
function sanitizeSmartOcr(text) {
  if (text === null || text === undefined) return '';
  
  // Convert to string if not already
  let strText;
  try {
    strText = String(text);
  } catch (e) {
    return 'Invalid text content';
  }

  try {
    // First handle multi-level escaped backslashes and sequences that can cause JSON issues
    let sanitized = strText;
    
    // Handle triple and double escaped sequences - must be done in order from most escaped to least
    sanitized = sanitized
      .replace(/\\\\\\n/g, '\\n')
      .replace(/\\\\\\r/g, '\\r')
      .replace(/\\\\\\t/g, '\\t')
      .replace(/\\\\\\"/g, '\\"')
      .replace(/\\\\\\\\/g, '\\\\')
      // Now handle double escaped sequences
      .replace(/\\\\n/g, '\n')
      .replace(/\\\\r/g, '\r')
      .replace(/\\\\t/g, '\t')
      .replace(/\\\\\\/g, '\\')
      // Handle any normal escaped sequences
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
      
    // Remove control characters except newlines, tabs, and carriage returns
    sanitized = sanitized
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      
      // Replace problematic quotes and apostrophes with simple versions
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      
      // Replace tabs with spaces in most contexts
      .replace(/\t/g, ' ')
      
      // Normalize multiple spaces
      .replace(/\s+/g, ' ');
    
    // Extra safety - specifically handle backslash sequences that might cause issues
    sanitized = sanitized
      .replace(/\\\\/g, '\\')  // Convert double backslashes to single
      .replace(/\\"/g, '"')    // Convert escaped quotes to regular quotes
      .replace(/\\'/g, "'")    // Convert escaped single quotes to regular single quotes
      .replace(/\\([^nrt\\"])/g, '$1'); // Remove unnecessary escapes

    // Final JSON validation check
    try {
      const testObj = { text: sanitized };
      const serialized = JSON.stringify(testObj);
      JSON.parse(serialized); // This will throw if invalid
    } catch (jsonError) {
      // If there's still a JSON issue, use more aggressive sanitization
      console.warn('JSON validation failed after initial sanitization, applying more aggressive cleaning');
      // Fall back to ASCII-only content with safe newlines
      sanitized = sanitized
        .replace(/[^\x20-\x7E\n]/g, '')
        .trim();
      
      // One more validation attempt
      try {
        JSON.stringify({ text: sanitized });
      } catch (finalError) {
        // If still failing, return a very safe fallback
        console.error(`Critical JSON sanitization failure: ${finalError.message}`);
        return 'Text content unavailable due to encoding issues';
      }
    }
    
    return sanitized.trim();
  } catch (error) {
    console.error(`Error sanitizing text: ${error.message}`);
    return 'Error sanitizing text';
  }
}

// From ocr/route.ts 
function sanitizeOcr(text) {
  if (!text) return '';
  
  try {
    // First handle multi-level escaped backslashes and sequences that can cause JSON issues
    let sanitized = text;
    
    // Handle triple and double escaped sequences - must be done in order from most escaped to least
    sanitized = sanitized
      .replace(/\\\\\\n/g, '\\n')
      .replace(/\\\\\\r/g, '\\r')
      .replace(/\\\\\\t/g, '\\t')
      .replace(/\\\\\\"/g, '\\"')
      .replace(/\\\\\\\\/g, '\\\\')
      // Now handle double escaped sequences
      .replace(/\\\\n/g, '\n')
      .replace(/\\\\r/g, '\r')
      .replace(/\\\\t/g, '\t')
      .replace(/\\\\\\/g, '\\')
      // Handle any normal escaped sequences
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
      
    // Remove control characters except newlines, tabs, and carriage returns
    sanitized = sanitized
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      
      // Replace problematic quotes and apostrophes with simple versions
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      
      // Replace tabs with spaces in most contexts
      .replace(/\t/g, ' ')
      
      // Normalize multiple spaces
      .replace(/\s+/g, ' ');
    
    // Extra safety - specifically handle backslash sequences that might cause issues
    sanitized = sanitized
      .replace(/\\\\/g, '\\')  // Convert double backslashes to single
      .replace(/\\"/g, '"')    // Convert escaped quotes to regular quotes
      .replace(/\\'/g, "'")    // Convert escaped single quotes to regular single quotes
      .replace(/\\([^nrt\\"])/g, '$1'); // Remove unnecessary escapes

    // Final JSON validation check
    try {
      const testObj = { text: sanitized };
      const serialized = JSON.stringify(testObj);
      JSON.parse(serialized); // This will throw if invalid
    } catch (jsonError) {
      // If there's still a JSON issue, use more aggressive sanitization
      console.warn('JSON validation failed after initial sanitization, applying more aggressive cleaning');
      // Fall back to ASCII-only content with safe newlines
      sanitized = sanitized
        .replace(/[^\x20-\x7E\n]/g, '')
        .trim();
      
      // One more validation attempt
      try {
        JSON.stringify({ text: sanitized });
      } catch (finalError) {
        // If still failing, return a very safe fallback
        console.error(`Critical JSON sanitization failure: ${finalError.message}`);
        return 'Text content unavailable due to encoding issues';
      }
    }
    
    return sanitized.trim();
  } catch (e) {
    console.error(`Error sanitizing text: ${e.message}`);
    return 'Text sanitization error';
  }
}

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
    name: 'Long repeating text',
    text: 'This is a repeating text. '.repeat(100)
  }
];

// Function to test if the sanitized text can be used in JSON
function testJsonSafety(text, name) {
  try {
    const obj = { text };
    const json = JSON.stringify(obj);
    const parsed = JSON.parse(json);
    return { success: true, result: parsed.text };
  } catch (error) {
    return { 
      success: false, 
      error: `${name} failed JSON test: ${error.message}` 
    };
  }
}

// Run the tests and log results
console.log('=== Testing JSON Sanitization and Validation ===\n');

testCases.forEach(testCase => {
  console.log(`## Test case: ${testCase.name}`);
  
  // Test each sanitization function
  const multiEngineResult = sanitizeForJson(testCase.text);
  const multiEngineSafety = testJsonSafety(multiEngineResult, 'multi-engine-ocr.ts');
  
  const smartResult = sanitizeSmartOcr(testCase.text);
  const smartSafety = testJsonSafety(smartResult, 'smart-ocr/route.ts');
  
  const ocrResult = sanitizeOcr(testCase.text);
  const ocrSafety = testJsonSafety(ocrResult, 'ocr/route.ts');
  
  // Test truncation
  const truncated = truncateTextForResponse(testCase.text, 20);
  const truncatedSafety = testJsonSafety(truncated, 'truncateTextForResponse');
  
  console.log(`Original length: ${testCase.text.length}`);
  console.log(`multi-engine-ocr.ts: ${multiEngineSafety.success ? 'SAFE' : 'UNSAFE'} (${multiEngineResult.length} chars)`);
  console.log(`smart-ocr/route.ts: ${smartSafety.success ? 'SAFE' : 'UNSAFE'} (${smartResult.length} chars)`);
  console.log(`ocr/route.ts: ${ocrSafety.success ? 'SAFE' : 'UNSAFE'} (${ocrResult.length} chars)`);
  console.log(`truncateTextForResponse: ${truncatedSafety.success ? 'SAFE' : 'UNSAFE'} (${truncated.length} chars)`);
  
  if (!multiEngineSafety.success || !smartSafety.success || !ocrSafety.success || !truncatedSafety.success) {
    console.log('ERRORS:');
    if (!multiEngineSafety.success) console.log(`- ${multiEngineSafety.error}`);
    if (!smartSafety.success) console.log(`- ${smartSafety.error}`);
    if (!ocrSafety.success) console.log(`- ${ocrSafety.error}`);
    if (!truncatedSafety.success) console.log(`- ${truncatedSafety.error}`);
  }
  
  console.log('\n');
});

console.log('=== Testing API Response JSON Safety ===\n');

// Create a mock response with problematic text
const mockResponse = {
  success: true,
  engine: 'test',
  text: testCases.map(tc => tc.text).join('\n'),
  confidence: 0.95,
  processingTime: 1234,
  warnings: ['This is a warning with special chars: \\\\ " \' \n \t']
};

// Test JSON stringification of the entire response
try {
  const json = JSON.stringify(mockResponse);
  const parsed = JSON.parse(json);
  console.log('Raw JSON response: SAFE');
} catch (error) {
  console.log(`Raw JSON response: UNSAFE - ${error.message}`);
  
  // Try with each sanitization approach
  const sanitized1 = {
    ...mockResponse,
    text: sanitizeForJson(mockResponse.text),
    warnings: mockResponse.warnings.map(w => sanitizeForJson(w))
  };
  
  const sanitized2 = {
    ...mockResponse,
    text: sanitizeSmartOcr(mockResponse.text),
    warnings: mockResponse.warnings.map(w => sanitizeSmartOcr(w))
  };
  
  const sanitized3 = {
    ...mockResponse,
    text: sanitizeOcr(mockResponse.text),
    warnings: mockResponse.warnings.map(w => sanitizeOcr(w))
  };
  
  try {
    JSON.stringify(sanitized1);
    console.log('multi-engine-ocr.ts sanitization: SAFE');
  } catch (e) {
    console.log(`multi-engine-ocr.ts sanitization: UNSAFE - ${e.message}`);
  }
  
  try {
    JSON.stringify(sanitized2);
    console.log('smart-ocr/route.ts sanitization: SAFE');
  } catch (e) {
    console.log(`smart-ocr/route.ts sanitization: UNSAFE - ${e.message}`);
  }
  
  try {
    JSON.stringify(sanitized3);
    console.log('ocr/route.ts sanitization: SAFE');
  } catch (e) {
    console.log(`ocr/route.ts sanitization: UNSAFE - ${e.message}`);
  }
}

console.log('\nTesting complete!');

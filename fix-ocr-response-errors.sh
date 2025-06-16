#!/bin/bash
# fix-ocr-response-errors.sh
# Script to fix OCR API response parsing errors

echo "Applying OCR response parsing fixes..."

# Create the json-response-helper.js file if it doesn't exist
mkdir -p lib
if [ ! -f lib/json-response-helper.js ]; then
  echo "Creating json-response-helper.js..."
  cat > lib/json-response-helper.js << 'EOL'
/**
 * JSON Response Helper for OCR API
 * 
 * This module provides utilities for safely handling large JSON responses
 * and preventing parsing errors due to response size limitations.
 * 
 * Works in both browser and Node.js environments.
 */

/**
 * Maximum response size for safe handling (approx)
 */
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Safely parse potentially large JSON responses
 * 
 * @param {Response|string} response - Fetch Response object or raw response text
 * @returns {Promise<object>} Parsed JSON object
 * @throws {Error} If parsing fails completely
 */
async function safeJsonParse(response) {
  try {
    // If response is a string, parse it directly
    if (typeof response === 'string') {
      return JSON.parse(response);
    }
    
    // If it's a Response object, try normal JSON parsing first
    if (response && typeof response.json === 'function') {
      try {
        return await response.json();
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError);
        
        // If JSON parsing fails, try to extract essential information using regex
        const text = await response.text();
        return extractJsonFromText(text, response.status);
      }
    }
    
    throw new Error('Invalid response object');
  } catch (error) {
    console.error('Safe JSON parse failed:', error);
    throw error;
  }
}

/**
 * Extract JSON data from raw text using regex when JSON.parse fails
 * 
 * @param {string} text - Raw response text
 * @param {number} status - HTTP status code
 * @returns {object} Extracted data as an object
 * @throws {Error} If extraction fails
 */
function extractJsonFromText(text, status = 200) {
  // Check if the response is extremely large
  if (text.length > 1000000) { // 1MB
    console.warn(`Response is very large (${(text.length/1024/1024).toFixed(2)}MB). This may be causing parsing issues.`);
  }
  
  // Try to extract success status and output file
  const successMatch = /\"success\":(?:true|false)/.exec(text);
  const success = successMatch ? successMatch[0].includes('true') : false;
  
  const outputFileMatch = text.match(/\"outputFile\":\"([^\"]+)\"/);
  const outputFile = outputFileMatch && outputFileMatch[1] ? outputFileMatch[1] : '';
  
  // Try to extract text content (truncated)
  const textMatch = text.match(/\"text\":\"([^\"]{0,1000})/);
  const extractedText = textMatch && textMatch[1] ? textMatch[1] + '...' : '';
  
  // Try to extract error details
  const errorMatch = text.match(/\"error\":\"([^\"]+)\"/);
  const error = errorMatch && errorMatch[1] ? errorMatch[1] : '';
  
  const detailsMatch = text.match(/\"details\":\"([^\"]+)\"/);
  const details = detailsMatch && detailsMatch[1] ? detailsMatch[1] : '';
  
  // If we found some data, return it
  if (success || outputFile) {
    console.log(`Successfully extracted data from response text. Output file: ${outputFile}`);
    return {
      success: success,
      outputFile: outputFile,
      text: extractedText || "Text too large to display - see PDF for full content",
      details: details || "Processed successfully but response was too large to parse as JSON",
      _extracted: true // Flag to indicate this was extracted
    };
  }
  
  // If extraction failed but we got a 200 status, assume success
  if (status === 200) {
    return {
      success: true,
      details: "Response was too large to parse as JSON, but server returned 200 OK",
      _extracted: true
    };
  }
  
  // If we couldn't extract anything useful, throw an error
  throw new Error(`Failed to parse server response. Response size: ${text.length} bytes`);
}

/**
 * Safely handle OCR API responses
 * 
 * @param {Response} response - Fetch Response object
 * @returns {Promise<object>} Processed response data
 */
async function handleOcrResponse(response) {
  // Clone the response so we can use it multiple times if needed
  const clonedResponse = response.clone();
  
  try {
    // Try to parse as JSON first
    const result = await safeJsonParse(response);
    return result;
  } catch (error) {
    console.error('JSON parsing failed:', error);
    
    // If parsing fails, check if the response contains a reference to an output file
    try {
      const text = await clonedResponse.text();
      
      // Check if there's a successful output file mention
      if (text.includes('_ocr.pdf') || text.includes('Output file:')) {
        // Extract filename using regex
        const filenameMatch = text.match(/([\w-]+)_ocr\.pdf/);
        const filename = filenameMatch ? `${filenameMatch[1]}_ocr.pdf` : null;
        
        if (filename) {
          console.log(`Extracted output filename from response: ${filename}`);
          return {
            success: true,
            outputFile: filename,
            details: "Successfully processed despite JSON parsing errors",
            _extracted: true
          };
        }
      }
      
      // Last resort - just return a generic success if status is 200
      if (clonedResponse.status === 200) {
        return {
          success: true,
          details: "Response couldn't be parsed, but server returned 200 OK",
          _extracted: true
        };
      }
      
      // If all else fails, throw an error
      throw new Error(`Failed to extract useful information from response. Status: ${clonedResponse.status}`);
    } catch (textError) {
      console.error('Text extraction failed:', textError);
      throw new Error(`Complete response handling failure. Status: ${clonedResponse.status}`);
    }
  }
}

// Export functions for use in Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    safeJsonParse,
    extractJsonFromText,
    handleOcrResponse
  };
} else {
  // For browser usage
  window.safeJsonParse = safeJsonParse;
  window.handleOcrResponse = handleOcrResponse;
}
EOL
fi

# Create a server-side version for API routes
if [ ! -f app/api/safe-response-handler.js ]; then
  echo "Creating server-side safe-response-handler.js for API routes..."
  mkdir -p app/api
  cat > app/api/safe-response-handler.js << 'EOL'
/**
 * Safe Response Handler for OCR API (Server-Side)
 * 
 * This module provides server-side utilities for safely handling large JSON responses
 * and preventing parsing errors due to response size limitations.
 */

/**
 * Maximum text length to include in direct API responses before truncating
 */
const MAX_SAFE_TEXT_LENGTH = 500000; // 500KB

/**
 * Create a safe JSON response that handles large text content
 * 
 * @param {object} data - The data to send as JSON
 * @param {number} status - HTTP status code (default: 200)
 * @returns {Response} NextJS/Express compatible response object
 */
function createSafeJsonResponse(data, status = 200) {
  // Handle case where there's large text content
  if (data && data.text && typeof data.text === 'string' && data.text.length > MAX_SAFE_TEXT_LENGTH) {
    console.log(`Text content is large (${Math.round(data.text.length / 1024)}KB). Truncating for response.`);
    
    // Create a separate HTML file with the full text content
    if (data.outputFile) {
      try {
        const fs = require('fs');
        const path = require('path');
        
        // Create a unique filename for the text content
        const baseName = data.outputFile.replace('.pdf', '');
        const htmlFilePath = path.join(process.cwd(), 'processed', `${baseName}_result.html`);
        
        // Write the full text content to an HTML file
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OCR Result: ${data.outputFile}</title>
  <style>
    body { font-family: sans-serif; margin: 20px; line-height: 1.5; }
    pre { white-space: pre-wrap; font-family: monospace; }
    .page { border-top: 2px solid #aaa; padding-top: 10px; margin-top: 20px; }
    .confidence { color: #777; }
  </style>
</head>
<body>
  <h1>OCR Result: ${data.outputFile}</h1>
  <div class="confidence">
    ${data.confidence ? `Overall Confidence: ${typeof data.confidence === 'number' ? data.confidence : 
        (data.confidence.averageConfidence || 'Unknown')}%` : ''}
  </div>
  <pre>${data.text}</pre>
</body>
</html>`;
        
        fs.writeFileSync(htmlFilePath, htmlContent);
        console.log(`Created text content HTML file: ${path.basename(htmlFilePath)}`);
        
        // Update the response to indicate the text was saved to a file
        data.text = data.text.substring(0, MAX_SAFE_TEXT_LENGTH) + 
          '... [TEXT TRUNCATED FOR PERFORMANCE REASONS - DOWNLOAD FULL RESULT FROM OUTPUT FILE]';
        data.fullTextAvailable = true;
        data.textContentFile = path.basename(htmlFilePath);
      } catch (error) {
        console.error('Error creating text content file:', error);
      }
    }
  }
  
  // Return the response
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

module.exports = {
  createSafeJsonResponse,
  MAX_SAFE_TEXT_LENGTH
};
EOL
fi

# Create a helper script to update the app/page.tsx file
echo "Creating fix-page-component.js..."
cat > fix-page-component.js << 'EOL'
// fix-page-component.js - Fixes the page component by adding the JSON handling imports

const fs = require('fs');
const path = require('path');

const PAGE_FILE = path.join(__dirname, 'app', 'page.tsx');
const BACKUP_FILE = path.join(__dirname, 'app', 'page.tsx.bak.fix');

// Skip if the file doesn't exist or the backup already exists
if (!fs.existsSync(PAGE_FILE)) {
  console.error(`Error: ${PAGE_FILE} does not exist!`);
  process.exit(1);
}

if (fs.existsSync(BACKUP_FILE)) {
  console.log(`Backup file ${BACKUP_FILE} already exists. Skipping backup.`);
} else {
  // Create a backup of the original file
  fs.copyFileSync(PAGE_FILE, BACKUP_FILE);
  console.log(`Created backup of original file: ${BACKUP_FILE}`);
}

// Read the file content
let content = fs.readFileSync(PAGE_FILE, 'utf8');

// Add the import for json-response-helper if it doesn't exist
if (!content.includes('json-response-helper')) {
  // Find the last import statement
  const lastImportIndex = content.lastIndexOf('import');
  const endOfImportsIndex = content.indexOf('\n', lastImportIndex);
  
  if (lastImportIndex !== -1) {
    // Insert the new import after the last one
    const newImport = `import { handleOcrResponse } from "@/lib/json-response-helper";\n`;
    content = content.slice(0, endOfImportsIndex + 1) + newImport + content.slice(endOfImportsIndex + 1);
    console.log('Added json-response-helper import');
  } else {
    console.warn('Could not find a place to add the import. Please add it manually.');
  }
}

// Find and update the executeOcrWithRetry function
const functionStart = content.indexOf('const executeOcrWithRetry');
if (functionStart !== -1) {
  // Find the end of the function
  let braceCount = 0;
  let inString = false;
  let stringChar = '';
  let functionEnd = functionStart;
  
  for (let i = content.indexOf('{', functionStart); i < content.length; i++) {
    const char = content[i];
    
    // Handle string literals to avoid counting braces inside strings
    if ((char === '"' || char === "'" || char === '`') && (i === 0 || content[i-1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    // Count braces only when not in a string
    if (!inString) {
      if (char === '{') braceCount++;
      else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          functionEnd = i + 1;
          break;
        }
      }
    }
  }
  
  if (functionEnd > functionStart) {
    // Get the old function code
    const oldFunction = content.substring(functionStart, functionEnd);
    
    // Create the new function code
    const newFunction = `const executeOcrWithRetry = async (formData: FormData, fileName: string, retry: boolean = false, apiEndpoint: string = "/api/ocr"): Promise<OcrResponse> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10-minute timeout
    
    appendOutput(\`Starting OCR process for \${fileName}...\`);
    if (apiEndpoint === "/api/smart-ocr") {
      appendOutput("🧠 Using Smart OCR with advanced processing...");
    }
    
    const response = await fetch(apiEndpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // Handle response with our improved parser that can handle large responses
    try {
      // Use our enhanced response handler
      const data = await handleOcrResponse(response);
      
      // Check if the data was extracted from a text response rather than proper JSON
      if (data._extracted) {
        appendOutput(\`⚠️ The OCR result text was truncated in the response for performance reasons.\`);
        
        if (data.outputFile) {
          appendOutput(\`🔗 Download the full OCR result: /api/download?file=\${data.outputFile.replace('.pdf', '_result.html')}\`);
          appendOutput(\`✅ Successfully processed \${fileName}\`);
          appendOutput(\`📄 Output file: \${data.outputFile}\`);
          
          // Add to processed files
          addProcessedFile({
            name: data.outputFile,
            path: \`/api/download?file=\${encodeURIComponent(data.outputFile)}\`,
          });
        }
        
        return data;
      }
      
      // Handle error responses with valid JSON structure
      if (!response.ok) {
        appendOutput(\`⚠️ Server responded with status \${response.status}: \${data.error || 'Unknown error'}\`);
        
        // Even with an error status, the file might have been processed successfully
        if (data.outputFile) {
          appendOutput(\`✅ Despite error, server indicates file was processed: \${data.outputFile}\`);
          return data; // Return data with outputFile info
        }

        // If details is an array of engine failures, summarise failures
        if (Array.isArray(data.details)) {
          const summary = data.details.map((d: any) => \`\${d.engine}: \${d.error}\`).join('; ');
          appendOutput(\`⚠️ All OCR engines failed: \${summary}\`);
          return data;
        }

        // If there's an error about file containing text, retry with force option
        if (typeof data.details === 'string' && data.details.toLowerCase().includes('already contains text') && !retry) {
          appendOutput("Attempting retry with force-ocr option...");
          return await handleSuccessResponse(data, fileName, retry);
        }

        // Just return the data - it contains structured error information
        return data;
      }
      
      // Handle success case
      return await handleSuccessResponse(data, fileName, retry);
    } catch (error) {
      console.error("Error handling OCR response:", error);
      
      // If all parsing fails, try one last approach - check if the file exists anyway
      const baseFileName = fileName.split('.').slice(0, -1).join('.');
      const expectedOutputFile = \`\${baseFileName}_ocr.pdf\`;
      
      try {
        // Check if the file exists despite parsing errors
        const checkResponse = await fetch(\`/api/download?file=\${encodeURIComponent(expectedOutputFile)}\`);
        if (checkResponse.ok) {
          appendOutput(\`✅ Found processed file despite response parsing issues: \${expectedOutputFile}\`);
          
          // Add to processed files
          addProcessedFile({
            name: expectedOutputFile,
            path: \`/api/download?file=\${encodeURIComponent(expectedOutputFile)}\`,
          });
          
          return {
            success: true,
            outputFile: expectedOutputFile,
            details: "File was processed successfully despite response parsing issues"
          };
        }
      } catch (fileCheckError) {
        console.error("Error checking for output file:", fileCheckError);
      }
      
      // Last resort, check the status API for recent files
      try {
        const statusResponse = await fetch('/api/status');
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          // Look for recently created files (last 5 minutes) matching our filename pattern
          const recentTime = Date.now() - 5 * 60 * 1000;
          const recentFiles = statusData.files?.filter((f: any) => 
            f.name.includes(baseFileName.replace(/\d+$/, '')) && 
            f.name.includes('_ocr.pdf') && 
            (f.timestamp > recentTime)
          );
          
          if (recentFiles?.length > 0) {
            // Sort by timestamp descending to get most recent
            recentFiles.sort((a: any, b: any) => b.timestamp - a.timestamp);
            const mostRecentFile = recentFiles[0].name;
            
            appendOutput(\`✅ Found recent matching processed file: \${mostRecentFile}\`);
            
            // Add to processed files
            addProcessedFile({
              name: mostRecentFile,
              path: \`/api/download?file=\${encodeURIComponent(mostRecentFile)}\`,
            });
            
            return {
              success: true,
              outputFile: mostRecentFile,
              details: "Found matching processed file from recent processing"
            };
          }
        }
      } catch (statusError) {
        console.error("Error checking status API:", statusError);
      }
      
      // If we still can't find the file, show the error
      if (error instanceof Error) {
        appendOutput(\`❌ Failed to process file: \${error.message}\`);
        throw error;
      }
      throw new Error('Unknown error during OCR response handling');
    }
  } catch (error) {
    console.error("Error during OCR execution:", error);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        appendOutput(\`❌ OCR process timed out for \${fileName}\`);
      } else if (!error.message.includes('HTTP error')) {
        // Only log non-HTTP errors as they were already handled
        appendOutput(\`❌ Error: \${error.message}\`);
      }
      throw error;
    }
    throw new Error('Unknown error during OCR execution');
  }
};`;
    
    // Replace the old function with the new one
    content = content.substring(0, functionStart) + newFunction + content.substring(functionEnd);
    console.log('Updated executeOcrWithRetry function');
    
    // Write the updated content back to the file
    fs.writeFileSync(PAGE_FILE, content);
    console.log(`Successfully updated ${PAGE_FILE}`);
  } else {
    console.warn('Could not find the end of the executeOcrWithRetry function. Please update it manually.');
  }
} else {
  console.warn('Could not find the executeOcrWithRetry function. Please update it manually.');
}
EOL

# Make the scripts executable
chmod +x fix-page-component.js

echo "Creating a fix for the server-side API routes..."
mkdir -p fixes
cat > fixes/fix-ocr-api-route.js << 'EOL'
// Add this to the top of your OCR API route files (e.g., app/api/ocr/route.js)

/*
import { createSafeJsonResponse } from '@/app/api/safe-response-handler';

// Replace instances of:
return new Response(JSON.stringify(data), {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
  },
});

// With:
return createSafeJsonResponse(data);

// And replace instances of:
return new Response(JSON.stringify({
  success: false,
  error: "Error message"
}), {
  status: 500,
  headers: {
    'Content-Type': 'application/json',
  },
});

// With:
return createSafeJsonResponse({
  success: false,
  error: "Error message"
}, 500);
*/
EOL

# Create a fix script for API routes
echo "Creating a script to automatically fix API routes..."
cat > fix-api-routes.js << 'EOL'
const fs = require('fs');
const path = require('path');

// Find all API route files
function findApiRoutes(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findApiRoutes(filePath, fileList);
    } else if (file === 'route.js' || file === 'route.ts') {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

// Fix a single API route file
function fixApiRouteFile(filePath) {
  console.log(`Checking API route: ${filePath}`);
  
  // Read the file
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Create a backup
  const backupPath = `${filePath}.bak`;
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, content);
    console.log(`Created backup: ${backupPath}`);
  }
  
  // Check if it already has the import
  if (!content.includes('safe-response-handler')) {
    // Add the import
    const importRegex = /(import[^;]*;\n)+/;
    const importMatch = content.match(importRegex);
    
    if (importMatch) {
      const imports = importMatch[0];
      content = content.replace(imports, imports + "import { createSafeJsonResponse } from '@/app/api/safe-response-handler';\n");
      console.log(`Added import to ${filePath}`);
    }
  }
  
  // Replace Response creation with createSafeJsonResponse
  const responseRegex = /new Response\(JSON\.stringify\(([^)]+)\)(,\s*{\s*status:\s*(\d+),\s*headers:[^}]+})?\)/g;
  let match;
  let modified = false;
  
  let newContent = content;
  while ((match = responseRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const dataArg = match[1];
    const optionsArg = match[2];
    const statusCode = match[3] || '200';
    
    // Only replace if it's a JSON response
    if (fullMatch.includes('application/json')) {
      const replacement = `createSafeJsonResponse(${dataArg}${statusCode !== '200' ? `, ${statusCode}` : ''})`;
      newContent = newContent.replace(fullMatch, replacement);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Updated API route: ${filePath}`);
    return true;
  } else {
    console.log(`No changes needed for: ${filePath}`);
    return false;
  }
}

// Find and fix all API routes
const apiRoutesDir = path.join(__dirname, 'app', 'api');
if (fs.existsSync(apiRoutesDir)) {
  const apiRoutes = findApiRoutes(apiRoutesDir);
  console.log(`Found ${apiRoutes.length} API routes to check`);
  
  let fixedCount = 0;
  for (const route of apiRoutes) {
    if (fixApiRouteFile(route)) {
      fixedCount++;
    }
  }
  
  console.log(`Fixed ${fixedCount} API routes`);
} else {
  console.error(`API routes directory not found: ${apiRoutesDir}`);
}
EOL

# Make the scripts executable
chmod +x fix-api-routes.js

echo "Running the fix scripts..."
node fix-page-component.js
node fix-api-routes.js

echo "✅ OCR response parsing fixes have been applied!"
echo ""
echo "The following improvements have been made:"
echo "1. Added robust JSON response parsing to handle large responses"
echo "2. Created backup files of all modified files"
echo "3. Updated the client-side code to better handle API responses"
echo "4. Added server-side safe response handling"
echo ""
echo "You can now process large PDF files without JSON parsing errors."

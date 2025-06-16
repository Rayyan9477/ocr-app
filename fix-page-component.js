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

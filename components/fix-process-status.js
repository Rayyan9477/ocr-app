/**
 * Fix for process-status.tsx component to handle missing output files
 * 
 * Usage:
 *   node fix-process-status.js
 */

const fs = require('fs');
const path = require('path');

const PROCESS_STATUS_PATH = path.join(__dirname, 'process-status.tsx');

// Read the current component
let content;
try {
  content = fs.readFileSync(PROCESS_STATUS_PATH, 'utf8');
} catch (err) {
  console.error(`Error reading file: ${err}`);
  process.exit(1);
}

// Add output file checking function
if (!content.includes('inferOutputFileName')) {
  const inferFunctionCode = `
  // Infer output file name when it's missing
  const inferOutputFileName = (inputFile: string): string => {
    if (!inputFile) return '';
    
    // Extract base name without extension
    const baseFileName = inputFile.replace(/\\.pdf$/i, '');
    
    // Create a sanitized filename
    const timestamp = Date.now();
    const sanitized = baseFileName
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 100);
    
    return \`\${sanitized}_\${timestamp}_ocr.pdf\`;
  };
`;

  // Find insertion point - after imports but before component definition
  const insertionPoint = content.indexOf('export function ProcessStatus');
  if (insertionPoint !== -1) {
    content = [
      content.slice(0, insertionPoint), 
      inferFunctionCode, 
      content.slice(insertionPoint)
    ].join('');
  } else {
    console.error('Could not find ProcessStatus component declaration');
    process.exit(1);
  }
}

// Modify the download button click handler to handle missing output file
const downloadHandlerRegex = /const handleDownload = \([^)]*\) => \{[^}]*\}/s;
const downloadHandlerReplacement = `const handleDownload = (file: { name: string; path: string }) => {
    if (!file.path) {
      console.error("Missing output file path");
      // Try to infer output path based on input name
      const inferredPath = inferOutputFileName(file.name);
      file = { ...file, path: inferredPath };
    }
    
    // Download the file from the server
    window.open(\`/api/download?file=\${encodeURIComponent(file.path)}\`, "_blank");
  }`;

if (content.match(downloadHandlerRegex)) {
  content = content.replace(downloadHandlerRegex, downloadHandlerReplacement);
} else {
  console.warn('Could not find handleDownload function to replace');
}

// Write back the modified file
try {
  fs.writeFileSync(PROCESS_STATUS_PATH, content);
  console.log(`✅ ProcessStatus component updated successfully`);
} catch (err) {
  console.error(`Error writing file: ${err}`);
  process.exit(1);
}

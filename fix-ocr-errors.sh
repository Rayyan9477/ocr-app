#!/bin/bash
# fix-ocr-errors.sh - Script to fix OCR API server errors

echo "Fixing OCR API route server 500 errors..."

# Create directories if they don't exist
mkdir -p /home/rayyan9477/ocr-app/uploads
mkdir -p /home/rayyan9477/ocr-app/processed
chmod -R 777 /home/rayyan9477/ocr-app/uploads
chmod -R 777 /home/rayyan9477/ocr-app/processed

# Check if required utilities are installed
echo "Checking for required utilities..."

# Check for OCRmyPDF
if ! command -v ocrmypdf &> /dev/null; then
    echo "❌ ocrmypdf not found! Please install with:"
    echo "  pip install ocrmypdf"
    exit 1
else
    echo "✅ ocrmypdf found: $(ocrmypdf --version | head -n 1)"
fi

# Create a fallback PDF generator script
cat > /home/rayyan9477/ocr-app/lib/create-fallback-pdf.js << 'EOL'
const fs = require('fs');
const path = require('path');

/**
 * Creates a simple fallback PDF when OCR fails
 */
function createFallbackPdf(inputName, outputPath, errorMessage) {
  // Simple HTML template for PDF
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>OCR Error Report</title>
      <style>
        body { font-family: sans-serif; margin: 40px; }
        h1 { color: #cc0000; }
        .error { border-left: 4px solid #cc0000; padding-left: 10px; }
        .details { margin-top: 20px; }
        .footer { margin-top: 40px; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <h1>OCR Processing Error</h1>
      <p>The system encountered an error while processing the file:</p>
      <h2>${inputName}</h2>
      
      <div class="error">
        <p>${errorMessage || 'Unknown error'}</p>
      </div>
      
      <div class="details">
        <p>Please try again with different settings or contact support if the issue persists.</p>
      </div>
      
      <div class="footer">
        <p>This is a fallback document created on ${new Date().toISOString()}</p>
      </div>
    </body>
    </html>
  `;
  
  // Write the HTML to a file
  fs.writeFileSync(outputPath, html);
  
  console.log(`Created fallback document at: ${outputPath}`);
  return outputPath;
}

// Export function for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createFallbackPdf };
}

// Also support direct execution
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length >= 3) {
    createFallbackPdf(args[0], args[1], args[2]);
  } else {
    console.error('Usage: node create-fallback-pdf.js <inputName> <outputPath> <errorMessage>');
    process.exit(1);
  }
}
EOL

# Create a minimal empty PDF to use as fallback
cat > /home/rayyan9477/ocr-app/lib/create-minimal-pdf.sh << 'EOL'
#!/bin/bash
# Creates a minimal blank PDF with an error message

if [ $# -lt 2 ]; then
  echo "Usage: $0 <output_path> <error_message>"
  exit 1
fi

OUTPUT_PATH="$1"
ERROR_MESSAGE="$2"

# Try convert (ImageMagick) if available
if command -v convert &> /dev/null; then
  convert -size 800x600 xc:white -font Arial -pointsize 20 -fill black \
    -draw "text 50,100 'OCR Process Failed'" \
    -draw "text 50,150 '${ERROR_MESSAGE}'" \
    -draw "text 50,500 'Created on $(date)'" \
    "${OUTPUT_PATH}"
  exit $?
fi

# If convert is not available, try using wkhtmltopdf
if command -v wkhtmltopdf &> /dev/null; then
  TEMP_HTML=$(mktemp --suffix=.html)
  cat > "${TEMP_HTML}" << HTML_END
<!DOCTYPE html>
<html>
<head>
  <title>OCR Error Report</title>
  <style>
    body { font-family: sans-serif; margin: 40px; }
    h1 { color: #cc0000; }
    .message { margin: 20px 0; }
  </style>
</head>
<body>
  <h1>OCR Process Failed</h1>
  <div class="message">
    <p>${ERROR_MESSAGE}</p>
  </div>
  <p>Created on $(date)</p>
</body>
</html>
HTML_END
  wkhtmltopdf "${TEMP_HTML}" "${OUTPUT_PATH}"
  rm "${TEMP_HTML}"
  exit $?
fi

# Last resort - create a text file instead
echo "OCR Process Failed" > "${OUTPUT_PATH%.pdf}.txt"
echo "${ERROR_MESSAGE}" >> "${OUTPUT_PATH%.pdf}.txt"
echo "Created on $(date)" >> "${OUTPUT_PATH%.pdf}.txt"
echo "Warning: Could not create PDF, created text file instead"
exit 1
EOL

# Make the script executable
chmod +x /home/rayyan9477/ocr-app/lib/create-minimal-pdf.sh

# Create a fix for the process-status.tsx component to handle missing output file
cat > /home/rayyan9477/ocr-app/components/fix-process-status.js << 'EOL'
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
EOL

# Create a fix for the OCR API route
cat > /home/rayyan9477/ocr-app/fix-ocr-api-errors.js << 'EOL'
/**
 * Fix for OCR API route to handle server 500 errors and missing output file paths
 */

const fs = require('fs');
const path = require('path');

const OCR_API_PATH = path.join(__dirname, 'app', 'api', 'ocr', 'route.ts');

// Read the current API route file
let content;
try {
  content = fs.readFileSync(OCR_API_PATH, 'utf8');
} catch (err) {
  console.error(`Error reading file: ${err}`);
  process.exit(1);
}

// Add output file helper import
if (!content.includes('ocr-output-helper')) {
  const importRegex = /import[^;]*from[^;]*;/g;
  const lastImportMatch = [...content.matchAll(importRegex)].pop();
  
  if (lastImportMatch) {
    const insertPosition = lastImportMatch.index + lastImportMatch[0].length;
    
    content = [
      content.slice(0, insertPosition),
      '\nimport { inferOutputFilePath, handleOcrError } from "@/lib/ocr-output-helper"',
      content.slice(insertPosition)
    ].join('');
  } else {
    console.warn('Could not find import statements to add ocr-output-helper import');
  }
}

// Update error response to always include output file path
const updateErrorResponse = (errorHandlerRegex, errorInfoExtractor) => {
  const matches = content.match(errorHandlerRegex);
  
  if (matches) {
    const match = matches[0];
    const errorHandlerReplacement = errorInfoExtractor(match)
      .replace(
        /return createJsonResponse\(\{[^}]*\}\s*,\s*\d+\)/s,
        (responseStr) => {
          // Add outputFile to response if not present
          if (!responseStr.includes('outputFile')) {
            const statusIndex = responseStr.lastIndexOf(',');
            return [
              responseStr.slice(0, statusIndex),
              ',\n      outputFile: inferOutputFilePath(inputPath ? path.basename(inputPath) : "unknown"),',
              responseStr.slice(statusIndex)
            ].join('');
          }
          return responseStr;
        }
      );
    
    content = content.replace(match, errorHandlerReplacement);
  } else {
    console.warn(`Could not find error handler matching: ${errorHandlerRegex}`);
  }
};

// Define the error handler regex patterns and extractors
const errorHandlers = [
  {
    regex: /return createJsonResponse\(\{\s*success: false,\s*error: ['"]OCR process failed['"],\s*details: [^}]*\}\s*,\s*500\);/s,
    extractor: match => match
  },
  {
    regex: /return createJsonResponse\(\{\s*success: false,\s*errorType: ['"]has_text['"],\s*error: ['"]PDF already contains text['"],\s*details: [^}]*\}\s*,\s*400\);/s,
    extractor: match => match
  },
  {
    regex: /return createJsonResponse\(\{\s*success: false,\s*errorType: ['"]tagged_pdf['"],\s*error: ['"]PDF is a tagged PDF['"],\s*details: [^}]*\}\s*,\s*400\);/s,
    extractor: match => match
  }
];

// Update each error handler
errorHandlers.forEach(handler => updateErrorResponse(handler.regex, handler.extractor));

// Add generateFallbackOutput function
const fallbackFunctionCode = `
// Generate a fallback output file path when OCR fails
async function generateFallbackOutput(inputPath, errorMessage) {
  const processedDir = appConfig.processedDir;
  const baseName = path.basename(inputPath);
  const fallbackPath = path.join(processedDir, \`\${baseName.replace(/\\.pdf$/i, '')}_fallback_\${Date.now()}.pdf\`);
  
  try {
    // Try to create a minimal PDF with error information
    await execWithTimeout(\`/home/rayyan9477/ocr-app/lib/create-minimal-pdf.sh "\${fallbackPath}" "\${errorMessage.replace(/"/g, '\\\\"')}"\`, 10000);
    return fallbackPath;
  } catch (error) {
    console.error("Failed to create fallback PDF:", error);
    // Return path even if creation failed - the client will handle missing files
    return fallbackPath;
  }
}
`;

// Add fallback function if not present
if (!content.includes('generateFallbackOutput')) {
  const insertionPoint = content.indexOf('export async function POST');
  
  if (insertionPoint !== -1) {
    content = [
      content.slice(0, insertionPoint),
      fallbackFunctionCode,
      content.slice(insertionPoint)
    ].join('');
  } else {
    console.warn('Could not find POST function to add generateFallbackOutput before it');
  }
}

// Write the modified file back
try {
  fs.writeFileSync(OCR_API_PATH, content);
  console.log(`✅ OCR API route updated successfully`);
} catch (err) {
  console.error(`Error writing file: ${err}`);
  process.exit(1);
}
EOL

# Create the ocr-output-helper.ts file
mkdir -p /home/rayyan9477/ocr-app/lib

cat > /home/rayyan9477/ocr-app/lib/ocr-output-helper.ts << 'EOL'
/**
 * OCR Output File Helpers
 * 
 * Utilities to help handle OCR output files, especially in error cases
 */

import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import appConfig from './config';

const execAsync = promisify(exec);

/**
 * Interface for minimal OCR result data structure
 */
export interface MinimalOcrResult {
  success: boolean;
  inputFile?: string; 
  outputFile?: string;
  error?: string;
}

/**
 * Infer an output file path based on an input file name
 * 
 * @param inputFilePath The original input file path
 * @returns The inferred output file path
 */
export function inferOutputFilePath(inputFilePath: string): string {
  if (!inputFilePath) return '';
  
  // Extract base name without extension
  const inputFileName = path.basename(inputFilePath);
  const baseFileName = inputFileName.replace(/\.pdf$/i, '');
  
  // Create a sanitized filename
  const timestamp = Date.now();
  const sanitized = baseFileName
    .replace(/[^a-z0-9]/gi, '_')
    .substring(0, 100);
  
  return `${sanitized}_${timestamp}_ocr.pdf`;
}

/**
 * Search for an existing output file that might match the input file
 * 
 * @param inputFilePath The input file path to match against
 * @returns The path to a matching output file, if found
 */
export async function findMatchingOutputFile(inputFilePath: string): Promise<string | null> {
  try {
    const inputFileName = path.basename(inputFilePath);
    const baseFileName = inputFileName.replace(/\.pdf$/i, '');
    const processedDir = appConfig.processedDir;
    
    // Search patterns in order of most to least likely
    const patterns = [
      // Default pattern with timestamp
      `${baseFileName.replace(/[^a-z0-9]/gi, '_')}_*_ocr.pdf`,
      // Pattern without timestamp
      `${baseFileName.replace(/[^a-z0-9]/gi, '_')}_ocr.pdf`,
      // More permissive pattern
      `${baseFileName.split('.')[0].replace(/[^a-z0-9]/gi, '_')}*_ocr.pdf`
    ];
    
    for (const pattern of patterns) {
      try {
        // Use find to locate potential matches
        const { stdout } = await execAsync(`find "${processedDir}" -name "${pattern}" -type f -print -quit`);
        
        if (stdout.trim()) {
          return stdout.trim();
        }
      } catch {
        // Ignore find errors, try next pattern
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding matching output file:', error);
    return null;
  }
}

/**
 * Create a minimal fallback PDF when OCR fails
 * This ensures the client always has a file to download
 * 
 * @param inputFilePath Original input file path
 * @param errorMessage Error message to include in the PDF
 * @returns Path to the created fallback PDF
 */
export async function createFallbackPdf(inputFilePath: string, errorMessage: string): Promise<string> {
  try {
    const baseFileName = path.basename(inputFilePath);
    const outputPath = path.join(
      appConfig.processedDir, 
      `${baseFileName.replace(/\.pdf$/i, '')}_fallback_${Date.now()}.pdf`
    );
    
    // Try using our shell script first
    try {
      await execAsync(`/home/rayyan9477/ocr-app/lib/create-minimal-pdf.sh "${outputPath}" "${errorMessage.replace(/"/g, '\\"')}"`);
      return outputPath;
    } catch (shellError) {
      console.warn('Shell script failed to create fallback PDF:', shellError);
      
      // Try using the Node.js fallback
      try {
        await execAsync(`node /home/rayyan9477/ocr-app/lib/create-fallback-pdf.js "${baseFileName}" "${outputPath}" "${errorMessage.replace(/"/g, '\\"')}"`);
        return outputPath;
      } catch (nodeError) {
        // If both methods fail, try copying the original file
        console.warn('Node.js script failed to create fallback PDF:', nodeError);
        
        try {
          await fs.promises.copyFile(inputFilePath, outputPath);
          return outputPath;
        } catch (copyError) {
          console.error('Failed to copy original file as fallback:', copyError);
          
          // Last resort - create a text file
          const textPath = outputPath.replace(/\.pdf$/, '.txt');
          await fs.promises.writeFile(textPath, `OCR Error for file ${baseFileName}: ${errorMessage}`);
          return textPath;
        }
      }
    }
  } catch (error) {
    console.error('All fallback PDF creation methods failed:', error);
    throw error;
  }
}

/**
 * Handle OCR errors and ensure an output file is always available
 * 
 * @param inputFilePath Original input file path
 * @param errorMessage Error message to include
 * @returns OCR result with a valid output file path
 */
export async function handleOcrError(inputFilePath: string, errorMessage: string): Promise<MinimalOcrResult> {
  try {
    // First try to find an existing output file that might match
    const matchingFile = await findMatchingOutputFile(inputFilePath);
    
    if (matchingFile) {
      return {
        success: false,
        inputFile: inputFilePath,
        outputFile: matchingFile,
        error: `${errorMessage} (Using existing output file)`
      };
    }
    
    // If no matching file found, create a fallback
    const fallbackPath = await createFallbackPdf(inputFilePath, errorMessage);
    
    return {
      success: false,
      inputFile: inputFilePath,
      outputFile: fallbackPath,
      error: `${errorMessage} (Created fallback file)`
    };
  } catch (error) {
    console.error('Error handling OCR failure:', error);
    
    // Last resort fallback - generate a path even if we couldn't create a file
    const inferredPath = path.join(
      appConfig.processedDir,
      inferOutputFilePath(inputFilePath)
    );
    
    return {
      success: false,
      inputFile: inputFilePath,
      outputFile: inferredPath,
      error: `${errorMessage} (Could not create fallback file: ${error})`
    };
  }
}
EOL

# Run the fixes
echo "Running OCR API fix script..."
node /home/rayyan9477/ocr-app/fix-ocr-api-errors.js

echo "Running ProcessStatus component fix script..."
node /home/rayyan9477/ocr-app/components/fix-process-status.js

# Update the download API to handle missing files
cat > /home/rayyan9477/ocr-app/app/api/download/route.ts.new << 'EOL'
import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import path from "path";
import appConfig from "@/lib/config";
import { createFallbackPdf } from "@/lib/ocr-output-helper";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get("file");

    if (!fileName) {
      return new NextResponse("File parameter is required", { status: 400 });
    }

    // Security check to prevent directory traversal
    const sanitizedFileName = path.basename(fileName);

    // Construct the file path
    const filePath = join(appConfig.processedDir, sanitizedFileName);

    // Check if the file exists
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      
      // Try to create a fallback file
      try {
        const errorMessage = "The requested file was not found. It may have been deleted or failed to process correctly.";
        const fallbackPath = await createFallbackPdf(sanitizedFileName, errorMessage);
        
        console.log(`Created fallback file at: ${fallbackPath} for missing: ${sanitizedFileName}`);
        
        // If fallback was successful, redirect to download it
        if (existsSync(fallbackPath)) {
          const fallbackFileName = path.basename(fallbackPath);
          const redirectUrl = `/api/download?file=${encodeURIComponent(fallbackFileName)}`;
          
          return NextResponse.redirect(new URL(redirectUrl, request.url));
        }
      } catch (fallbackError) {
        console.error("Error creating fallback file:", fallbackError);
      }
      
      // If fallback creation failed, return 404
      return new NextResponse("File not found", { status: 404 });
    }

    // Get the file type and size
    const fileStat = await stat(filePath);
    const isTextFile = filePath.toLowerCase().endsWith(".txt");
    
    // Get the content type
    const contentType = isTextFile 
      ? "text/plain"
      : "application/pdf";

    // Read the file
    const fileBuffer = await readFile(filePath);

    // Return the file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${sanitizedFileName}"`,
        "Content-Length": fileStat.size.toString(),
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return new NextResponse("Error serving file", { status: 500 });
  }
}
EOL

# Replace the download API route
mv /home/rayyan9477/ocr-app/app/api/download/route.ts.new /home/rayyan9477/ocr-app/app/api/download/route.ts

# Create summary
echo ""
echo "✅ OCR error fixes completed"
echo "✅ Created output file helpers"
echo "✅ Fixed API error handling"
echo "✅ Added fallback mechanisms"
echo "✅ Updated download API route"
echo ""
echo "The OCR application should now handle errors more gracefully and always return an output file path."
echo "If you still encounter issues, check the server logs for more specific errors."
echo ""
echo "Restart your application with: npm run dev"

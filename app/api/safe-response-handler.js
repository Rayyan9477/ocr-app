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

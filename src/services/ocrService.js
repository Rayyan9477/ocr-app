// src/services/ocrService.js

const OCR_API_ENDPOINT = 'https://api.ocrserver.com/process';
const API_KEY = 'your_api_key_here';

function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'Accept': 'application/json',
  };
}

function createFormData(file) {
  const formData = new FormData();
  formData.append('file', file);
  return formData;
}

async function processDocument(file) {
  let attempts = 0;
  const maxAttempts = 3;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  
  while (attempts < maxAttempts) {
    try {
      console.log(`🧠 Using Smart OCR with advanced processing...`);
      const response = await fetch(OCR_API_ENDPOINT, {
        method: 'POST',
        body: createFormData(file),
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        console.warn(`⚠️ Server returned status ${response.status}. Attempt ${attempts + 1}/${maxAttempts}`);
        if (response.status === 500 && attempts < maxAttempts - 1) {
          attempts++;
          await delay(2000 * attempts); // Exponential backoff
          continue;
        }
        throw new Error(`Server returned status ${response.status}`);
      }
      
      const rawResponse = await response.text();
      console.log(`Received response of length: ${rawResponse.length} bytes`);
      
      // Only try to parse as JSON if it looks like JSON
      if (!rawResponse || rawResponse.trim() === '' || 
          (!rawResponse.startsWith('{') && !rawResponse.startsWith('['))) {
        throw new Error(`Server returned invalid response format. Raw response: ${rawResponse.substring(0, 100)}...`);
      }
      
      try {
        return JSON.parse(rawResponse);
      } catch (jsonError) {
        throw new Error(`Server returned invalid JSON. Raw response: ${rawResponse.substring(0, 100)}...`);
      }
    } catch (error) {
      if (attempts >= maxAttempts - 1) {
        console.error(`❌ Error processing ${file.name}: ${error.message}`);
        throw error;
      }
      attempts++;
      await delay(2000 * attempts);
    }
  }
}

export { processDocument };
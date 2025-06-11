'use client';

// Client-side API wrapper for server operations
// This allows client components to use server functions without directly importing Node.js modules

/**
 * Execute a command on the server
 * @param {string} command - The command to execute
 * @returns {Promise<object>} - The result of the command execution
 */
export async function executeCommand(command) {
  try {
    const response = await fetch('/api/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to execute command:', error);
    throw error;
  }
}

/**
 * Process an image on the server
 * @param {string} filePath - The path to the image file
 * @returns {Promise<object>} - The processing result
 */
export async function processImageClient(filePath) {
  try {
    const response = await fetch('/api/process-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filePath }),
    });

    if (!response.ok) {
      throw new Error(`Image processing failed with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to process image:', error);
    throw error;
  }
}

/**
 * Run an OCR command on the server
 * @param {string} command - The OCR command to run
 * @returns {Promise<object>} - The OCR result
 */
export async function runOcrCommandClient(command) {
  try {
    const response = await fetch('/api/run-ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
    });

    if (!response.ok) {
      throw new Error(`OCR operation failed with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to run OCR command:', error);
    throw error;
  }
}

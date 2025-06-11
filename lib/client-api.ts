'use client';

/**
 * Client API wrapper for server-side operations
 */

/** Execute a shell command via the server API */
export async function executeCommand(command: string) {
  const response = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });
  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }
  return response.json();
}

/** Process an image or PDF via the server API */
export async function processImage(filePath: string) {
  const url = `/api/process-image?path=${encodeURIComponent(filePath)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to process image: ${response.status}`);
  }
  return response.json();
}

/** Run a custom OCR command via the server API */
export async function runOcrCommand(command: string) {
  const response = await fetch('/api/run-ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });
  if (!response.ok) {
    throw new Error(`OCR command failed: ${response.status}`);
  }
  return response.json();
}

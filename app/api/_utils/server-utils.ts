// In Next.js API routes, server-side code is already isolated
// Do NOT use 'use server' directive in API route utility files

import { exec } from 'child_process';
import { promisify } from 'util';

/**
 * Promisified exec function for running shell commands
 * Only use this in server components or API routes
 */
export const execAsync = promisify(exec);

/**
 * Simple logger utility for server-side logging
 */
export const serverLogger = {
  info: (message: string, ...args: any[]) => console.log(`[SERVER INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[SERVER ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[SERVER WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.debug(`[SERVER DEBUG] ${message}`, ...args),
};

/**
 * Run a shell command and return its output
 */
export async function runCommand(command: string) {
  try {
    const { stdout, stderr } = await execAsync(command);
    return { success: true, stdout, stderr };
  } catch (error) {
    console.error('Command execution error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Create a JSON response with size limitation to prevent oversized responses
 * that could cause parsing issues on the client
 */
export function createSafeSizedJsonResponse(data: any, status: number = 200) {
  // Check if the data has a 'text' field that might be very large
  if (data && typeof data === 'object' && data.text && typeof data.text === 'string') {
    // If text is longer than 10KB, truncate it and add metadata
    const MAX_TEXT_LENGTH = 10000; // 10KB
    if (data.text.length > MAX_TEXT_LENGTH) {
      serverLogger.warn(`Response text is large (${data.text.length} chars), truncating to ${MAX_TEXT_LENGTH}`);
      data = {
        ...data,
        text: data.text.substring(0, MAX_TEXT_LENGTH),
        fullTextAvailable: true,
        textLength: data.text.length
      };
    }
  }

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

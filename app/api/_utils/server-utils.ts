'use server';

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

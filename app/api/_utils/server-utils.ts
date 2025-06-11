// Server-side utilities - only use in API routes or server components
// Do not import this file in client components or pages
import { promisify } from 'util';
import { exec, spawn } from 'child_process';

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

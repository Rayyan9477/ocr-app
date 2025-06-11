// This file contains server-side utilities that should not be imported in client components
// Only import this file in server components (app/api) or use the 'use server' directive
import { promisify } from 'util';
import { exec, spawn } from 'child_process';

/**
 * Promisified exec function for running shell commands
 * Only use this in server components or API routes
 */
export const execAsync = promisify(exec);

/**
 * Server-side logger - use this to avoid client-side console logging
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
 * Wrapper for child_process.spawn with logging
 * @param command The command to run
 * @param args Arguments for the command
 * @param options Options to pass to spawn
 */
export function spawnProcess(command: string, args: string[], options: any = {}) {
  serverLogger.info(`Running command: ${command} ${args.join(' ')}`);
  return spawn(command, args, options);
}

/**
 * Execute a command and return its output
 * @param command The command to execute
 */
export async function runCommand(command: string) {
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      serverLogger.warn(`Command stderr: ${stderr}`);
    }
    return stdout.trim();
  } catch (error) {
    serverLogger.error(`Command error: ${error}`);
    throw error;
  }
}

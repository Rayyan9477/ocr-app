'use server';

import { execAsync } from '@/lib/server-utils';

/**
 * Execute a shell command on the server
 * This is a server action that can be called from client components
 */
export async function executeCommand(command: string) {
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

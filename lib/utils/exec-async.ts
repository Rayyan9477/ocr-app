import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Execute a shell command asynchronously and return the result
 * @param command The command to execute
 * @param options Options for command execution (cwd, env, etc.)
 * @returns Promise with stdout and stderr
 */
export async function execAsync(
  command: string,
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeout?: number;
    maxBuffer?: number;
  } = {}
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execPromise(command, {
      ...options,
      // Default options
      maxBuffer: options.maxBuffer || 10 * 1024 * 1024, // 10MB buffer by default
      timeout: options.timeout || 0, // No timeout by default
    });
  } catch (error: any) {
    // Re-throw with more context
    throw new Error(
      `Command failed: ${command}\n` +
        `Error: ${error.message}\n` +
        `Code: ${error.code}\n` +
        `Signal: ${error.signal}\n` +
        `Output: ${error.stderr || error.stdout || 'No output'}`
    );
  }
}

/**
 * Check if a command exists in the system PATH
 * @param command The command to check
 * @returns Promise<boolean> True if the command exists
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      process.platform === 'win32' 
        ? `where ${command}` 
        : `command -v ${command} || which ${command} || type -p ${command}`,
      { maxBuffer: 1024 * 1024 }
    );
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

export default {
  execAsync,
  commandExists,
};

'use server';

import { exec } from 'child_process';
import { promisify } from 'util';

// Make sure these functions are only used in server components or API routes
export const execAsync = promisify(exec);

export async function runCommand(command) {
  try {
    const { stdout, stderr } = await execAsync(command);
    return { stdout, stderr };
  } catch (error) {
    console.error(`Error executing command: ${command}`, error);
    throw error;
  }
}

export async function processImage(filePath) {
  try {
    const result = await runCommand(`identify -format "%w %h" ${filePath}`);
    return result.stdout.trim().split(' ').map(Number);
  } catch (error) {
    console.error(`Failed to process image: ${filePath}`, error);
    throw error;
  }
}

export async function runOcrCommand(command) {
  console.log(`Running OCR command: ${command}`);
  try {
    const result = await runCommand(command);
    return result;
  } catch (error) {
    console.error('OCR command failed:', error);
    throw error;
  }
}

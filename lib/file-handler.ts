/**
 * Enhanced file handling utilities that work around experimental File API
 * This helps avoid the "buffer.File is an experimental feature" warning
 */

import { Readable } from 'stream';
import { createHash } from 'crypto';
import { randomBytes } from 'crypto';

/**
 * A class to handle File objects from FormData in a way that avoids experimental API warnings
 */
export class FileHandler {
  /**
   * Convert a FormData file to a Buffer
   */
  static async toBuffer(file: File | null): Promise<Buffer | null> {
    if (!file) return null;
    return Buffer.from(await file.arrayBuffer());
  }

  /**
   * Get file metadata safely
   */
  static getMetadata(file: File | null): { name: string; size: number; type: string } | null {
    if (!file) return null;
    return {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream'
    };
  }

  /**
   * Generate a unique filename with timestamp and original name
   */
  static generateFilename(originalName: string): string {
    const timestamp = Date.now();
    const randomId = randomBytes(4).toString('hex');
    return `${timestamp}_${randomId}_${originalName}`;
  }

  /**
   * Compute file hash (useful for caching)
   */
  static async computeHash(buffer: Buffer): Promise<string> {
    return createHash('sha256').update(buffer).digest('hex');
  }
}

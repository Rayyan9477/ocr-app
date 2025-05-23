import { readdir, unlink, stat } from 'fs/promises';
import { statSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import config from './config';

export class CleanupService {
  private static instance: CleanupService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): CleanupService {
    if (!CleanupService.instance) {
      CleanupService.instance = new CleanupService();
    }
    return CleanupService.instance;
  }

  public startCleanupService(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(
      () => this.performCleanup(),
      config.cleanupInterval
    );

    console.log('Cleanup service started');
  }

  public stopCleanupService(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('Cleanup service stopped');
    }
  }

  private async getFileHash(filePath: string): Promise<string> {
    try {
      const stats = await stat(filePath);
      const hashInput = `${filePath}${stats.size}${stats.mtime.getTime()}`;
      return createHash('md5').update(hashInput).digest('hex');
    } catch (error) {
      console.error(`Error getting file hash for ${filePath}:`, error);
      return '';
    }
  }

  private async findDuplicates(directory: string): Promise<Map<string, string[]>> {
    const duplicates = new Map<string, string[]>();
    const fileHashMap = new Map<string, string>();
    
    try {
      const files = await readdir(directory);
      
      for (const file of files) {
        // Skip directories and non-PDF files
        if (!file.toLowerCase().endsWith('.pdf')) continue;
        
        const filePath = join(directory, file);
        
        try {
          // Get a hash that represents the file content
          const hash = await this.getFileHash(filePath);
          
          if (hash && fileHashMap.has(hash)) {
            // Found a potential duplicate
            const hashKey = fileHashMap.get(hash)!;
            
            if (!duplicates.has(hashKey)) {
              duplicates.set(hashKey, [join(directory, hashKey)]);
            }
            
            duplicates.get(hashKey)!.push(filePath);
          } else {
            fileHashMap.set(hash, file);
          }
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error);
        }
      }
      
      return duplicates;
    } catch (error) {
      console.error(`Error finding duplicates in ${directory}:`, error);
      return new Map();
    }
  }

  private async cleanupOldFiles(directory: string): Promise<void> {
    try {
      const files = await readdir(directory);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = join(directory, file);
        const stats = await stat(filePath);
        const fileAge = now - stats.mtime.getTime();

        if (fileAge > config.maxStorageAge) {
          try {
            await unlink(filePath);
            console.log(`Removed old file: ${filePath}`);
          } catch (error) {
            console.error(`Error removing old file ${filePath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }

  private async removeDuplicates(directory: string): Promise<void> {
    const duplicates = await this.findDuplicates(directory);

    for (const [hash, files] of duplicates.entries()) {
      // Keep the newest file
      files.sort((a, b) => {
        try {
          const [statsA, statsB] = [statSync(a), statSync(b)];
          return statsB.mtime.getTime() - statsA.mtime.getTime();
        } catch {
          return 0;
        }
      });

      // Remove duplicates (keep the first/newest one)
      for (let i = 1; i < files.length; i++) {
        try {
          await unlink(files[i]);
          console.log(`Removed duplicate file: ${files[i]}`);
        } catch (error) {
          console.error(`Error removing duplicate file ${files[i]}:`, error);
        }
      }
    }
  }

  public async performCleanup(): Promise<void> {
    console.log('Starting cleanup process...');

    try {
      // Clean up old files
      await this.cleanupOldFiles(config.uploadsDir);
      await this.cleanupOldFiles(config.processedDir);
      await this.cleanupOldFiles(config.tempDir);

      // Remove duplicates
      await this.removeDuplicates(config.uploadsDir);
      await this.removeDuplicates(config.processedDir);

      console.log('Cleanup process completed successfully');
    } catch (error) {
      console.error('Error during cleanup process:', error);
    }
  }
}

// Helper function for string comparison
const compareStrings = (a: string, b: string): number => {
    return a.localeCompare(b);
}

import { writeFile, unlink, access, constants } from 'fs/promises';
import { join } from 'path';
import config from './config';

export interface DirectoryPermissionResult {
  directory: string;
  exists: boolean;
  writable: boolean;
  error?: string;
}

/**
 * Comprehensive directory permission check
 * Tests if directories exist and are writable by creating and deleting test files
 */
export async function checkDirectoryPermissions(
  directories = [config.uploadsDir, config.processedDir]
): Promise<{ 
  allPermissionsOk: boolean; 
  results: DirectoryPermissionResult[] 
}> {
  const results: DirectoryPermissionResult[] = [];
  let allPermissionsOk = true;

  for (const dir of directories) {
    const result: DirectoryPermissionResult = {
      directory: dir,
      exists: false,
      writable: false
    };

    try {
      // Check if directory exists
      await access(dir, constants.F_OK);
      result.exists = true;

      // Check if directory is writable by creating a test file
      const testFile = join(dir, `write-test-${Date.now()}.tmp`);
      await writeFile(testFile, 'Permission test');
      await unlink(testFile);
      result.writable = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      allPermissionsOk = false;
    }

    results.push(result);
  }

  return { allPermissionsOk, results };
}

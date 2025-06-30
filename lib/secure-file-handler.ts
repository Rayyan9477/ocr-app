import crypto from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { pipeline } from 'stream/promises';

interface FileMetadata {
  originalName: string;
  encryptedPath: string;
  processingDate: Date;
  expiryDate: Date;
  accessLog: Array<{
    timestamp: Date;
    action: string;
    userId: string;
  }>;
}

class SecureFileHandler {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly authTagLength = 16; // 128 bits
  private readonly encryptionKey: Buffer;

  constructor(encryptionKey: string) {
    this.encryptionKey = Buffer.from(encryptionKey, 'hex');
  }

  async encryptAndStore(
    sourceFilePath: string,
    destinationPath: string,
    metadata: Omit<FileMetadata, 'encryptedPath'>
  ): Promise<FileMetadata> {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    const fileMetadata: FileMetadata = {
      ...metadata,
      encryptedPath: destinationPath,
    };

    const readStream = createReadStream(sourceFilePath);
    const writeStream = createWriteStream(destinationPath);

    // Write IV at the beginning of the file
    writeStream.write(iv);

    await pipeline(readStream, cipher, writeStream);

    // Store auth tag at the end
    const authTag = cipher.getAuthTag();
    await new Promise<void>((resolve, reject) => {
      writeStream.write(authTag, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Delete the original file
    await unlink(sourceFilePath);

    // Log access
    this.logAccess(fileMetadata, 'ENCRYPT_AND_STORE');

    return fileMetadata;
  }

  async retrieveAndDecrypt(
    metadata: FileMetadata,
    destinationPath: string,
    userId: string
  ): Promise<void> {
    if (new Date() > metadata.expiryDate) {
      throw new Error('File has expired');
    }

    const readStream = createReadStream(metadata.encryptedPath);
    const writeStream = createWriteStream(destinationPath);

    // Read IV from the beginning of the file
    const iv = Buffer.alloc(this.ivLength);
    await new Promise<void>((resolve, reject) => {
      readStream.read(iv, 0, this.ivLength, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);

    await pipeline(readStream, decipher, writeStream);

    // Log access
    this.logAccess(metadata, 'RETRIEVE_AND_DECRYPT', userId);
  }

  private logAccess(metadata: FileMetadata, action: string, userId: string = 'SYSTEM') {
    metadata.accessLog.push({
      timestamp: new Date(),
      action,
      userId,
    });

    // Here you would typically also send this to your audit log system
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      file: metadata.originalName,
      action,
      userId,
      type: 'FILE_ACCESS',
    }));
  }

  async cleanupExpiredFiles(metadata: FileMetadata): Promise<void> {
    if (new Date() > metadata.expiryDate) {
      await unlink(metadata.encryptedPath);
      this.logAccess(metadata, 'FILE_CLEANUP');
    }
  }
}

export { SecureFileHandler, type FileMetadata };

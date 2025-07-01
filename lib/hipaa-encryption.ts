import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
}

interface EncryptedFile {
  id: string;
  originalName: string;
  encryptedPath: string;
  checksum: string;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed?: Date;
}

class HIPAAEncryptionService {
  private readonly config: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32, // 256 bits
    ivLength: 16, // 128 bits
    tagLength: 16, // 128 bits
  };

  private readonly masterKey: Buffer;
  private readonly storageDir: string;

  constructor(masterKeyHex: string, storageDir: string = './secure_storage') {
    this.masterKey = Buffer.from(masterKeyHex, 'hex');
    this.storageDir = storageDir;
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directory:', error);
    }
  }

  private generateFileKey(): Buffer {
    return crypto.randomBytes(this.config.keyLength);
  }

  private generateIV(): Buffer {
    return crypto.randomBytes(this.config.ivLength);
  }

  private createChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Basic string encryption/decryption for health checks and simple data
  async encrypt(data: string): Promise<string> {
    try {
      const iv = this.generateIV();
      const cipher = crypto.createCipheriv(this.config.algorithm, this.masterKey, iv);
      cipher.setAAD(Buffer.from('hipaa-data'));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV + authTag + encrypted data
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async decrypt(encryptedData: string): Promise<string> {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipheriv(this.config.algorithm, this.masterKey, iv);
      decipher.setAAD(Buffer.from('hipaa-data'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async encryptFile(filePath: string, originalName: string, retentionHours: number = 24): Promise<EncryptedFile> {
    try {
      // Read original file
      const fileData = await fs.readFile(filePath);
      const checksum = this.createChecksum(fileData);

      // Generate encryption materials
      const fileKey = this.generateFileKey();
      const iv = this.generateIV();
      const fileId = crypto.randomUUID();

      // Encrypt file key with master key
      const keyIv = this.generateIV();
      const keyCipher = crypto.createCipheriv(this.config.algorithm, this.masterKey, keyIv);
      const encryptedKey = Buffer.concat([
        keyCipher.update(fileKey),
        keyCipher.final(),
        keyCipher.getAuthTag()
      ]);

      // Encrypt file data
      const dataCipher = crypto.createCipheriv(this.config.algorithm, fileKey, iv);
      const encryptedData = Buffer.concat([
        dataCipher.update(fileData),
        dataCipher.final(),
        dataCipher.getAuthTag()
      ]);

      // Create encrypted file structure
      const encryptedFile = Buffer.concat([
        keyIv, // 16 bytes
        Buffer.from([encryptedKey.length]), // 1 byte
        encryptedKey, // variable length
        iv, // 16 bytes
        encryptedData // variable length
      ]);

      // Save encrypted file
      const encryptedPath = path.join(this.storageDir, `${fileId}.enc`);
      await fs.writeFile(encryptedPath, encryptedFile);

      // Delete original file
      await fs.unlink(filePath);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + retentionHours * 60 * 60 * 1000);

      return {
        id: fileId,
        originalName,
        encryptedPath,
        checksum,
        createdAt: now,
        expiresAt,
        accessCount: 0
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('File encryption failed');
    }
  }

  async decryptFile(encryptedFile: EncryptedFile, outputPath: string): Promise<void> {
    try {
      // Check if file has expired
      if (new Date() > encryptedFile.expiresAt) {
        await this.secureDelete(encryptedFile.encryptedPath);
        throw new Error('File has expired and been deleted');
      }

      // Read encrypted file
      const encryptedData = await fs.readFile(encryptedFile.encryptedPath);
      
      // Parse encrypted file structure
      let offset = 0;
      const keyIv = encryptedData.subarray(offset, offset + this.config.ivLength);
      offset += this.config.ivLength;

      const encryptedKeyLength = encryptedData[offset];
      offset += 1;

      const encryptedKey = encryptedData.subarray(offset, offset + encryptedKeyLength);
      offset += encryptedKeyLength;

      const dataIv = encryptedData.subarray(offset, offset + this.config.ivLength);
      offset += this.config.ivLength;

      const fileData = encryptedData.subarray(offset);

      // Decrypt file key
      const keyDecipher = crypto.createDecipheriv(this.config.algorithm, this.masterKey, keyIv);
      keyDecipher.setAuthTag(encryptedKey.subarray(-this.config.tagLength));
      const fileKey = Buffer.concat([
        keyDecipher.update(encryptedKey.subarray(0, -this.config.tagLength)),
        keyDecipher.final()
      ]);

      // Decrypt file data
      const dataDecipher = crypto.createDecipheriv(this.config.algorithm, fileKey, dataIv);
      dataDecipher.setAuthTag(fileData.subarray(-this.config.tagLength));
      const decryptedData = Buffer.concat([
        dataDecipher.update(fileData.subarray(0, -this.config.tagLength)),
        dataDecipher.final()
      ]);

      // Verify integrity
      const checksum = this.createChecksum(decryptedData);
      if (checksum !== encryptedFile.checksum) {
        throw new Error('File integrity check failed');
      }

      // Write decrypted file
      await fs.writeFile(outputPath, decryptedData);

      // Update access tracking
      encryptedFile.accessCount++;
      encryptedFile.lastAccessed = new Date();

    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('File decryption failed');
    }
  }

  async secureDelete(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      
      // Overwrite with random data multiple times
      for (let i = 0; i < 3; i++) {
        const randomData = crypto.randomBytes(fileSize);
        await fs.writeFile(filePath, randomData);
        await fs.fsync(await fs.open(filePath, 'r+'));
      }
      
      // Finally delete the file
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Secure delete failed:', error);
    }
  }

  async cleanupExpiredFiles(encryptedFiles: EncryptedFile[]): Promise<void> {
    const now = new Date();
    const expiredFiles = encryptedFiles.filter(file => now > file.expiresAt);
    
    for (const file of expiredFiles) {
      await this.secureDelete(file.encryptedPath);
    }
  }
}

export { HIPAAEncryptionService, type EncryptedFile };

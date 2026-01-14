import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

/**
 * Encryption Service using local AES-256-GCM encryption
 *
 * This implementation uses envelope encryption:
 * 1. A master key passphrase is stored (could be fetched from KMS in production)
 * 2. Data Encryption Keys (DEKs) are derived using scrypt
 * 3. Each piece of data is encrypted with AES-256-GCM
 *
 * For production with Cosmian KMS:
 * - Store the master key in KMS
 * - Fetch it at startup using KMIP API
 * - Rotate keys periodically
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly masterKeyPassphrase: string;
  private readonly algorithm = 'aes-256-gcm';

  constructor(private configService: ConfigService) {
    // In production, fetch this from Cosmian KMS
    // For now, use an environment variable or generate one
    this.masterKeyPassphrase =
      this.configService.get<string>('ENCRYPTION_MASTER_KEY') ||
      'cosmian-kms-demo-master-key-change-in-production';
  }

  async onModuleInit() {
    try {
      // Verify encryption setup
      const test = await this.encrypt('test');
      const decrypted = await this.decrypt(test.encrypted, test.keyId);

      if (decrypted !== 'test') {
        throw new Error('Encryption verification failed');
      }

      this.logger.log('Encryption service initialized successfully');
      this.logger.log('Using local AES-256-GCM encryption');
    } catch (error) {
      this.logger.error('Failed to initialize encryption:', error.message);
      throw error;
    }
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   * @param plaintext The text to encrypt
   * @returns Object containing encrypted data and metadata
   */
  async encrypt(plaintext: string): Promise<{ encrypted: string; keyId: string }> {
    try {
      // Generate a random salt for key derivation
      const salt = randomBytes(16);

      // Derive a 256-bit key from the master passphrase
      const key = (await scryptAsync(this.masterKeyPassphrase, salt, 32)) as Buffer;

      // Generate a random IV (Initialization Vector)
      const iv = randomBytes(16);

      // Create cipher
      const cipher = createCipheriv(this.algorithm, key, iv);

      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get the authentication tag
      const authTag = cipher.getAuthTag();

      // Combine salt, iv, authTag, and encrypted data
      // Format: salt(16) + iv(16) + authTag(16) + encrypted(variable)
      const combined = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]);

      return {
        encrypted: combined.toString('base64'),
        keyId: 'local-aes-256-gcm', // Identifier for this encryption method
      };
    } catch (error) {
      this.logger.error('Encryption failed:', error.message);
      throw new Error(`Failed to encrypt data: ${error.message}`);
    }
  }

  /**
   * Decrypt ciphertext encrypted with encrypt()
   * @param ciphertext The base64-encoded encrypted data
   * @param keyId The key identifier (not used in this implementation)
   * @returns The decrypted plaintext
   */
  async decrypt(ciphertext: string, keyId?: string): Promise<string> {
    try {
      // Decode from base64
      const combined = Buffer.from(ciphertext, 'base64');

      // Extract components
      const salt = combined.subarray(0, 16);
      const iv = combined.subarray(16, 32);
      const authTag = combined.subarray(32, 48);
      const encrypted = combined.subarray(48);

      // Derive the same key using the salt
      const key = (await scryptAsync(this.masterKeyPassphrase, salt, 32)) as Buffer;

      // Create decipher
      const decipher = createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed:', error.message);
      throw new Error(`Failed to decrypt data: ${error.message}`);
    }
  }

  async encryptEmail(email: string): Promise<{ encrypted: string; keyId: string }> {
    return this.encrypt(email);
  }

  async decryptEmail(encryptedEmail: string, keyId?: string): Promise<string> {
    return this.decrypt(encryptedEmail, keyId);
  }

  async encryptPhone(phone: string): Promise<{ encrypted: string; keyId: string }> {
    return this.encrypt(phone);
  }

  async decryptPhone(encryptedPhone: string, keyId?: string): Promise<string> {
    return this.decrypt(encryptedPhone, keyId);
  }

  getEncryptionInfo(): string {
    return 'AES-256-GCM with scrypt key derivation';
  }
}

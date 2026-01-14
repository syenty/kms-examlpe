import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { KmsService } from '../kms/kms.service';

const scryptAsync = promisify(scrypt);

/**
 * Encryption Service with Cosmian KMS integration
 *
 * This service supports two modes:
 * 1. KMS Mode: Use Cosmian KMS for encryption/decryption
 * 2. Local Mode: Fallback to local AES-256-GCM encryption
 *
 * KMS Mode is preferred when available for:
 * - Centralized key management
 * - Key rotation support
 * - Audit logging
 * - Access control
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly masterKeyPassphrase: string;
  private readonly algorithm = 'aes-256-gcm';
  private useKms: boolean = false;

  constructor(
    private configService: ConfigService,
    private kmsService: KmsService,
  ) {
    this.masterKeyPassphrase =
      this.configService.get<string>('ENCRYPTION_MASTER_KEY') ||
      'cosmian-kms-demo-master-key-change-in-production';
  }

  async onModuleInit() {
    try {
      // Check if KMS is available and configured
      const symmetricKeyId = this.kmsService.getSymmetricKeyId();
      if (symmetricKeyId) {
        // Try to use KMS
        try {
          const test = await this.kmsService.encryptSymmetric('test', symmetricKeyId);
          const decrypted = await this.kmsService.decryptSymmetric(test, symmetricKeyId);

          if (decrypted === 'test') {
            this.useKms = true;
            this.logger.log('✅ Encryption service initialized with Cosmian KMS');
            this.logger.log(`   Using symmetric key: ${symmetricKeyId}`);
            return;
          }
        } catch (kmsError) {
          this.logger.warn(`KMS test failed: ${kmsError.message}`);
          this.logger.warn('Falling back to local encryption');
        }
      }

      // Fallback to local encryption
      const test = await this.encryptLocal('test');
      const decrypted = await this.decryptLocal(test.encrypted);

      if (decrypted !== 'test') {
        throw new Error('Encryption verification failed');
      }

      this.logger.log('✅ Encryption service initialized with local AES-256-GCM');
      this.logger.warn('   ⚠️  KMS not configured - using local encryption');
    } catch (error) {
      this.logger.error('Failed to initialize encryption:', error.message);
      throw error;
    }
  }

  /**
   * Encrypt plaintext (uses KMS if available, otherwise local)
   * @param plaintext The text to encrypt
   * @returns Object containing encrypted data and metadata
   */
  async encrypt(plaintext: string): Promise<{ encrypted: string; keyId: string }> {
    if (this.useKms) {
      const symmetricKeyId = this.kmsService.getSymmetricKeyId();
      if (symmetricKeyId) {
        try {
          const encrypted = await this.kmsService.encryptSymmetric(plaintext, symmetricKeyId);
          return {
            encrypted,
            keyId: symmetricKeyId,
          };
        } catch (error) {
          this.logger.warn(`KMS encryption failed, falling back to local: ${error.message}`);
        }
      }
    }

    // Fallback to local encryption
    return this.encryptLocal(plaintext);
  }

  /**
   * Decrypt ciphertext (uses KMS if available, otherwise local)
   * @param ciphertext The encrypted data
   * @param keyId The key identifier
   * @returns The decrypted plaintext
   */
  async decrypt(ciphertext: string, keyId?: string): Promise<string> {
    if (this.useKms && keyId && !keyId.startsWith('local-')) {
      try {
        return await this.kmsService.decryptSymmetric(ciphertext, keyId);
      } catch (error) {
        this.logger.warn(`KMS decryption failed, falling back to local: ${error.message}`);
      }
    }

    // Fallback to local decryption
    return this.decryptLocal(ciphertext);
  }

  /**
   * Encrypt plaintext using local AES-256-GCM
   * @param plaintext The text to encrypt
   * @returns Object containing encrypted data and metadata
   */
  private async encryptLocal(plaintext: string): Promise<{ encrypted: string; keyId: string }> {
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
        keyId: 'local-aes-256-gcm',
      };
    } catch (error) {
      this.logger.error('Local encryption failed:', error.message);
      throw new Error(`Failed to encrypt data: ${error.message}`);
    }
  }

  /**
   * Decrypt ciphertext using local AES-256-GCM
   * @param ciphertext The base64-encoded encrypted data
   * @returns The decrypted plaintext
   */
  private async decryptLocal(ciphertext: string): Promise<string> {
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
      this.logger.error('Local decryption failed:', error.message);
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
    if (this.useKms) {
      return `Cosmian KMS (Symmetric Key: ${this.kmsService.getSymmetricKeyId()})`;
    }
    return 'Local AES-256-GCM with scrypt key derivation';
  }
}

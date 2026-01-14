import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KmsService } from '../kms/kms.service';

/**
 * Encryption Service with Cosmian KMS
 *
 * This service uses Cosmian KMS exclusively for encryption/decryption.
 * Benefits:
 * - Centralized key management
 * - Key rotation support
 * - Audit logging
 * - Access control
 * - KMIP standard compliance
 *
 * KMS_SYMMETRIC_KEY_ID environment variable is REQUIRED.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);

  constructor(private kmsService: KmsService) {}

  async onModuleInit() {
    const symmetricKeyId = this.kmsService.getSymmetricKeyId();

    if (!symmetricKeyId) {
      this.logger.error('❌ KMS_SYMMETRIC_KEY_ID is not configured in .env');
      this.logger.error('   Please create a key and set KMS_SYMMETRIC_KEY_ID');
      throw new Error('KMS_SYMMETRIC_KEY_ID is required but not configured');
    }

    try {
      // Verify KMS connectivity and key validity
      const test = await this.kmsService.encryptSymmetric('test', symmetricKeyId);
      const decrypted = await this.kmsService.decryptSymmetric(test, symmetricKeyId);

      if (decrypted !== 'test') {
        throw new Error('KMS encryption verification failed');
      }

      this.logger.log('✅ Encryption service initialized with Cosmian KMS');
      this.logger.log(`   Using symmetric key: ${symmetricKeyId}`);
    } catch (error) {
      this.logger.error('❌ Failed to initialize KMS:', error.message);
      this.logger.error('   Please check KMS_URL and KMS_SYMMETRIC_KEY_ID in .env');
      throw new Error(`KMS initialization failed: ${error.message}`);
    }
  }

  /**
   * Encrypt plaintext using Cosmian KMS
   * @param plaintext The text to encrypt
   * @returns Object containing encrypted data and key ID
   */
  async encrypt(plaintext: string): Promise<{ encrypted: string; keyId: string }> {
    const symmetricKeyId = this.kmsService.getSymmetricKeyId();

    if (!symmetricKeyId) {
      throw new Error('KMS_SYMMETRIC_KEY_ID is not configured');
    }

    try {
      const encrypted = await this.kmsService.encryptSymmetric(plaintext, symmetricKeyId);
      return {
        encrypted,
        keyId: symmetricKeyId,
      };
    } catch (error) {
      this.logger.error('KMS encryption failed:', error.message);
      throw new Error(`Failed to encrypt data: ${error.message}`);
    }
  }

  /**
   * Decrypt ciphertext using Cosmian KMS
   * @param ciphertext The encrypted data
   * @param keyId The key identifier used for encryption
   * @returns The decrypted plaintext
   */
  async decrypt(ciphertext: string, keyId?: string): Promise<string> {
    if (!keyId) {
      throw new Error('keyId is required for decryption');
    }

    try {
      return await this.kmsService.decryptSymmetric(ciphertext, keyId);
    } catch (error) {
      this.logger.error('KMS decryption failed:', error.message);
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
    return `Cosmian KMS (Symmetric Key: ${this.kmsService.getSymmetricKeyId()})`;
  }
}

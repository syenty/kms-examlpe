import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cosmian KMS Client Service
 *
 * This service provides integration with Cosmian KMS for:
 * - Key management (create, retrieve, delete)
 * - Data encryption/decryption using KMS-managed keys
 * - Key rotation support
 */
@Injectable()
export class KmsService implements OnModuleInit {
  private readonly logger = new Logger(KmsService.name);
  private readonly kmsUrl: string;
  private symmetricKeyId: string | null = null;
  private rsaKeyId: string | null = null;

  constructor(private configService: ConfigService) {
    this.kmsUrl = this.configService.get<string>('KMS_URL') || 'http://localhost:9998';
  }

  async onModuleInit() {
    try {
      // Verify KMS connectivity
      const version = await this.getVersion();
      this.logger.log(`Connected to Cosmian KMS version: ${version}`);

      // Load existing keys from environment or use defaults
      this.symmetricKeyId = this.configService.get<string>('KMS_SYMMETRIC_KEY_ID');
      this.rsaKeyId = this.configService.get<string>('KMS_RSA_KEY_ID');

      if (this.symmetricKeyId) {
        this.logger.log(`Using symmetric key for new data: ${this.symmetricKeyId}`);
        this.logger.log(`Note: Old data with different key IDs can still be decrypted`);
      }
      if (this.rsaKeyId) {
        this.logger.log(`Using RSA key: ${this.rsaKeyId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to connect to KMS: ${error.message}`);
      this.logger.warn('Continuing without KMS integration');
    }
  }

  /**
   * Get KMS server version
   */
  async getVersion(): Promise<string> {
    const response = await fetch(`${this.kmsUrl}/version`);
    if (!response.ok) {
      throw new Error(`KMS version check failed: ${response.statusText}`);
    }
    const version = await response.text();
    return version.replace(/"/g, '');
  }

  /**
   * Encrypt data using symmetric key in KMS
   * @param plaintext Data to encrypt
   * @param keyId Optional key ID (uses default if not provided)
   */
  async encryptSymmetric(plaintext: string, keyId?: string): Promise<string> {
    if (!keyId && !this.symmetricKeyId) {
      throw new Error('No symmetric key configured');
    }

    const targetKeyId = keyId || this.symmetricKeyId;

    // KMIP Encrypt operation
    const request = {
      tag: 'Encrypt',
      type: 'Structure',
      value: [
        {
          tag: 'RequestHeader',
          type: 'Structure',
          value: [],
        },
        {
          tag: 'BatchItem',
          type: 'Structure',
          value: [
            {
              tag: 'Operation',
              type: 'Enumeration',
              value: 'Encrypt',
            },
            {
              tag: 'RequestPayload',
              type: 'Structure',
              value: [
                {
                  tag: 'UniqueIdentifier',
                  type: 'TextString',
                  value: targetKeyId,
                },
                {
                  tag: 'Data',
                  type: 'ByteString',
                  value: Buffer.from(plaintext, 'utf8').toString('base64'),
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await fetch(`${this.kmsUrl}/kmip/2_1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`KMS encrypt failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Extract encrypted data from KMIP response
    const batchItem = result.value.find((item: any) => item.tag === 'BatchItem');
    const responsePayload = batchItem.value.find((item: any) => item.tag === 'ResponsePayload');
    const encryptedData = responsePayload.value.find((item: any) => item.tag === 'Data');

    return encryptedData.value;
  }

  /**
   * Decrypt data using symmetric key in KMS
   * @param ciphertext Encrypted data (base64)
   * @param keyId Optional key ID (uses default if not provided)
   */
  async decryptSymmetric(ciphertext: string, keyId?: string): Promise<string> {
    if (!keyId && !this.symmetricKeyId) {
      throw new Error('No symmetric key configured');
    }

    const targetKeyId = keyId || this.symmetricKeyId;

    // KMIP Decrypt operation
    const request = {
      tag: 'Decrypt',
      type: 'Structure',
      value: [
        {
          tag: 'RequestHeader',
          type: 'Structure',
          value: [],
        },
        {
          tag: 'BatchItem',
          type: 'Structure',
          value: [
            {
              tag: 'Operation',
              type: 'Enumeration',
              value: 'Decrypt',
            },
            {
              tag: 'RequestPayload',
              type: 'Structure',
              value: [
                {
                  tag: 'UniqueIdentifier',
                  type: 'TextString',
                  value: targetKeyId,
                },
                {
                  tag: 'Data',
                  type: 'ByteString',
                  value: ciphertext,
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await fetch(`${this.kmsUrl}/kmip/2_1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`KMS decrypt failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Extract decrypted data from KMIP response
    const batchItem = result.value.find((item: any) => item.tag === 'BatchItem');
    const responsePayload = batchItem.value.find((item: any) => item.tag === 'ResponsePayload');
    const decryptedData = responsePayload.value.find((item: any) => item.tag === 'Data');

    return Buffer.from(decryptedData.value, 'base64').toString('utf8');
  }

  /**
   * Set the symmetric key ID to use
   */
  setSymmetricKeyId(keyId: string) {
    this.symmetricKeyId = keyId;
    this.logger.log(`Symmetric key set to: ${keyId}`);
  }

  /**
   * Set the RSA key ID to use
   */
  setRsaKeyId(keyId: string) {
    this.rsaKeyId = keyId;
    this.logger.log(`RSA key set to: ${keyId}`);
  }

  /**
   * Get current symmetric key ID
   */
  getSymmetricKeyId(): string | null {
    return this.symmetricKeyId;
  }

  /**
   * Get current RSA key ID
   */
  getRsaKeyId(): string | null {
    return this.rsaKeyId;
  }
}

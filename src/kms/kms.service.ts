import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Encryption result with IV and Auth Tag
 */
export interface EncryptResult {
  encryptedData: string;
  iv: string;
  authTag: string;
}

/**
 * Cosmian KMS Client Service
 */
@Injectable()
export class KmsService implements OnModuleInit {
  private readonly logger = new Logger(KmsService.name);
  private readonly kmsUrl: string;
  private readonly symmetricKeyId: string | null;

  constructor(private configService: ConfigService) {
    this.kmsUrl = this.configService.get<string>('KMS_URL') || 'http://localhost:9998';
    this.symmetricKeyId = this.configService.get<string>('KMS_SYMMETRIC_KEY_ID') || null;
  }

  async onModuleInit() {
    this.logger.log('Initializing KMS Service...');
    this.logger.log(`KMS URL: ${this.kmsUrl}`);

    if (!this.symmetricKeyId) {
      this.logger.warn('⚠️  KMS_SYMMETRIC_KEY_ID is not configured!');
      this.logger.warn('   Set it in .env file to enable encryption');
    } else {
      this.logger.log(`Symmetric Key ID: ${this.symmetricKeyId}`);
    }

    try {
      const version = await this.getKmsVersion();
      this.logger.log(`KMS Version: ${version}`);
      this.logger.log('✅ KMS Service initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to KMS:', error.message);
      throw new Error('KMS connection failed');
    }
  }

  getSymmetricKeyId(): string | null {
    return this.symmetricKeyId;
  }

  /**
   * Get KMS version
   */
  async getKmsVersion(): Promise<string> {
    const response = await fetch(`${this.kmsUrl}/version`);
    if (!response.ok) {
      throw new Error(`Failed to get KMS version: ${response.statusText}`);
    }
    const version = await response.text();
    return version.replace(/"/g, '');
  }

  /**
   * Encrypt data using symmetric key in KMS
   * @param plaintext Data to encrypt
   * @param keyId Optional key ID (uses default if not provided)
   * @returns Object containing encrypted data, IV, and authentication tag (all in hex)
   */
  async encrypt(plaintext: string, keyId?: string): Promise<EncryptResult> {
    if (!keyId && !this.symmetricKeyId) {
      throw new Error('No symmetric key configured');
    }

    const targetKeyId = keyId || this.symmetricKeyId;
    this.logger.debug(`Encrypting with key: ${targetKeyId}`);

    // Convert plaintext to hex
    const plaintextHex = Buffer.from(plaintext, 'utf8').toString('hex');

    // KMIP Encrypt request
    const request = {
      tag: 'Encrypt',
      value: [
        {
          tag: 'UniqueIdentifier',
          type: 'TextString',
          value: targetKeyId,
        },
        {
          tag: 'CryptographicParameters',
          value: [
            {
              tag: 'BlockCipherMode',
              type: 'Enumeration',
              value: 'GCM',
            },
            {
              tag: 'CryptographicAlgorithm',
              type: 'Enumeration',
              value: 'AES',
            },
          ],
        },
        {
          tag: 'Data',
          type: 'ByteString',
          value: plaintextHex,
        },
      ],
    };

    const response = await fetch(`${this.kmsUrl}/kmip/2_1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`KMS encrypt failed: ${response.status} ${response.statusText}`);
      this.logger.error(`Response body: ${errorBody}`);
      throw new Error(`KMS encrypt failed: ${response.statusText} - ${errorBody}`);
    }

    const result = await response.json();
    this.logger.debug(`Response: ${JSON.stringify(result, null, 2)}`);

    // Extract encrypted data, IV, and Auth Tag from KMIP response
    const encryptedData = result.value.find((item: any) => item.tag === 'Data');
    const ivCounterNonce = result.value.find((item: any) => item.tag === 'IVCounterNonce');
    const authTag = result.value.find((item: any) => item.tag === 'AuthenticatedEncryptionTag');

    if (!encryptedData || !ivCounterNonce || !authTag) {
      throw new Error('Missing encryption components in KMS response');
    }

    return {
      encryptedData: encryptedData.value,
      iv: ivCounterNonce.value,
      authTag: authTag.value,
    };
  }

  /**
   * Decrypt data using symmetric key in KMS
   * @param ciphertext Encrypted data (hex)
   * @param iv Initialization Vector (hex)
   * @param authTag Authentication Tag (hex)
   * @param keyId Optional key ID (uses default if not provided)
   */
  async decrypt(
    ciphertext: string,
    iv: string,
    authTag: string,
    keyId?: string,
  ): Promise<string> {
    if (!keyId && !this.symmetricKeyId) {
      throw new Error('No symmetric key configured');
    }

    const targetKeyId = keyId || this.symmetricKeyId;

    // KMIP Decrypt request
    const request = {
      tag: 'Decrypt',
      value: [
        {
          tag: 'UniqueIdentifier',
          type: 'TextString',
          value: targetKeyId,
        },
        {
          tag: 'CryptographicParameters',
          value: [
            {
              tag: 'BlockCipherMode',
              type: 'Enumeration',
              value: 'GCM',
            },
            {
              tag: 'CryptographicAlgorithm',
              type: 'Enumeration',
              value: 'AES',
            },
          ],
        },
        {
          tag: 'Data',
          type: 'ByteString',
          value: ciphertext,
        },
        {
          tag: 'IVCounterNonce',
          type: 'ByteString',
          value: iv,
        },
        {
          tag: 'AuthenticatedEncryptionTag',
          type: 'ByteString',
          value: authTag,
        },
      ],
    };

    const response = await fetch(`${this.kmsUrl}/kmip/2_1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`KMS decrypt failed: ${response.status} ${response.statusText}`);
      this.logger.error(`Response body: ${errorBody}`);
      throw new Error(`KMS decrypt failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Extract decrypted data from KMIP response
    const decryptedData = result.value.find((item: any) => item.tag === 'Data');

    if (!decryptedData) {
      throw new Error('Missing decrypted data in KMS response');
    }

    // Convert hex to string
    const decryptedHex = decryptedData.value;
    const decryptedBuffer = Buffer.from(decryptedHex, 'hex');
    return decryptedBuffer.toString('utf8');
  }
}

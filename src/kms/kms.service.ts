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
    // Environment variables are validated at app startup, so these values are guaranteed to exist
    this.kmsUrl = this.configService.get<string>('KMS_URL')!;
  }

  async onModuleInit() {
    try {
      // Verify KMS connectivity
      const version = await this.getVersion();
      this.logger.log(`Connected to Cosmian KMS version: ${version}`);

      // Load existing keys from environment (validated at app startup)
      this.symmetricKeyId = this.configService.get<string>('KMS_SYMMETRIC_KEY_ID')!;
      this.rsaKeyId = this.configService.get<string>('KMS_RSA_KEY_ID') || null;

      this.logger.log(`Using symmetric key for new data: ${this.symmetricKeyId}`);
      this.logger.log(`Note: Old data with different key IDs can still be decrypted`);

      if (this.rsaKeyId) {
        this.logger.log(`Using RSA key: ${this.rsaKeyId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to connect to KMS: ${error.message}`);
      throw error;
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
    this.logger.debug(`Encrypting with key: ${targetKeyId}`);

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
                  tag: 'CryptographicParameters',
                  type: 'Structure',
                  value: [
                    {
                      tag: 'BlockCipherMode',
                      type: 'Enumeration',
                      value: 'GCM',
                    },
                  ],
                },
                {
                  tag: 'Data',
                  type: 'ByteString',
                  value: Buffer.from(plaintext, 'utf8').toString('hex'),
                },
              ],
            },
          ],
        },
      ],
    };

    this.logger.debug(`Sending KMIP request to ${this.kmsUrl}/kmip/2_1`);
    this.logger.debug(`Request: ${JSON.stringify(request, null, 2)}`);

    const response = await fetch(`${this.kmsUrl}/kmip/2_1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    this.logger.debug(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`KMS encrypt failed: ${response.status} ${response.statusText}`);
      this.logger.error(`Response body: ${errorBody}`);
      throw new Error(`KMS encrypt failed: ${response.statusText} - ${errorBody}`);
    }

    const result = await response.json();
    this.logger.debug(`Response: ${JSON.stringify(result, null, 2)}`);

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
                  tag: 'CryptographicParameters',
                  type: 'Structure',
                  value: [
                    {
                      tag: 'BlockCipherMode',
                      type: 'Enumeration',
                      value: 'GCM',
                    },
                  ],
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

    return Buffer.from(decryptedData.value, 'hex').toString('utf8');
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

  /**
   * Create a new symmetric key in KMS
   *
   * @param keySize Key size in bits (128, 192, or 256)
   * @param tag Optional tag for the key
   * @returns The ID of the newly created key
   */
  async createSymmetricKey(keySize: number = 256, tag?: string): Promise<string> {
    const attributes: any[] = [
      {
        tag: 'CryptographicAlgorithm',
        type: 'Enumeration',
        value: 'AES',
      },
      {
        tag: 'CryptographicLength',
        type: 'Integer',
        value: keySize,
      },
      {
        tag: 'CryptographicUsageMask',
        type: 'Integer',
        value: 2108, // Encrypt | Decrypt
      },
      {
        tag: 'KeyFormatType',
        type: 'Enumeration',
        value: 'TransparentSymmetricKey',
      },
    ];

    // Add tag if provided
    if (tag) {
      attributes.push({
        tag: 'VendorAttributes',
        type: 'Structure',
        value: [
          {
            tag: 'VendorAttributes',
            type: 'Structure',
            value: [
              {
                tag: 'VendorIdentification',
                type: 'TextString',
                value: 'cosmian',
              },
              {
                tag: 'AttributeName',
                type: 'TextString',
                value: 'tag',
              },
              {
                tag: 'AttributeValue',
                type: 'TextString',
                value: tag,
              },
            ],
          },
        ],
      });
    }

    // KMIP Create operation
    const request = {
      tag: 'Create',
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
              value: 'Create',
            },
            {
              tag: 'RequestPayload',
              type: 'Structure',
              value: [
                {
                  tag: 'ObjectType',
                  type: 'Enumeration',
                  value: 'SymmetricKey',
                },
                {
                  tag: 'Attributes',
                  type: 'Structure',
                  value: attributes,
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
      throw new Error(`KMS create key failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Extract new key ID from KMIP response
    const batchItem = result.value.find((item: any) => item.tag === 'BatchItem');
    const responsePayload = batchItem.value.find((item: any) => item.tag === 'ResponsePayload');
    const uniqueIdentifier = responsePayload.value.find((item: any) => item.tag === 'UniqueIdentifier');

    const newKeyId = uniqueIdentifier.value;

    this.logger.log(`✅ Symmetric key created`);
    this.logger.log(`   Key ID: ${newKeyId}`);
    this.logger.log(`   Algorithm: AES-${keySize}`);
    if (tag) {
      this.logger.log(`   Tag: ${tag}`);
    }

    return newKeyId;
  }

  /**
   * Delete (Destroy) a key from KMS
   * WARNING: This is irreversible!
   *
   * @param keyId The ID of the key to delete
   */
  async deleteKey(keyId: string): Promise<void> {
    const request = {
      tag: 'Destroy',
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
              value: 'Destroy',
            },
            {
              tag: 'RequestPayload',
              type: 'Structure',
              value: [
                {
                  tag: 'UniqueIdentifier',
                  type: 'TextString',
                  value: keyId,
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
      throw new Error(`KMS delete key failed: ${response.statusText}`);
    }

    this.logger.log(`✅ Key deleted (destroyed): ${keyId}`);
    this.logger.warn(`   This operation is irreversible!`);
  }

  /**
   * Re-key operation: Generate a replacement key for an existing symmetric key
   * This is the native KMS way to rotate keys
   *
   * @param existingKeyId The ID of the existing symmetric key to replace
   * @returns The ID of the new replacement key
   */
  async reKeySymmetric(existingKeyId?: string): Promise<string> {
    const targetKeyId = existingKeyId || this.symmetricKeyId;

    if (!targetKeyId) {
      throw new Error('No symmetric key ID provided for re-key operation');
    }

    // KMIP ReKey operation
    const request = {
      tag: 'ReKey',
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
              value: 'ReKey',
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
      throw new Error(`KMS re-key failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Extract new key ID from KMIP response
    const batchItem = result.value.find((item: any) => item.tag === 'BatchItem');
    const responsePayload = batchItem.value.find((item: any) => item.tag === 'ResponsePayload');
    const uniqueIdentifier = responsePayload.value.find((item: any) => item.tag === 'UniqueIdentifier');

    const newKeyId = uniqueIdentifier.value;

    this.logger.log(`✅ Re-key successful`);
    this.logger.log(`   Old key: ${targetKeyId}`);
    this.logger.log(`   New key: ${newKeyId}`);
    this.logger.log(`   Note: KMS automatically created a link between old and new keys`);

    return newKeyId;
  }

  /**
   * Hash data using KMS
   * @param data Data to hash
   * @param algorithm Hashing algorithm (default: SHA256)
   * @returns Hash value in hex format
   */
  async hash(data: string, algorithm: string = 'SHA256'): Promise<string> {
    const dataHex = Buffer.from(data, 'utf8').toString('hex');

    const request = {
      tag: 'Hash',
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
              value: 'Hash',
            },
            {
              tag: 'RequestPayload',
              type: 'Structure',
              value: [
                {
                  tag: 'CryptographicParameters',
                  type: 'Structure',
                  value: [
                    {
                      tag: 'HashingAlgorithm',
                      type: 'Enumeration',
                      value: algorithm,
                    },
                  ],
                },
                {
                  tag: 'Data',
                  type: 'ByteString',
                  value: dataHex,
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
      throw new Error(`KMS hash failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Extract hash data from KMIP response
    const batchItem = result.value.find((item: any) => item.tag === 'BatchItem');
    const responsePayload = batchItem.value.find((item: any) => item.tag === 'ResponsePayload');
    const hashData = responsePayload.value.find((item: any) => item.tag === 'Data');

    return hashData.value;
  }

  /**
   * Revoke a key (prevent new encryptions, allow existing decryptions)
   *
   * @param keyId The ID of the key to revoke
   * @param reason Revocation reason
   */
  async revokeKey(keyId: string, reason: string = 'Unspecified'): Promise<void> {
    const request = {
      tag: 'Revoke',
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
              value: 'Revoke',
            },
            {
              tag: 'RequestPayload',
              type: 'Structure',
              value: [
                {
                  tag: 'UniqueIdentifier',
                  type: 'TextString',
                  value: keyId,
                },
                {
                  tag: 'RevocationReason',
                  type: 'Structure',
                  value: [
                    {
                      tag: 'RevocationReasonCode',
                      type: 'Enumeration',
                      value: reason,
                    },
                  ],
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
      throw new Error(`KMS revoke failed: ${response.statusText}`);
    }

    this.logger.log(`✅ Key revoked: ${keyId}`);
    this.logger.log(`   Reason: ${reason}`);
  }
}

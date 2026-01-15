import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SymmetricKey } from './entities/symmetric-key.entity';

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
  private symmetricKeyId: string | null = null;

  constructor(
    private configService: ConfigService,
    @InjectRepository(SymmetricKey)
    private symmetricKeyRepository: Repository<SymmetricKey>,
  ) {
    this.kmsUrl = this.configService.get<string>('KMS_URL') || 'http://localhost:9998';
  }

  async onModuleInit() {
    this.logger.log('Initializing KMS Service...');
    this.logger.log(`KMS URL: ${this.kmsUrl}`);

    try {
      const version = await this.getKmsVersion();
      this.logger.log(`KMS Version: ${version}`);

      // Load or create active symmetric key
      await this.loadOrCreateActiveKey();

      this.logger.log('✅ KMS Service initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize KMS:', error.message);
      throw new Error('KMS initialization failed');
    }
  }

  /**
   * Load active symmetric key from DB or create a new one
   */
  private async loadOrCreateActiveKey(): Promise<void> {
    this.logger.log('Loading active symmetric key...');

    const activeKey = await this.getActiveSymmetricKey();

    if (activeKey) {
      this.symmetricKeyId = activeKey.kms_key_id;
      this.logger.log(`✅ Active key found: ${this.symmetricKeyId}`);
      if (activeKey.tag) {
        this.logger.log(`   Tag: ${activeKey.tag}`);
      }
      this.logger.log(`   Name: ${activeKey.key_name}`);
      this.logger.log(`   Created: ${activeKey.created_at}`);
    } else {
      this.logger.warn('⚠️  No active key found. Creating new key...');

      // Create new key in KMS
      const kmsKeyId = await this.createSymmetricKey('default', 256);

      // Save to database
      const newKey = this.symmetricKeyRepository.create({
        kms_key_id: kmsKeyId,
        tag: 'default',
        key_name: 'default',
        description: 'Auto-generated default encryption key',
        active: true,
      });

      await this.symmetricKeyRepository.save(newKey);

      this.symmetricKeyId = kmsKeyId;
      this.logger.log(`✅ New key created and saved: ${this.symmetricKeyId}`);
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
      value: [
        {
          tag: 'CryptographicParameters',
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
    const hashData = result.value.find((item: any) => item.tag === 'Data');

    if (!hashData) {
      throw new Error('Missing hash data in KMS response');
    }

    return hashData.value;
  }

  /**
   * Create a new symmetric key in KMS
   * @param keyTag Optional tag for the key
   * @param keyLength Key length in bits (128, 192, or 256)
   * @returns The unique identifier of the created key
   */
  async createSymmetricKey(keyTag?: string, keyLength: number = 256): Promise<string> {
    if (![128, 192, 256].includes(keyLength)) {
      throw new Error('Key length must be 128, 192, or 256 bits');
    }

    this.logger.log(`Creating symmetric key (${keyLength} bits)${keyTag ? ` with tag: ${keyTag}` : ''}`);

    // Get current ISO 8601 timestamp for activation
    const currentTime = new Date().toISOString();

    // Build attributes array
    const attributes: any[] = [
      {
        tag: 'ActivationDate',
        type: 'DateTime',
        value: currentTime,
      },
      {
        tag: 'CryptographicAlgorithm',
        type: 'Enumeration',
        value: 'AES',
      },
      {
        tag: 'CryptographicLength',
        type: 'Integer',
        value: keyLength,
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
      {
        tag: 'ObjectType',
        type: 'Enumeration',
        value: 'SymmetricKey',
      },
    ];

    // Add tag if provided
    if (keyTag) {
      attributes.push({
        tag: 'Attribute',
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
            value: JSON.stringify([keyTag]),
          },
        ],
      });
    }

    const request = {
      tag: 'Create',
      value: [
        {
          tag: 'ObjectType',
          type: 'Enumeration',
          value: 'SymmetricKey',
        },
        {
          tag: 'Attributes',
          value: attributes,
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
      this.logger.error(`KMS create key failed: ${response.status} ${response.statusText}`);
      this.logger.error(`Response body: ${errorBody}`);
      throw new Error(`KMS create key failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Extract key ID from KMIP response
    const uniqueId = result.value.find((item: any) => item.tag === 'UniqueIdentifier');

    if (!uniqueId) {
      throw new Error('Missing key ID in KMS response');
    }

    this.logger.log(`✅ Symmetric key created successfully!`);
    this.logger.log(`   Key ID: ${uniqueId.value}`);
    if (keyTag) {
      this.logger.log(`   Tag: ${keyTag}`);
    }
    this.logger.log(`   Length: ${keyLength} bits`);
    this.logger.log(`   Algorithm: AES-${keyLength}-GCM`);

    return uniqueId.value;
  }

  /**
   * Get the most recent active symmetric key
   * @returns The most recent active symmetric key or null if not found
   */
  async getActiveSymmetricKey(): Promise<SymmetricKey | null> {
    const key = await this.symmetricKeyRepository.findOne({
      where: {
        active: true,
        deactivated_at: IsNull(),
        revoked_at: IsNull(),
      },
      order: { created_at: 'DESC' },
    });

    return key;
  }

}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface EncryptResponse {
  data: string;
  key_id: string;
}

interface DecryptResponse {
  data: string;
}

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly kmsClient: AxiosInstance;
  private readonly kmsUrl: string;
  private symmetricKeyId: string;

  constructor(private configService: ConfigService) {
    this.kmsUrl = this.configService.get<string>('kms.url');
    this.kmsClient = axios.create({
      baseURL: this.kmsUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async onModuleInit() {
    try {
      // Initialize or retrieve symmetric key for encryption
      await this.initializeSymmetricKey();
      this.logger.log('KMS connection established successfully');
    } catch (error) {
      this.logger.error('Failed to connect to KMS:', error.message);
      throw error;
    }
  }

  private async initializeSymmetricKey(): Promise<void> {
    try {
      // Create a symmetric key for AES encryption
      const response = await this.kmsClient.post('/keys/create', {
        algorithm: 'aes',
        key_length: 256,
        tags: ['user-data-encryption'],
      });

      this.symmetricKeyId = response.data.unique_identifier;
      this.logger.log(`Symmetric key created: ${this.symmetricKeyId}`);
    } catch (error) {
      // If key creation fails, try to retrieve existing key
      this.logger.warn('Key creation failed, attempting to retrieve existing key');
      try {
        const locateResponse = await this.kmsClient.post('/keys/locate', {
          tags: ['user-data-encryption'],
        });

        if (locateResponse.data.unique_identifiers?.length > 0) {
          this.symmetricKeyId = locateResponse.data.unique_identifiers[0];
          this.logger.log(`Using existing key: ${this.symmetricKeyId}`);
        } else {
          throw new Error('No symmetric key available');
        }
      } catch (locateError) {
        this.logger.error('Failed to locate existing key:', locateError.message);
        throw locateError;
      }
    }
  }

  async encrypt(plaintext: string): Promise<{ encrypted: string; keyId: string }> {
    try {
      // Convert plaintext to base64
      const plaintextBase64 = Buffer.from(plaintext, 'utf-8').toString('base64');

      const response = await this.kmsClient.post<EncryptResponse>('/encrypt', {
        unique_identifier: this.symmetricKeyId,
        data: plaintextBase64,
      });

      return {
        encrypted: response.data.data,
        keyId: response.data.key_id || this.symmetricKeyId,
      };
    } catch (error) {
      this.logger.error('Encryption failed:', error.message);
      throw new Error(`Failed to encrypt data: ${error.message}`);
    }
  }

  async decrypt(ciphertext: string, keyId?: string): Promise<string> {
    try {
      const response = await this.kmsClient.post<DecryptResponse>('/decrypt', {
        unique_identifier: keyId || this.symmetricKeyId,
        data: ciphertext,
      });

      // Decode from base64
      return Buffer.from(response.data.data, 'base64').toString('utf-8');
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

  getSymmetricKeyId(): string {
    return this.symmetricKeyId;
  }
}

import { Controller, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { KmsService } from './kms.service';
import { CreateSymmetricKeyDto } from './dto/create-key.dto';
import { ReKeyDto } from './dto/rekey.dto';
import { RevokeKeyDto } from './dto/revoke-key.dto';

/**
 * KMS Controller
 *
 * Provides REST API endpoints for KMS key management:
 * - Create symmetric keys
 * - Rotate keys (re-key)
 * - Revoke keys
 * - Delete keys
 *
 * ⚠️ In production, these endpoints should be:
 * - Protected with authentication
 * - Logged for audit purposes
 * - Rate limited
 */
@Controller('kms')
export class KmsController {
  constructor(private readonly kmsService: KmsService) {}

  /**
   * Create a new symmetric key
   *
   * POST /admin/kms/keys
   *
   * Body:
   * {
   *   "tag": "user-data-encryption",
   *   "keySize": 256
   * }
   *
   * Response:
   * {
   *   "keyId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
   *   "algorithm": "AES-256",
   *   "tag": "user-data-encryption"
   * }
   */
  @Post('keys')
  @HttpCode(HttpStatus.CREATED)
  async createKey(@Body() createKeyDto: CreateSymmetricKeyDto) {
    const keyId = await this.kmsService.createSymmetricKey(
      createKeyDto.keySize,
      createKeyDto.tag,
    );

    return {
      keyId,
      algorithm: `AES-${createKeyDto.keySize || 256}`,
      tag: createKeyDto.tag || null,
      message: 'Symmetric key created successfully',
    };
  }

  /**
   * Rotate a key using native KMS Re-key operation
   *
   * POST /admin/kms/keys/rotate
   *
   * Body:
   * {
   *   "keyId": "old-key-id"  // Optional, uses current key if not provided
   * }
   *
   * Response:
   * {
   *   "oldKeyId": "old-key-id",
   *   "newKeyId": "new-key-id",
   *   "message": "Key rotated successfully. KMS created a link between old and new keys."
   * }
   */
  @Post('keys/rotate')
  @HttpCode(HttpStatus.OK)
  async rotateKey(@Body() reKeyDto: ReKeyDto) {
    const oldKeyId = reKeyDto.keyId || this.kmsService.getSymmetricKeyId();

    if (!oldKeyId) {
      return {
        error: 'No key ID provided and no default key configured',
        message: 'Please provide a keyId or configure KMS_SYMMETRIC_KEY_ID',
      };
    }

    const newKeyId = await this.kmsService.reKeySymmetric(oldKeyId);

    return {
      oldKeyId,
      newKeyId,
      message: 'Key rotated successfully. KMS created a link between old and new keys.',
      nextSteps: [
        `Update .env: KMS_SYMMETRIC_KEY_ID=${newKeyId}`,
        'Run data migration script: npm run rotate-keys:native',
        'Restart the application',
        `Optionally revoke old key: POST /admin/kms/keys/${oldKeyId}/revoke`,
      ],
    };
  }

  /**
   * Revoke a key
   *
   * POST /admin/kms/keys/:keyId/revoke
   *
   * Body:
   * {
   *   "reason": "KeyCompromise"  // Optional
   * }
   *
   * Response:
   * {
   *   "keyId": "key-id",
   *   "status": "revoked",
   *   "message": "Key revoked successfully. Can still decrypt, but cannot encrypt."
   * }
   */
  @Post('keys/:keyId/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeKey(
    @Param('keyId') keyId: string,
    @Body() revokeKeyDto: RevokeKeyDto,
  ) {
    await this.kmsService.revokeKey(keyId, revokeKeyDto.reason);

    return {
      keyId,
      status: 'revoked',
      reason: revokeKeyDto.reason || 'Unspecified',
      message: 'Key revoked successfully. Can still decrypt, but cannot encrypt.',
      note: 'Keep this key for at least 1-3 months before deletion for recovery purposes.',
    };
  }

  /**
   * Delete (Destroy) a key permanently
   *
   * DELETE /admin/kms/keys/:keyId
   *
   * ⚠️ WARNING: This operation is IRREVERSIBLE!
   *
   * Response:
   * {
   *   "keyId": "key-id",
   *   "status": "deleted",
   *   "message": "Key permanently deleted. This operation cannot be undone."
   * }
   */
  @Delete('keys/:keyId')
  @HttpCode(HttpStatus.OK)
  async deleteKey(@Param('keyId') keyId: string) {
    await this.kmsService.deleteKey(keyId);

    return {
      keyId,
      status: 'deleted',
      message: 'Key permanently deleted. This operation cannot be undone.',
      warning: 'Data encrypted with this key can no longer be decrypted!',
    };
  }

  /**
   * Get current configured keys
   *
   * GET /admin/kms/keys/current
   *
   * Response:
   * {
   *   "symmetricKeyId": "current-symmetric-key-id",
   *   "rsaKeyId": "current-rsa-key-id"
   * }
   */
  @Post('keys/current')
  @HttpCode(HttpStatus.OK)
  async getCurrentKeys() {
    return {
      symmetricKeyId: this.kmsService.getSymmetricKeyId(),
      rsaKeyId: this.kmsService.getRsaKeyId(),
      message: 'These are the keys currently configured in .env',
    };
  }
}

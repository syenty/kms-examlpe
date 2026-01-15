import { Controller, Post, Body } from '@nestjs/common';
import { KmsService } from './kms.service';
import { KeyRotateDto } from './dto/key-rotate.dto';

@Controller('kms')
export class KmsController {
  constructor(private readonly kmsService: KmsService) {}

  @Post('rotate')
  async rotateKey(@Body() dto: KeyRotateDto) {
    try {
      const newKmsKeyId = await this.kmsService.keyRotate(dto.keyId);
      return {
        success: true,
        message: 'Key rotation completed. Please restart the server to use the new key.',
        newKmsKeyId,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

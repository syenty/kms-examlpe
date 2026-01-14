import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import { KmsModule } from '../kms/kms.module';

@Module({
  imports: [ConfigModule, KmsModule],
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}

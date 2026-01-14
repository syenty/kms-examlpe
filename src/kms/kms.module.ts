import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KmsService } from './kms.service';
import { KmsController } from './kms.controller';

@Module({
  imports: [ConfigModule],
  controllers: [KmsController],
  providers: [KmsService],
  exports: [KmsService],
})
export class KmsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KmsService } from './kms.service';
import { KmsController } from './kms.controller';
import { SymmetricKey } from './entities/symmetric-key.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([SymmetricKey]),
  ],
  controllers: [KmsController],
  providers: [KmsService],
  exports: [KmsService],
})
export class KmsModule {}

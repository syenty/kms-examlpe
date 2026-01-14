import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { EncryptionModule } from './encryption/encryption.module';
import { KmsModule } from './kms/kms.module';
import { getDatabaseConfig } from './config/database.config';
import kmsConfig from './config/kms.config';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [kmsConfig],
      envFilePath: ['.env'],
      ignoreEnvFile: false,
      expandVariables: true,
      validate,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    KmsModule,
    EncryptionModule,
    UsersModule,
  ],
})
export class AppModule {}

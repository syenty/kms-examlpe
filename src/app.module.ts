import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { EncryptionModule } from './encryption/encryption.module';
import { getDatabaseConfig } from './config/database.config';
import kmsConfig from './config/kms.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [kmsConfig],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    EncryptionModule,
    UsersModule,
  ],
})
export class AppModule {}

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const nodeEnv = configService.get<string>('NODE_ENV', 'local');

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', 'postgres'),
    database: configService.get<string>('DB_DATABASE', 'userdb'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],

    // synchronize: production에서는 false, local/development에서는 true
    synchronize: nodeEnv !== 'production',

    // logging: production에서만 비활성화
    logging: nodeEnv !== 'production',
  };
};

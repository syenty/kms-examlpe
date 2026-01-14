import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { KmsModule } from '../kms/kms.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), KmsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}

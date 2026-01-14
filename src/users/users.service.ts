import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { EncryptionService } from '../encryption/encryption.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private encryptionService: EncryptionService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    try {
      // Encrypt sensitive data
      const { encrypted: encryptedEmail, keyId: emailKeyId } =
        await this.encryptionService.encryptEmail(createUserDto.email);
      const { encrypted: encryptedPhone, keyId: phoneKeyId } =
        await this.encryptionService.encryptPhone(createUserDto.phone);

      const user = this.usersRepository.create({
        name: createUserDto.name,
        encryptedEmail,
        encryptedPhone,
        emailKeyId,
        phoneKeyId,
      });

      const savedUser = await this.usersRepository.save(user);
      return this.toResponseDto(savedUser);
    } catch (error) {
      this.logger.error('Failed to create user:', error.message);
      throw error;
    }
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersRepository.find();
    return Promise.all(users.map((user) => this.toResponseDto(user)));
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.toResponseDto(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    try {
      // Update name if provided
      if (updateUserDto.name) {
        user.name = updateUserDto.name;
      }

      // Encrypt and update email if provided
      if (updateUserDto.email) {
        const { encrypted, keyId } = await this.encryptionService.encryptEmail(
          updateUserDto.email,
        );
        user.encryptedEmail = encrypted;
        user.emailKeyId = keyId;
      }

      // Encrypt and update phone if provided
      if (updateUserDto.phone) {
        const { encrypted, keyId } = await this.encryptionService.encryptPhone(
          updateUserDto.phone,
        );
        user.encryptedPhone = encrypted;
        user.phoneKeyId = keyId;
      }

      const savedUser = await this.usersRepository.save(user);
      return this.toResponseDto(savedUser);
    } catch (error) {
      this.logger.error('Failed to update user:', error.message);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  private async toResponseDto(user: User): Promise<UserResponseDto> {
    try {
      const email = await this.encryptionService.decryptEmail(
        user.encryptedEmail,
        user.emailKeyId,
      );
      const phone = await this.encryptionService.decryptPhone(
        user.encryptedPhone,
        user.phoneKeyId,
      );

      return new UserResponseDto({
        id: user.id,
        name: user.name,
        email,
        phone,
        emailKeyId: user.emailKeyId,
        phoneKeyId: user.phoneKeyId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      this.logger.error('Failed to decrypt user data:', error.message);
      throw error;
    }
  }
}

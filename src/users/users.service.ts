import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { KmsService } from '../kms/kms.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly BCRYPT_SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private kmsService: KmsService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    try {
      // 1. PII 데이터 준비 (name, phone, email, birth_date)
      const piiData = JSON.stringify({
        name: createUserDto.name,
        phone: createUserDto.phone,
        email: createUserDto.email,
        birth_date: createUserDto.birth_date,
      });

      // 2. PII 데이터 암호화
      const keyId = this.kmsService.getSymmetricKeyId()!;
      const piiEncrypted = await this.kmsService.encrypt(piiData, keyId);

      // 3. 해시 생성 (검색용) - SHA256 사용
      const crypto = require('crypto');
      const nameHash = crypto.createHash('sha256').update(createUserDto.name).digest('hex');
      const phoneHash = crypto.createHash('sha256').update(createUserDto.phone).digest('hex');
      const emailHash = crypto.createHash('sha256').update(createUserDto.email).digest('hex');
      const birthDateHash = crypto.createHash('sha256').update(createUserDto.birth_date).digest('hex');

      // 4. address_detail 암호화 (선택사항)
      let addressDetailEncrypted: { encryptedData: string; iv: string; authTag: string } | null =
        null;
      if (createUserDto.address_detail) {
        addressDetailEncrypted = await this.kmsService.encrypt(
          createUserDto.address_detail,
          keyId,
        );
      }

      // 5. 비밀번호 해싱 (bcrypt)
      const passwordHash = await bcrypt.hash(
        createUserDto.password,
        this.BCRYPT_SALT_ROUNDS,
      );

      // 6. User 엔티티 생성
      const user = this.usersRepository.create({
        encrypted_pii: piiEncrypted.encryptedData,
        pii_iv: piiEncrypted.iv,
        pii_auth_tag: piiEncrypted.authTag,
        name_hash: nameHash,
        phone_hash: phoneHash,
        email_hash: emailHash,
        birth_date_hash: birthDateHash,
        address: createUserDto.address,
        encrypted_address_detail: addressDetailEncrypted
          ? addressDetailEncrypted.encryptedData
          : null,
        address_detail_iv: addressDetailEncrypted ? addressDetailEncrypted.iv : null,
        address_detail_auth_tag: addressDetailEncrypted ? addressDetailEncrypted.authTag : null,
        password_hash: passwordHash,
      } as Partial<User>);

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
      // PII 데이터 업데이트가 있으면 재암호화
      if (
        updateUserDto.name ||
        updateUserDto.phone ||
        updateUserDto.email ||
        updateUserDto.birth_date
      ) {
        // 기존 PII 복호화
        const decryptedPii = await this.kmsService.decrypt(
          user.encrypted_pii,
          user.pii_iv,
          user.pii_auth_tag,
        );
        const piiData = JSON.parse(decryptedPii);

        // 업데이트할 데이터 병합
        const crypto = require('crypto');
        if (updateUserDto.name) {
          piiData.name = updateUserDto.name;
          user.name_hash = crypto.createHash('sha256').update(updateUserDto.name).digest('hex');
        }
        if (updateUserDto.phone) {
          piiData.phone = updateUserDto.phone;
          user.phone_hash = crypto.createHash('sha256').update(updateUserDto.phone).digest('hex');
        }
        if (updateUserDto.email) {
          piiData.email = updateUserDto.email;
          user.email_hash = crypto.createHash('sha256').update(updateUserDto.email).digest('hex');
        }
        if (updateUserDto.birth_date) {
          piiData.birth_date = updateUserDto.birth_date;
          user.birth_date_hash = crypto.createHash('sha256').update(updateUserDto.birth_date).digest('hex');
        }

        // 재암호화
        const keyId = this.kmsService.getSymmetricKeyId()!;
        const piiEncrypted = await this.kmsService.encrypt(
          JSON.stringify(piiData),
          keyId,
        );
        user.encrypted_pii = piiEncrypted.encryptedData;
        user.pii_iv = piiEncrypted.iv;
        user.pii_auth_tag = piiEncrypted.authTag;
      }

      // address 업데이트
      if (updateUserDto.address) {
        user.address = updateUserDto.address;
      }

      // address_detail 업데이트
      if (updateUserDto.address_detail !== undefined) {
        if (updateUserDto.address_detail) {
          const keyId = this.kmsService.getSymmetricKeyId()!;
          const addressDetailEncrypted = await this.kmsService.encrypt(
            updateUserDto.address_detail,
            keyId,
          );
          user.encrypted_address_detail = addressDetailEncrypted.encryptedData;
          user.address_detail_iv = addressDetailEncrypted.iv;
          user.address_detail_auth_tag = addressDetailEncrypted.authTag;
        } else {
          user.encrypted_address_detail = null;
          user.address_detail_iv = null;
          user.address_detail_auth_tag = null;
        }
      }

      // password 업데이트
      if (updateUserDto.password) {
        user.password_hash = await bcrypt.hash(
          updateUserDto.password,
          this.BCRYPT_SALT_ROUNDS,
        );
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

  /**
   * Verify user password
   */
  async verifyPassword(id: string, password: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return bcrypt.compare(password, user.password_hash);
  }

  private async toResponseDto(user: User): Promise<UserResponseDto> {
    try {
      // PII 데이터 복호화
      const decryptedPii = await this.kmsService.decrypt(
        user.encrypted_pii,
        user.pii_iv,
        user.pii_auth_tag,
      );
      const piiData = JSON.parse(decryptedPii);

      // address_detail 복호화
      let addressDetail: string | undefined = undefined;
      if (user.encrypted_address_detail && user.address_detail_iv && user.address_detail_auth_tag) {
        addressDetail = await this.kmsService.decrypt(
          user.encrypted_address_detail,
          user.address_detail_iv,
          user.address_detail_auth_tag,
        );
      }

      return new UserResponseDto({
        id: user.id,
        name: piiData.name,
        phone: piiData.phone,
        email: piiData.email,
        birth_date: piiData.birth_date,
        address: user.address,
        address_detail: addressDetail,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      });
    } catch (error) {
      this.logger.error('Failed to decrypt user data:', error.message);
      throw error;
    }
  }
}

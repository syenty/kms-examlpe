import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: '사용자 이름',
    example: '홍길동',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: '전화번호 (10-11자리 숫자)',
    example: '01012345678',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10,11}$/, {
    message: 'Phone number must be 10-11 digits',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: '이메일',
    example: 'hong@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: '생년월일 (YYYY-MM-DD)',
    example: '1990-01-01',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Birth date must be in YYYY-MM-DD format',
  })
  birth_date?: string;

  @ApiPropertyOptional({
    description: '주소',
    example: '서울시 강남구 테헤란로',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: '상세주소',
    example: '123동 456호',
  })
  @IsOptional()
  @IsString()
  address_detail?: string;

  @ApiPropertyOptional({
    description: '비밀번호 (최소 8자)',
    example: 'newpassword123',
  })
  @IsOptional()
  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters long',
  })
  password?: string;
}

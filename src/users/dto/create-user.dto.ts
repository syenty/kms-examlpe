import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  IsOptional,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: '사용자 이름',
    example: '홍길동',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: '전화번호 (10-11자리 숫자)',
    example: '01012345678',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]{10,11}$/, {
    message: 'Phone number must be 10-11 digits',
  })
  phone: string;

  @ApiProperty({
    description: '이메일',
    example: 'hong@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: '생년월일 (YYYY-MM-DD)',
    example: '1990-01-01',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Birth date must be in YYYY-MM-DD format',
  })
  birth_date: string;

  @ApiProperty({
    description: '주소',
    example: '서울시 강남구 테헤란로',
  })
  @IsNotEmpty()
  @IsString()
  address: string;

  @ApiPropertyOptional({
    description: '상세주소 (선택사항)',
    example: '123동 456호',
  })
  @IsOptional()
  @IsString()
  address_detail?: string;

  @ApiProperty({
    description: '비밀번호 (최소 8자)',
    example: 'password123',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters long',
  })
  password: string;
}

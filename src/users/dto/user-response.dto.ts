import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: '사용자 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '사용자 이름',
    example: '홍길동',
  })
  name: string;

  @ApiProperty({
    description: '전화번호',
    example: '01012345678',
  })
  phone: string;

  @ApiProperty({
    description: '이메일',
    example: 'hong@example.com',
  })
  email: string;

  @ApiProperty({
    description: '생년월일',
    example: '1990-01-01',
  })
  birth_date: string;

  @ApiProperty({
    description: '주소',
    example: '서울시 강남구 테헤란로',
  })
  address: string;

  @ApiPropertyOptional({
    description: '상세주소',
    example: '123동 456호',
  })
  address_detail?: string;

  @ApiProperty({
    description: '생성일시',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: '수정일시',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}

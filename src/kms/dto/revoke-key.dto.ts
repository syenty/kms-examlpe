import { IsString, IsOptional } from 'class-validator';

export class RevokeKeyDto {
  @IsString()
  keyId: string;

  @IsOptional()
  @IsString()
  reason?: string = 'Unspecified';
}

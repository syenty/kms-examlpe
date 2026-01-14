import { IsString, IsOptional } from 'class-validator';

export class ReKeyDto {
  @IsOptional()
  @IsString()
  keyId?: string;
}

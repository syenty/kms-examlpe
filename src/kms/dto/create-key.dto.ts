import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateSymmetricKeyDto {
  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsNumber()
  @Min(128)
  @Max(256)
  keySize?: number = 256;
}

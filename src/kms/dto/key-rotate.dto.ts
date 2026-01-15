import { IsString, IsNotEmpty } from 'class-validator';

export class KeyRotateDto {
  @IsString()
  @IsNotEmpty()
  keyId: string;
}

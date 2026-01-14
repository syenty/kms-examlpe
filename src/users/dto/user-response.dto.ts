export class UserResponseDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  emailKeyId?: string;
  phoneKeyId?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}

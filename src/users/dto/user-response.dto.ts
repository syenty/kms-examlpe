export class UserResponseDto {
  id: string;
  name: string;
  phone: string;
  email: string;
  birth_date: string;
  address: string;
  address_detail?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}

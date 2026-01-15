import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  pii_key_id: string;

  @Column({ type: 'text' })
  encrypted_pii: string;

  @Column({ type: 'varchar', length: 255 })
  pii_iv: string;

  @Column({ type: 'varchar', length: 255 })
  pii_auth_tag: string;

  @Column({ type: 'varchar', length: 64 })
  name_hash: string;

  @Column({ type: 'varchar', length: 64 })
  phone_hash: string;

  @Column({ type: 'varchar', length: 64 })
  email_hash: string;

  @Column({ type: 'varchar', length: 64 })
  birth_date_hash: string;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_detail_key_id: string | null;

  @Column({ type: 'text', nullable: true })
  encrypted_address_detail: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_detail_iv: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_detail_auth_tag: string | null;

  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

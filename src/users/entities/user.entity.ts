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

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text' })
  encryptedEmail: string;

  @Column({ type: 'text' })
  encryptedPhone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  emailKeyId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  phoneKeyId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

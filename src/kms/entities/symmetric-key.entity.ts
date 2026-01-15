import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('symmetric_keys')
export class SymmetricKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // KMS에 저장된 키의 고유 ID
  @Column({ type: 'varchar', length: 255, unique: true })
  kms_key_id: string;

  // 키의 태그 (선택)
  @Column({ type: 'varchar', length: 100, nullable: true })
  tag: string | null;

  // 키의 용도/이름 (예: 'default', 'pii_encryption', 'address_encryption')
  @Column({ type: 'varchar', length: 100 })
  key_name: string;

  // 키 설명 (선택)
  @Column({ type: 'text', nullable: true })
  description: string | null;

  // 키가 활성 상태인지 (현재 사용 중인 키)
  @Column({ type: 'boolean', default: true })
  active: boolean;

  // 키 생성일
  @CreateDateColumn()
  created_at: Date;

  // 키가 비활성화된 날짜 (키 로테이션 시)
  @Column({ type: 'timestamp', nullable: true })
  deactivated_at: Date | null;

  // 키가 폐기된 날짜 (더 이상 사용 불가)
  @Column({ type: 'timestamp', nullable: true })
  revoked_at: Date | null;
}

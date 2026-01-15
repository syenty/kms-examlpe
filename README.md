# KMS Example - User Management with Cosmian KMS Encryption

NestJS 기반 회원관리 시스템으로, Cosmian KMS를 활용하여 이메일과 전화번호를 암호화합니다.

## 주요 기능

- 회원 생성/조회/수정/삭제 (CRUD)
- 이메일과 전화번호 자동 암호화/복호화
- Cosmian KMS를 통한 중앙화된 키 관리
- PostgreSQL을 이용한 데이터 저장
- Docker Compose를 통한 간편한 환경 구성

## 기술 스택

- **Backend**: NestJS, TypeScript
- **Database**: PostgreSQL 17
- **Encryption**: Cosmian KMS (AES-256-GCM)
- **ORM**: TypeORM
- **Container**: Docker, Docker Compose

## 프로젝트 구조

```
kms-example/
├── src/
│   ├── config/              # 설정 파일
│   │   ├── database.config.ts
│   │   └── kms.config.ts
│   ├── encryption/          # KMS 암호화 서비스
│   │   ├── encryption.service.ts
│   │   └── encryption.module.ts
│   ├── users/               # 회원 관리 모듈
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   ├── app.module.ts
│   └── main.ts
├── docker-compose.kms.yml   # KMS Docker 구성
└── package.json
```

## 시작하기

### 1. 환경 설정

```bash
# .env.example을 복사하여 .env 파일 생성
cp .env.example .env
```

**.env 파일 예시:**
```env
# Environment
# local: 로컬 개발 (synchronize=true, logging=true)
# development: 개발 서버 (synchronize=true, logging=true)
# production: 프로덕션 (synchronize=false, logging=false)
NODE_ENV=local

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=userdb

# KMS Configuration (REQUIRED)
KMS_URL=http://localhost:9998
```

### 2. Docker Compose로 서비스 실행

```bash
# PostgreSQL과 Cosmian KMS 시작
docker-compose -f docker-compose.kms.yml up -d

# 서비스 상태 확인
docker-compose -f docker-compose.kms.yml ps

# KMS가 정상적으로 시작되었는지 확인
curl http://localhost:9998/version
```

**중요**:
- KMS 전용 Docker Compose 파일(`docker-compose.kms.yml`)을 사용합니다.
- Docker 이미지의 기본 entrypoint에 문제가 있어, `docker-compose.kms.yml`에서 명시적으로 `/bin/cosmian_kms`를 entrypoint로 지정했습니다.

### 3. 의존성 설치 및 애플리케이션 실행

```bash
# 의존성 설치
npm install

# 로컬 개발 모드 (DB synchronize=true, logging=true)
npm run start:local

# 개발 서버 모드 (DB synchronize=true, logging=true)
npm run start:dev

# 프로덕션 빌드 및 실행 (DB synchronize=false, logging=false)
npm run build
npm run start:prod
```

애플리케이션이 `http://localhost:3000`에서 실행됩니다.

**환경별 차이:**
- `local`: 로컬 개발 환경 - DB 스키마 자동 동기화, SQL 로그 활성화
- `development`: 개발 서버 환경 - DB 스키마 자동 동기화, SQL 로그 활성화
- `production`: 프로덕션 환경 - DB 스키마 자동 동기화 비활성화 (마이그레이션 사용 권장), SQL 로그 비활성화

## KMS 키 관리

### 자동 키 관리

애플리케이션 시작 시 자동으로 키를 관리합니다:

1. **서버 시작 시 자동 처리:**
   - DB에 활성 키가 있으면 해당 키 로드
   - 활성 키가 없으면 자동으로 새 키 생성 및 DB에 저장

2. **시작 로그 확인:**
```
✅ Active key found: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   Tag: default
   Name: default
   Created: 2024-01-15T...
```

또는 키가 없는 경우:
```
⚠️  No active key found. Creating new key...
✅ New key created and saved: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 수동 키 생성 (선택사항)

스크립트를 통해 미리 키를 생성할 수 있습니다:

```bash
# 기본 256비트 키 생성
node scripts/create.js

# 태그를 지정하여 키 생성
node scripts/create.js user-encryption 256

# 다른 크기의 키 생성
node scripts/create.js 128
node scripts/create.js 192
```

생성된 키 ID는 자동으로 DB에 저장되며, 별도로 `.env`에 설정할 필요가 없습니다.

## API 엔드포인트

### 키 로테이션 API

키 로테이션을 통해 보안을 강화할 수 있습니다.

```bash
# 키 로테이션 (기존 키 비활성화 + 새 키 생성)
POST /kms/rotate
Content-Type: application/json

{
  "keyId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**동작 방식:**
1. 지정된 KMS 키 ID로 DB에서 키 조회
2. 새로운 키를 KMS에 생성
3. 새 키를 DB에 저장 (active=true)
4. 기존 키를 비활성화 (active=false, deactivated_at=현재시간)
5. **서버 재시작 시 새 키가 자동으로 활성화됨**

**예시:**
```bash
curl -X POST http://localhost:3000/kms/rotate \
  -H "Content-Type: application/json" \
  -d '{
    "keyId": "632fdf9f-a854-4e83-9948-4cc31706d344"
  }'
```

**응답:**
```json
{
  "success": true,
  "message": "Key rotation completed. Please restart the server to use the new key.",
  "newKmsKeyId": "new-key-id-here"
}
```

### 사용자 관리 API

### 회원 생성

```bash
POST /users
Content-Type: application/json

{
  "name": "홍길동",
  "email": "hong@example.com",
  "phone": "01012345678"
}
```

### 전체 회원 조회

```bash
GET /users
```

### 특정 회원 조회

```bash
GET /users/:id
```

### 회원 정보 수정

```bash
PATCH /users/:id
Content-Type: application/json

{
  "name": "홍길동",
  "email": "newemail@example.com",
  "phone": "01087654321"
}
```

### 회원 삭제

```bash
DELETE /users/:id
```

## 암호화 동작 방식

이 서비스는 **Cosmian KMS를 통한 암호화만 지원**합니다.

### 암호화 프로세스

1. **키 관리**:
   - KMS에서 키 생성
   - DB(`symmetric_keys` 테이블)에 키 메타데이터 저장
   - 서버 시작 시 활성 키 자동 로드

2. **암호화**:
   - KMS API를 통해 데이터 암호화
   - 암호화된 데이터, IV, Auth Tag, **키 ID**를 DB에 저장

3. **복호화**:
   - DB에서 저장된 키 ID를 사용하여 KMS에서 복호화
   - 키 로테이션 후에도 이전 키로 암호화된 데이터 복호화 가능

**장점:**
- 중앙화된 키 관리
- 키 로테이션 지원 (이전 데이터 호환성 유지)
- 각 데이터마다 사용된 키 ID 추적
- KMIP 2.1 표준 준수

```
[사용자 생성/수정]
       ↓
[KMS 암호화 - 현재 활성 키 사용]
       ↓
[PostgreSQL 저장: encrypted_data + iv + auth_tag + key_id]

[사용자 조회]
       ↓
[PostgreSQL 조회: 저장된 key_id 포함]
       ↓
[KMS 복호화 - 저장된 key_id 사용]
       ↓
[복호화된 데이터 반환]
```

## 데이터베이스 스키마

### symmetric_keys 테이블
키 메타데이터를 저장합니다.

```sql
CREATE TABLE symmetric_keys (
  id UUID PRIMARY KEY,
  kms_key_id VARCHAR(255) UNIQUE NOT NULL,  -- KMS에 저장된 키의 ID
  tag VARCHAR(100),                         -- 키 태그 (선택)
  key_name VARCHAR(100) NOT NULL,           -- 키 이름
  description TEXT,                         -- 키 설명
  active BOOLEAN DEFAULT TRUE,              -- 활성 상태
  created_at TIMESTAMP DEFAULT NOW(),       -- 생성일
  deactivated_at TIMESTAMP,                 -- 비활성화 날짜
  revoked_at TIMESTAMP                      -- 폐기 날짜
);
```

### users 테이블
사용자 데이터를 저장합니다.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  -- PII 데이터 (name, phone, email, birth_date)
  pii_key_id VARCHAR(255) NOT NULL,         -- 사용된 키 ID
  encrypted_pii TEXT NOT NULL,              -- 암호화된 PII JSON
  pii_iv VARCHAR(255) NOT NULL,             -- IV
  pii_auth_tag VARCHAR(255) NOT NULL,       -- Auth Tag
  -- 해시 값 (검색용)
  name_hash VARCHAR(64) NOT NULL,
  phone_hash VARCHAR(64) NOT NULL,
  email_hash VARCHAR(64) NOT NULL,
  birth_date_hash VARCHAR(64) NOT NULL,
  -- 주소
  address VARCHAR(255) NOT NULL,
  address_detail_key_id VARCHAR(255),       -- 사용된 키 ID
  encrypted_address_detail TEXT,            -- 암호화된 상세주소
  address_detail_iv VARCHAR(255),
  address_detail_auth_tag VARCHAR(255),
  -- 비밀번호
  password_hash VARCHAR(255) NOT NULL,
  -- 메타데이터
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 키 로테이션 (Key Rotation)

정기적인 키 교체로 보안을 강화할 수 있습니다.

### API를 통한 키 로테이션

```bash
# 현재 활성 키의 KMS Key ID로 로테이션 요청
curl -X POST http://localhost:3000/kms/rotate \
  -H "Content-Type: application/json" \
  -d '{
    "keyId": "현재-키의-KMS-ID"
  }'
```

**프로세스:**
1. 새 키 생성 (KMS)
2. 새 키를 DB에 저장 (active=true)
3. 기존 키 비활성화 (active=false)
4. **서버 재시작** → 새 키 자동 활성화

### 키 로테이션 후 데이터 처리

- ✅ **이전 데이터**: 저장된 `key_id`로 복호화 가능 (이전 키 사용)
- ✅ **새 데이터**: 자동으로 새 키로 암호화
- ✅ **업데이트된 데이터**: 자동으로 새 키로 재암호화

**주의:** 서버를 재시작해야 새 키가 활성화됩니다.

## 보안 고려사항

- 민감한 정보(PII, 상세주소)는 Cosmian KMS를 통해 AES-256-GCM으로 암호화
- 각 암호화된 데이터마다 사용된 키 ID 저장 → 키 로테이션 후에도 복호화 가능
- 중앙화된 키 관리로 보안 정책 일관성 유지
- KMIP 2.1 표준 준수
- 키 로테이션 지원 (이전 데이터 호환성 보장)
- 비밀번호는 bcrypt로 별도 해싱
- 정기적인 키 로테이션 권장 (6-12개월)

## API 테스트

```bash
# 회원 생성
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트",
    "email": "test@example.com",
    "phone": "01012345678"
  }'

# 전체 조회
curl http://localhost:3000/users
```

## 문제 해결

### KMS 컨테이너 시작 확인

```bash
# KMS 상태 확인
curl http://localhost:9998/version

# KMS 로그 확인
docker-compose -f docker-compose.kms.yml logs cosmian-kms

# KMS UI 접속
open http://localhost:9998/ui
```

### 데이터베이스 연결 확인

```bash
# PostgreSQL 상태 확인
docker-compose -f docker-compose.kms.yml logs postgres

# 데이터베이스 접속 테스트
docker exec -it kms-postgres psql -U postgres -d userdb
```

## 서비스 중지

```bash
# 서비스 중지
docker-compose -f docker-compose.kms.yml down

# 데이터까지 삭제
docker-compose -f docker-compose.kms.yml down -v
```

## 라이선스

MIT

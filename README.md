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

# REQUIRED: KMS Symmetric Key ID (KMS UI에서 키 생성 후 여기에 ID 입력)
# 이 값이 설정되지 않으면 애플리케이션이 시작되지 않습니다!
KMS_SYMMETRIC_KEY_ID=your-symmetric-key-id-here
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

## KMS 키 생성 및 설정

### 1. KMS UI에서 키 생성

브라우저에서 KMS UI에 접속:
```
http://localhost:9998/ui
```

#### Symmetric Key (대칭키) 생성

1. KMS UI 접속
2. 좌측 메뉴에서 **"Keys"** 클릭
3. **"Create Key"** 버튼 클릭
4. 키 타입 선택: **"Symmetric Key"**
5. 설정:
   - **Algorithm**: AES
   - **Key Size**: 256 bits
   - **Tags**: `user-data-encryption` (선택사항)
6. **"Create"** 버튼 클릭
7. **생성된 키의 ID를 복사** (UUID 형식)

#### RSA Key Pair (비대칭키) 생성 (선택사항)

1. **"Create Key"** 버튼 클릭
2. 키 타입 선택: **"RSA Key Pair"**
3. 설정:
   - **Key Size**: 2048 또는 4096 bits
   - **Tags**: `user-rsa` (선택사항)
4. **"Create"** 버튼 클릭
5. **생성된 키의 ID를 복사**

### 2. .env 파일에 키 ID 설정

생성한 키의 ID를 `.env` 파일에 추가:

```bash
# .env 파일 편집
nano .env

# 또는
vi .env
```

키 ID 입력:
```env
KMS_SYMMETRIC_KEY_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 3. 애플리케이션 재시작

환경 변수가 적용되도록 애플리케이션 재시작:

```bash
# 로컬 개발 모드로 재시작
# Ctrl+C로 중지 후
npm run start:local

# 또는 개발 서버 모드 (SQL 로그 포함)
npm run start:dev
```

시작 로그에서 KMS 연동 확인:
```
✅ Encryption service initialized with Cosmian KMS
   Using symmetric key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**⚠️ 중요:** `KMS_SYMMETRIC_KEY_ID`가 설정되지 않으면 다음 오류가 발생하며 애플리케이션이 시작되지 않습니다:
```
❌ KMS_SYMMETRIC_KEY_ID is not configured in .env
   Please create a key and set KMS_SYMMETRIC_KEY_ID
Error: KMS_SYMMETRIC_KEY_ID is required but not configured
```

## API 엔드포인트

### KMS 관리 API

KMS 키를 API를 통해 관리할 수 있습니다. 자세한 내용은 [KMS_API.md](KMS_API.md)를 참고하세요.

**주요 엔드포인트:**

```bash
# 새 키 생성
POST /kms/keys

# 키 로테이션 (Re-key)
POST /kms/keys/rotate

# 키 폐기
POST /kms/keys/:keyId/revoke

# 키 삭제
DELETE /kms/keys/:keyId

# 현재 키 조회
POST /kms/keys/current
```

**예시:**
```bash
# 새 Symmetric Key 생성
curl -X POST http://localhost:3000/kms/keys \
  -H "Content-Type: application/json" \
  -d '{
    "tag": "user-data-encryption",
    "keySize": 256
  }'
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

### KMS 모드

`KMS_SYMMETRIC_KEY_ID`가 **반드시 설정**되어야 합니다.

1. **키 관리**: Cosmian KMS에서 중앙 관리
2. **암호화**: KMS API를 통해 암호화 수행
3. **저장**: 암호화된 데이터와 키 ID를 PostgreSQL에 저장
4. **복호화**: 키 ID로 KMS에서 복호화 수행

**장점:**
- 중앙화된 키 관리
- 키 로테이션 지원
- 감사 로그 자동 기록
- 액세스 제어 및 권한 관리
- KMIP 표준 준수

```
[사용자 입력] → [NestJS] → [KMS 암호화] → [PostgreSQL 저장]
                              ↓
                    [Cosmian KMS Server]
                              ↓
                    [API 응답] ← [KMS 복호화] ← [PostgreSQL 조회]
```

## 데이터베이스 스키마

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  encrypted_email TEXT NOT NULL,
  encrypted_phone TEXT NOT NULL,
  email_key_id VARCHAR(255),
  phone_key_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 키 로테이션 (Key Rotation)

정기적인 키 교체로 보안을 강화할 수 있습니다.

### KMS 네이티브 Re-key 사용 (권장)

```bash
# 현재 키를 기반으로 새 키 자동 생성 및 데이터 재암호화
npm run rotate-keys:native
```

KMS가 자동으로:
- 대체 키 생성
- 이전 키와 새 키 간 링크 생성
- 키 속성 복사

자세한 내용은 [KEY_ROTATION.md](KEY_ROTATION.md)를 참고하세요.

## 보안 고려사항

- 민감한 정보(이메일, 전화번호)는 Cosmian KMS를 통해 암호화되어 데이터베이스에 저장
- 중앙화된 키 관리로 보안 정책 일관성 유지
- KMIP 2.1 표준 준수
- 키 로테이션 및 폐기 지원
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

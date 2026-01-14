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
├── docker-compose.yml       # Docker 구성
└── package.json
```

## 시작하기

### 1. 환경 설정

```bash
# .env 파일 생성
cat > .env << 'EOF'
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=userdb

# Encryption (선택사항 - 기본값 사용)
# ENCRYPTION_MASTER_KEY=your-base64-encoded-key
EOF
```

### 2. Docker Compose로 서비스 실행

```bash
# PostgreSQL과 Cosmian KMS 시작
docker compose up -d

# 서비스 상태 확인
docker compose ps

# KMS가 정상적으로 시작되었는지 확인
curl http://localhost:9998/version
```

**중요**: Docker 이미지의 기본 entrypoint에 문제가 있어, `docker-compose.yml`에서 명시적으로 `/bin/cosmian_kms`를 entrypoint로 지정했습니다.

### 3. 의존성 설치 및 애플리케이션 실행

```bash
# 의존성 설치
npm install

# 개발 모드
npm run start:dev

# 프로덕션 빌드
npm run build
npm run start:prod
```

애플리케이션이 `http://localhost:3000`에서 실행됩니다.

## KMS UI 사용

브라우저에서 KMS UI에 접속하여 키를 생성하고 관리할 수 있습니다:

```
http://localhost:9998/ui
```

### 대칭키 생성 방법

1. KMS UI 접속
2. 좌측 메뉴에서 **"Keys"** 클릭
3. **"Create Key"** 버튼 클릭
4. 키 타입 선택: **"Symmetric Key"**
5. 설정:
   - **Algorithm**: AES
   - **Key Size**: 256 bits
   - **Tags**: 원하는 태그 추가 (예: `master-key`)
6. **"Create"** 버튼 클릭

## API 엔드포인트

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

현재 구현은 **로컬 AES-256-GCM 암호화**를 사용합니다:

1. **마스터 키**: 환경 변수 또는 기본값 사용
2. **암호화**: 각 데이터마다 고유한 Salt를 사용하여 키 파생
3. **저장**: 암호화된 데이터를 PostgreSQL에 저장
4. **복호화**: 저장된 Salt로 동일한 키를 파생하여 복호화

```
[사용자 입력] → [NestJS] → [AES-256-GCM] → [PostgreSQL 저장]
                    ↓
              [API 응답] ← [복호화] ← [PostgreSQL 조회]
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

## 보안 고려사항

- 민감한 정보(이메일, 전화번호)는 암호화되어 데이터베이스에 저장
- AES-256-GCM 인증 암호화 사용
- 각 데이터마다 고유한 Salt와 IV 사용
- 암호화 키는 환경 변수로 관리

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
docker compose logs cosmian-kms

# KMS UI 접속
open http://localhost:9998/ui
```

### 데이터베이스 연결 확인

```bash
# PostgreSQL 상태 확인
docker compose logs postgres

# 데이터베이스 접속 테스트
docker exec -it kms-postgres psql -U postgres -d userdb
```

## 서비스 중지

```bash
# 서비스 중지
docker compose down

# 데이터까지 삭제
docker compose down -v
```

## 라이선스

MIT

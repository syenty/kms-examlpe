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
- **Database**: PostgreSQL
- **Encryption**: Cosmian KMS (AES-256)
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
│   │   │   ├── create-user.dto.ts
│   │   │   ├── update-user.dto.ts
│   │   │   └── user-response.dto.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   ├── app.module.ts
│   └── main.ts
├── docker-compose.yml       # Docker 구성
├── package.json
└── README.md
```

## 시작하기

### 1. 환경 설정

```bash
# .env 파일 생성
cp .env.example .env
```

### 2. Docker Compose로 서비스 실행

```bash
# PostgreSQL과 Cosmian KMS 시작
docker-compose up -d

# 서비스 상태 확인
docker-compose ps
```

### 3. 의존성 설치

```bash
npm install
```

### 4. 애플리케이션 실행

```bash
# 개발 모드
npm run start:dev

# 프로덕션 빌드
npm run build
npm run start:prod
```

애플리케이션이 `http://localhost:3000`에서 실행됩니다.

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

**응답:**
```json
{
  "id": "uuid",
  "name": "홍길동",
  "email": "hong@example.com",
  "phone": "01012345678",
  "createdAt": "2024-01-14T...",
  "updatedAt": "2024-01-14T..."
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

1. **키 생성**: 애플리케이션 시작 시 Cosmian KMS에서 AES-256 대칭키 생성
2. **암호화**: 사용자 데이터 저장 시 이메일과 전화번호를 KMS로 암호화
3. **저장**: 암호화된 데이터와 키 ID를 PostgreSQL에 저장
4. **복호화**: 데이터 조회 시 KMS를 통해 자동 복호화

```
[사용자 입력] → [NestJS] → [KMS 암호화] → [PostgreSQL 저장]
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

## 보안 고려사항

- 민감한 정보(이메일, 전화번호)는 암호화되어 데이터베이스에 저장
- 암호화 키는 Cosmian KMS에서 중앙 관리
- 애플리케이션은 평문 데이터에 직접 접근 불가
- 키 로테이션 및 액세스 제어는 KMS 레벨에서 관리

## 테스트

```bash
# cURL로 테스트
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

### KMS 연결 실패
```bash
# KMS 상태 확인
curl http://localhost:9998/version

# KMS 로그 확인
docker-compose logs cosmian-kms
```

### 데이터베이스 연결 실패
```bash
# PostgreSQL 상태 확인
docker-compose logs postgres

# 데이터베이스 접속 테스트
docker exec -it kms-postgres psql -U postgres -d userdb
```

## 서비스 중지

```bash
# 서비스 중지
docker-compose down

# 데이터까지 삭제
docker-compose down -v
```

## 라이선스

MIT

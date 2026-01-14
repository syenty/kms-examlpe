# Cosmian KMS 통합 가이드

## 개요

이 프로젝트는 Cosmian KMS를 사용하여 민감한 사용자 데이터(이메일, 전화번호)를 암호화합니다.

## 작동 방식

### 1. 자동 모드 전환

애플리케이션은 시작 시 다음 순서로 암호화 모드를 결정합니다:

1. **KMS 모드 시도**
   - `.env`에 `KMS_SYMMETRIC_KEY_ID`가 설정되어 있는지 확인
   - KMS 서버 연결 테스트
   - 암호화/복호화 테스트 수행
   - 성공 시 KMS 모드로 작동

2. **로컬 모드로 Fallback**
   - KMS 모드 실패 시 자동으로 로컬 암호화 사용
   - 경고 로그 출력하지만 애플리케이션은 정상 작동

### 2. KMS 모드 vs 로컬 모드

| 특징 | KMS 모드 | 로컬 모드 |
|------|----------|-----------|
| 키 관리 | Cosmian KMS 서버 | 환경 변수 |
| 암호화 수행 | KMS API | Node.js crypto |
| 알고리즘 | AES-256 (KMS 관리) | AES-256-GCM |
| 키 로테이션 | KMS UI에서 가능 | 수동 |
| 감사 로그 | 자동 기록 | 없음 |
| 의존성 | KMS 서버 필요 | 독립적 |

## 실제 사용 예시

### 시나리오 1: KMS 연동 (권장)

```bash
# 1. KMS UI에서 키 생성
open http://localhost:9998/ui

# 2. .env에 키 ID 설정
echo "KMS_SYMMETRIC_KEY_ID=abc123..." >> .env

# 3. 애플리케이션 시작
npm run start:dev

# 4. 로그 확인
# ✅ Encryption service initialized with Cosmian KMS
#    Using symmetric key: abc123...
```

이제 모든 암호화/복호화가 KMS를 통해 수행됩니다.

### 시나리오 2: 로컬 암호화 (개발 환경)

```bash
# 1. KMS 설정 없이 시작
npm run start:dev

# 2. 로그 확인
# ✅ Encryption service initialized with local AES-256-GCM
#    ⚠️  KMS not configured - using local encryption
```

KMS 없이도 애플리케이션이 정상 작동합니다.

## 사용 중인 키 확인

### 1. 애플리케이션 로그

```bash
# 개발 서버 시작 시 로그에서 확인
npm run start:dev

# KMS 모드:
# ✅ Encryption service initialized with Cosmian KMS
#    Using symmetric key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# 로컬 모드:
# ✅ Encryption service initialized with local AES-256-GCM
#    ⚠️  KMS not configured - using local encryption
```

### 2. KMS UI

KMS 모드 사용 시 KMS UI에서 키 사용 현황 확인:

```
http://localhost:9998/ui
```

- 키 목록에서 사용 중인 키 확인
- 키의 상태 (Active, Deactivated, Revoked)
- 생성 시간, 마지막 사용 시간 등

## 키 로테이션

### KMS 모드에서 키 교체

1. **KMS UI에서 새 키 생성**
   ```
   http://localhost:9998/ui
   ```

2. **새 키 ID를 .env에 업데이트**
   ```bash
   KMS_SYMMETRIC_KEY_ID=new-key-id-here
   ```

3. **애플리케이션 재시작**
   ```bash
   npm run start:dev
   ```

4. **이전 데이터 재암호화 (선택)**
   - 기존 데이터는 여전히 이전 키 ID로 복호화 가능
   - 필요 시 migration 스크립트로 재암호화

### 데이터베이스에 저장된 키 ID

각 암호화된 데이터는 사용된 키 ID와 함께 저장됩니다:

```sql
SELECT
  id,
  name,
  email_key_id,  -- 이메일 암호화에 사용된 키 ID
  phone_key_id   -- 전화번호 암호화에 사용된 키 ID
FROM users;
```

서비스는 저장된 키 ID를 사용하여 올바른 키로 복호화합니다.

## 문제 해결

### KMS 연결 실패

```
Failed to connect to KMS: fetch failed
Falling back to local encryption
```

**원인:**
- KMS 서버가 실행 중이지 않음
- 잘못된 KMS URL

**해결:**
```bash
# KMS 서버 상태 확인
docker ps | grep kms

# KMS 시작
docker compose up -d cosmian-kms

# 연결 테스트
curl http://localhost:9998/version
```

### 키 ID가 잘못됨

```
KMS test failed: key not found
```

**원인:**
- 존재하지 않는 키 ID
- 키가 삭제되거나 revoke됨

**해결:**
```bash
# KMS UI에서 키 목록 확인
open http://localhost:9998/ui

# 올바른 키 ID를 .env에 설정
KMS_SYMMETRIC_KEY_ID=correct-key-id
```

### 복호화 실패

```
Failed to decrypt data: authentication failed
```

**원인:**
- 데이터가 다른 키로 암호화됨
- 데이터가 손상됨

**해결:**
- 데이터베이스의 `keyId` 컬럼 확인
- 해당 키가 KMS에 존재하는지 확인
- 필요 시 이전 키를 복원

## 보안 권장사항

### 개발 환경

- 로컬 암호화 사용 가능
- KMS 설정 선택적

### 스테이징/프로덕션 환경

- **반드시 KMS 사용**
- 키를 환경 변수가 아닌 KMS에 저장
- KMS 서버에 인증 설정
- 정기적인 키 로테이션
- 감사 로그 모니터링

### .env 파일 관리

```bash
# .env 파일을 git에 커밋하지 마세요!
echo ".env" >> .gitignore

# 민감한 정보는 시크릿 관리 도구 사용
# - AWS Secrets Manager
# - HashiCorp Vault
# - Kubernetes Secrets
```

## API 사용 예시

### 회원 생성 (암호화 자동 적용)

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "홍길동",
    "email": "hong@example.com",
    "phone": "01012345678"
  }'
```

**응답:**
```json
{
  "id": "uuid",
  "name": "홍길동",
  "email": "hong@example.com",  // 자동 복호화됨
  "phone": "01012345678",       // 자동 복호화됨
  "createdAt": "2024-01-14T..."
}
```

**데이터베이스에는 암호화된 상태로 저장:**
```
encrypted_email: "base64-encoded-ciphertext"
email_key_id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 코드 구조

```
src/
├── kms/
│   ├── kms.service.ts        # KMS API 클라이언트
│   └── kms.module.ts
├── encryption/
│   ├── encryption.service.ts  # 통합 암호화 서비스 (KMS + 로컬)
│   └── encryption.module.ts
└── users/
    ├── users.service.ts       # 암호화 자동 적용
    └── users.controller.ts
```

### 주요 메서드

```typescript
// encryption.service.ts
async encrypt(plaintext: string): Promise<{ encrypted: string; keyId: string }>
async decrypt(ciphertext: string, keyId?: string): Promise<string>

// kms.service.ts
async encryptSymmetric(plaintext: string, keyId?: string): Promise<string>
async decryptSymmetric(ciphertext: string, keyId?: string): Promise<string>
```

## 다음 단계

1. ✅ Symmetric key로 데이터 암호화/복호화
2. ⬜ RSA key pair 활용 (클라이언트 암호화)
3. ⬜ 키 로테이션 자동화
4. ⬜ Migration 스크립트 (키 교체 시 데이터 재암호화)
5. ⬜ KMS 인증 및 권한 관리

## 참고 자료

- [Cosmian KMS Documentation](https://docs.cosmian.com/)
- [KMIP 2.1 Specification](http://docs.oasis-open.org/kmip/spec/v2.1/)
- [프로젝트 TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

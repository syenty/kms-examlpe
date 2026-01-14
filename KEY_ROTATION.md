# 키 로테이션 (Key Rotation) 가이드

## 개요

키 로테이션은 보안 모범 사례로, 정기적으로 암호화 키를 교체하여 키 노출 위험을 최소화합니다.

## 현재 구조의 키 관리 방식

### 데이터베이스 스키마

각 암호화된 필드는 **사용된 키 ID**와 함께 저장됩니다:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  encrypted_email TEXT NOT NULL,
  encrypted_phone TEXT NOT NULL,
  email_key_id VARCHAR(255),  -- 이메일 암호화에 사용된 키 ID
  phone_key_id VARCHAR(255),  -- 전화번호 암호화에 사용된 키 ID
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 작동 방식

**암호화 시:**
- 현재 `.env`에 설정된 `KMS_SYMMETRIC_KEY_ID`로 암호화
- 사용된 키 ID를 데이터베이스에 저장

**복호화 시:**
- 데이터베이스에 저장된 키 ID로 복호화
- **다른 키로 암호화된 데이터도 복호화 가능**

```typescript
// encryption.service.ts
async decrypt(ciphertext: string, keyId?: string): Promise<string> {
  // 저장된 keyId 사용 - 어떤 키로 암호화되었든 복호화 가능!
  return await this.kmsService.decryptSymmetric(ciphertext, keyId);
}
```

## 키 로테이션 방법

### 방법 1: KMS 네이티브 Re-key (권장 ⭐)

Cosmian KMS의 **Re-key** 기능을 사용하여 자동으로 대체 키를 생성합니다.

**장점:**
- ✅ KMS가 자동으로 키 간 링크 생성 (키 관계 추적)
- ✅ 키 속성 자동 복사 (activation date, tags 등)
- ✅ KMIP 표준 준수
- ✅ 간단한 사용법 (매개변수 불필요)

**사용법:**
```bash
# 현재 KMS_SYMMETRIC_KEY_ID를 기반으로 새 키 생성 및 재암호화
npm run rotate-keys:native
```

**출력 예시:**
```
🔄 Starting native KMS key rotation...

🔑 Current Key ID: abc-old-key-id

📝 Step 1: Generating replacement key using KMS Re-key operation...
✅ Re-key successful
   Old key: abc-old-key-id
   New key: xyz-new-key-id
   Note: KMS automatically created a link between old and new keys

📝 Step 2: Re-encrypting user data...

📊 Found 15 users to re-encrypt

[1/15] Processing user: 홍길동 (uuid-1)
  ✅ Successfully re-encrypted
     Old key: abc-old-key-id → New key: xyz-new-key-id
...

🎉 Key rotation completed successfully!

📝 Next steps:
   1. Update .env: KMS_SYMMETRIC_KEY_ID=xyz-new-key-id
   2. Restart the application

🔐 Security recommendations:
   - Revoke old key: cosmian kms sym keys revoke -k abc-old-key-id
   - Keep old key for 1-3 months before deletion
   - Old key can still decrypt even when revoked
```

### 방법 2: 수동 키 생성 및 재암호화

UI에서 수동으로 새 키를 생성하고 재암호화합니다.

**사용 시나리오:**
- 키 속성을 변경하고 싶을 때 (다른 알고리즘, 크기 등)
- 특정 태그나 메타데이터가 필요할 때

## 키 로테이션 시나리오

### 시나리오 1: 즉시 재암호화 (권장)

새 키로 전환하고 모든 기존 데이터를 즉시 재암호화합니다.

#### 단계별 가이드

**1. KMS UI에서 새 키 생성**

```
http://localhost:9998/ui
```

1. Keys > Create Key > Symmetric Key
2. Algorithm: AES, Size: 256 bits
3. Tags: `user-data-encryption-v2`
4. **새 키 ID 복사**

**2. 재암호화 스크립트 실행**

```bash
# 새 키 ID를 환경 변수로 전달
NEW_KMS_SYMMETRIC_KEY_ID=새로운-키-ID npm run rotate-keys
```

**출력 예시:**
```
🔄 Starting key rotation...

📝 New Key ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

📊 Found 15 users to re-encrypt

🔑 Current Key ID: old-key-id
🔑 New Key ID: new-key-id

[1/15] Processing user: 홍길동 (uuid-1)
  ✅ Successfully re-encrypted
     Old email key: old-key-id
     New email key: new-key-id
     Old phone key: old-key-id
     New phone key: new-key-id

[2/15] Processing user: 김철수 (uuid-2)
  ✅ Successfully re-encrypted
  ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Summary:
   ✅ Success: 15
   ❌ Failed: 0
   📝 Total: 15

🎉 Key rotation completed successfully!

📝 Next steps:
   1. Update .env: KMS_SYMMETRIC_KEY_ID=new-key-id
   2. Restart the application
   3. (Optional) Revoke the old key in KMS UI
```

**3. .env 파일 업데이트**

```bash
# .env 파일 편집
nano .env

# 새 키 ID로 변경
KMS_SYMMETRIC_KEY_ID=new-key-id
```

**4. 애플리케이션 재시작**

```bash
# 개발 서버 재시작
npm run start:dev
```

**5. 이전 키 폐기 (선택)**

KMS UI에서 이전 키를 Revoke:
1. http://localhost:9998/ui
2. 이전 키 선택
3. "Revoke" 버튼 클릭

### 시나리오 2: 점진적 전환

새 키를 설정하고, 새 데이터만 새 키로 암호화합니다. 기존 데이터는 그대로 유지합니다.

#### 단계별 가이드

**1. KMS UI에서 새 키 생성** (시나리오 1과 동일)

**2. .env 파일 업데이트**

```bash
# 새 키 ID로 직접 변경
KMS_SYMMETRIC_KEY_ID=new-key-id
```

**3. 애플리케이션 재시작**

```bash
npm run start:dev
```

**4. 결과**

- ✅ **새로 생성되는 데이터**: 새 키로 암호화
- ✅ **기존 데이터 조회**: 이전 키 ID로 자동 복호화
- ✅ **기존 데이터 수정**: 새 키로 재암호화

**5. (선택) 점진적 재암호화**

시간이 지나면서 사용자가 정보를 수정할 때마다 자동으로 새 키로 재암호화됩니다.

```bash
# 특정 사용자 정보 수정 (API 호출 시)
PATCH /users/:id
{
  "phone": "01087654321"
}

# 자동으로 새 키로 재암호화됨
```

## 키 로테이션 주기

### 권장 주기

| 환경 | 권장 주기 | 이유 |
|------|-----------|------|
| 개발 | 필요 시 | 테스트 목적 |
| 스테이징 | 3-6개월 | 프로덕션 테스트 |
| 프로덕션 | 6-12개월 | 보안 규정 준수 |

### 즉시 로테이션이 필요한 경우

- 🚨 **키 노출 의심**: 키가 로그, 코드 저장소 등에 노출된 경우
- 🚨 **인력 변동**: 키 접근 권한이 있던 직원 퇴사
- 🚨 **보안 감사**: 외부 감사에서 키 교체 권고
- 🚨 **규정 위반**: 보안 정책 위반 발견

## 문제 해결

### 재암호화 중 일부 실패

```
📊 Summary:
   ✅ Success: 12
   ❌ Failed: 3
   📝 Total: 15
```

**원인:**
- 이전 키가 KMS에서 삭제되거나 revoke됨
- 데이터 손상

**해결:**
```bash
# 1. 이전 키가 KMS에 있는지 확인
open http://localhost:9998/ui

# 2. 필요 시 이전 키 복원 (revoke 취소)

# 3. 재암호화 재시도
NEW_KMS_SYMMETRIC_KEY_ID=new-key-id npm run rotate-keys
```

### 이전 키로 복호화 불가

```
Failed to decrypt data: key not found
```

**원인:**
- KMS에서 이전 키가 삭제됨
- 데이터베이스의 keyId가 잘못됨

**해결:**
```sql
-- 어떤 키 ID들이 사용 중인지 확인
SELECT DISTINCT email_key_id, phone_key_id FROM users;

-- KMS UI에서 해당 키들이 존재하는지 확인
```

## 주의사항

### ⚠️ 백업 필수

재암호화 전 **반드시 데이터베이스 백업**:

```bash
# PostgreSQL 백업
docker exec kms-postgres pg_dump -U postgres userdb > backup_$(date +%Y%m%d_%H%M%S).sql

# 복원 (문제 발생 시)
docker exec -i kms-postgres psql -U postgres userdb < backup_20240114_150000.sql
```

### ⚠️ 이전 키 보관

재암호화 완료 후에도 **일정 기간 이전 키 보관**:

1. KMS UI에서 이전 키를 즉시 삭제하지 마세요
2. 대신 "Revoke" 상태로 유지 (새로운 암호화 방지, 복호화는 가능)
3. 최소 1-3개월 후 완전 삭제

### ⚠️ 다운타임 고려

대량 데이터 재암호화 시:
- 서비스 다운타임 필요할 수 있음
- 점진적 전환 또는 블루-그린 배포 고려

## 자동화 (Advanced)

### Cron Job으로 자동 로테이션

```bash
# crontab -e
# 매 6개월마다 키 로테이션 알림
0 0 1 */6 * echo "Time to rotate encryption keys!" | mail -s "Key Rotation Reminder" admin@example.com
```

### CI/CD 파이프라인 통합

```yaml
# .github/workflows/key-rotation.yml
name: Key Rotation

on:
  workflow_dispatch:
    inputs:
      new_key_id:
        description: 'New KMS Symmetric Key ID'
        required: true

jobs:
  rotate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm install
      - name: Run key rotation
        env:
          NEW_KMS_SYMMETRIC_KEY_ID: ${{ github.event.inputs.new_key_id }}
        run: npm run rotate-keys
```

## 참고 자료

- [KMS UI 가이드](./README.md#kms-키-생성-및-설정)
- [KMS Integration Guide](./KMS_INTEGRATION_GUIDE.md)
- [Cosmian KMS Documentation](https://docs.cosmian.com/)

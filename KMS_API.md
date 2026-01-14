# KMS Admin API Documentation

이 문서는 KMS 키 관리를 위한 REST API 엔드포인트를 설명합니다.

## ⚠️ 보안 주의사항

**프로덕션 환경에서는 반드시:**
- 인증 미들웨어 추가 (JWT, OAuth 등)
- Admin 권한 체크
- IP 화이트리스트
- 감사 로그 기록
- Rate limiting

## Base URL

```
http://localhost:3000/kms
```

## API 엔드포인트

### 1. 새 Symmetric Key 생성

**Endpoint:** `POST /kms/keys`

**설명:** KMS에 새로운 AES 대칭키를 생성합니다.

**Request Body:**
```json
{
  "tag": "user-data-encryption",  // Optional
  "keySize": 256                   // Optional (128, 192, or 256)
}
```

**Response:**
```json
{
  "keyId": "abc-123-xyz",
  "algorithm": "AES-256",
  "tag": "user-data-encryption",
  "message": "Symmetric key created successfully"
}
```

**cURL 예시:**
```bash
curl -X POST http://localhost:3000/kms/keys \
  -H "Content-Type: application/json" \
  -d '{
    "tag": "user-data-encryption",
    "keySize": 256
  }'
```

---

### 2. 키 로테이션 (Re-key)

**Endpoint:** `POST /kms/keys/rotate`

**설명:** KMS의 네이티브 Re-key 작업으로 새 대체 키를 생성합니다. KMS가 자동으로 이전 키와 새 키 간 링크를 생성합니다.

**Request Body:**
```json
{
  "keyId": "old-key-id"  // Optional, 없으면 현재 설정된 키 사용
}
```

**Response:**
```json
{
  "oldKeyId": "old-key-id",
  "newKeyId": "new-key-id",
  "message": "Key rotated successfully. KMS created a link between old and new keys.",
  "nextSteps": [
    "Update .env: KMS_SYMMETRIC_KEY_ID=new-key-id",
    "Run data migration script: npm run rotate-keys:native",
    "Restart the application",
    "Optionally revoke old key: POST /kms/keys/old-key-id/revoke"
  ]
}
```

**cURL 예시:**
```bash
# 현재 키 로테이션
curl -X POST http://localhost:3000/kms/keys/rotate \
  -H "Content-Type: application/json" \
  -d '{}'

# 특정 키 로테이션
curl -X POST http://localhost:3000/kms/keys/rotate \
  -H "Content-Type: application/json" \
  -d '{
    "keyId": "old-key-id"
  }'
```

---

### 3. 키 폐기 (Revoke)

**Endpoint:** `POST /kms/keys/:keyId/revoke`

**설명:** 키를 폐기합니다. 폐기된 키는:
- ✅ 기존 데이터 복호화 가능
- ❌ 새로운 데이터 암호화 불가

**Request Body:**
```json
{
  "reason": "KeyCompromise"  // Optional: Unspecified, KeyCompromise, CACompromise, etc.
}
```

**Response:**
```json
{
  "keyId": "key-id",
  "status": "revoked",
  "reason": "KeyCompromise",
  "message": "Key revoked successfully. Can still decrypt, but cannot encrypt.",
  "note": "Keep this key for at least 1-3 months before deletion for recovery purposes."
}
```

**cURL 예시:**
```bash
curl -X POST http://localhost:3000/kms/keys/abc-123-xyz/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "KeyCompromise"
  }'
```

---

### 4. 키 영구 삭제 (Destroy)

**Endpoint:** `DELETE /kms/keys/:keyId`

**설명:** 키를 영구적으로 삭제합니다.

**⚠️ 경고:**
- 이 작업은 되돌릴 수 없습니다!
- 해당 키로 암호화된 데이터는 복호화할 수 없게 됩니다!
- 삭제 전 반드시 데이터가 재암호화되었는지 확인하세요!

**Response:**
```json
{
  "keyId": "key-id",
  "status": "deleted",
  "message": "Key permanently deleted. This operation cannot be undone.",
  "warning": "Data encrypted with this key can no longer be decrypted!"
}
```

**cURL 예시:**
```bash
curl -X DELETE http://localhost:3000/kms/keys/abc-123-xyz
```

---

### 5. 현재 설정된 키 조회

**Endpoint:** `POST /kms/keys/current`

**설명:** .env에 설정된 현재 키 ID들을 조회합니다.

**Response:**
```json
{
  "symmetricKeyId": "current-symmetric-key-id",
  "rsaKeyId": "current-rsa-key-id",
  "message": "These are the keys currently configured in .env"
}
```

**cURL 예시:**
```bash
curl -X POST http://localhost:3000/kms/keys/current
```

---

## 일반적인 워크플로우

### 시나리오 1: 처음 키 생성

```bash
# 1. 새 키 생성
curl -X POST http://localhost:3000/kms/keys \
  -H "Content-Type: application/json" \
  -d '{"tag": "prod-v1", "keySize": 256}'

# Response에서 keyId 복사
# {"keyId": "abc-123-xyz", ...}

# 2. .env 파일 업데이트
echo "KMS_SYMMETRIC_KEY_ID=abc-123-xyz" >> .env

# 3. 애플리케이션 재시작
npm run start:dev
```

### 시나리오 2: 키 로테이션 (전체 프로세스)

```bash
# 1. 새 대체 키 생성 (Re-key)
curl -X POST http://localhost:3000/kms/keys/rotate \
  -H "Content-Type: application/json" \
  -d '{}'

# Response:
# {
#   "oldKeyId": "old-key",
#   "newKeyId": "new-key",
#   ...
# }

# 2. 데이터 재암호화 스크립트 실행
npm run rotate-keys:native

# 3. .env 업데이트
# KMS_SYMMETRIC_KEY_ID=new-key

# 4. 애플리케이션 재시작
npm run start:dev

# 5. (선택) 이전 키 폐기 (1-3개월 후)
curl -X POST http://localhost:3000/admin/kms/keys/old-key/revoke \
  -H "Content-Type: application/json" \
  -d '{"reason": "KeyCompromise"}'

# 6. (선택) 이전 키 삭제 (6개월 후)
curl -X DELETE http://localhost:3000/kms/keys/old-key
```

### 시나리오 3: 키 노출 시 긴급 대응

```bash
# 1. 즉시 새 키 생성
curl -X POST http://localhost:3000/kms/keys/rotate \
  -H "Content-Type: application/json" \
  -d '{}'

# 2. 노출된 키 즉시 폐기
curl -X POST http://localhost:3000/admin/kms/keys/compromised-key-id/revoke \
  -H "Content-Type: application/json" \
  -d '{"reason": "KeyCompromise"}'

# 3. 긴급 데이터 재암호화
npm run rotate-keys:native

# 4. .env 업데이트 및 재시작
# ...
```

## 에러 응답

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "KMS create key failed: Network error",
  "error": "Internal Server Error"
}
```

## 테스트

Postman Collection이나 다음 스크립트로 테스트할 수 있습니다:

```bash
# test-kms-api.sh
#!/bin/bash

BASE_URL="http://localhost:3000/kms"

echo "1. Creating new key..."
RESPONSE=$(curl -s -X POST $BASE_URL/keys \
  -H "Content-Type: application/json" \
  -d '{"tag": "test-key", "keySize": 256}')
echo $RESPONSE | jq

KEY_ID=$(echo $RESPONSE | jq -r '.keyId')
echo "Created key: $KEY_ID"

echo -e "\n2. Rotating key..."
curl -s -X POST $BASE_URL/keys/rotate \
  -H "Content-Type: application/json" \
  -d "{\"keyId\": \"$KEY_ID\"}" | jq

echo -e "\n3. Getting current keys..."
curl -s -X POST $BASE_URL/keys/current | jq

echo -e "\n4. Revoking key..."
curl -s -X POST $BASE_URL/keys/$KEY_ID/revoke \
  -H "Content-Type: application/json" \
  -d '{"reason": "Test"}' | jq

echo -e "\nDone!"
```

## 보안 강화 (프로덕션)

프로덕션 환경에서는 다음과 같은 보안 조치를 추가하세요:

```typescript
// kms.controller.ts에 가드 추가
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('kms')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'superadmin')
export class KmsController {
  // ...
}
```

## 참고 자료

- [KMS Integration Guide](./KMS_INTEGRATION_GUIDE.md)
- [Key Rotation Guide](./KEY_ROTATION.md)
- [Cosmian KMS Documentation](https://docs.cosmian.com/)

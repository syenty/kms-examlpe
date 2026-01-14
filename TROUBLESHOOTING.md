# Troubleshooting Guide

## Cosmian KMS Docker 컨테이너 시작 문제

### 문제 상황

Cosmian KMS Docker 컨테이너가 시작 후 바로 종료되는 문제가 발생할 수 있습니다.

### 증상

```bash
docker compose up -d cosmian-kms
docker logs kms
```

로그에 디버그 정보만 출력되고 컨테이너가 종료됨:
```
=== Starting Cosmian KMS Container ===
...
=== Available Files ===
/bin/cosmian_kms exists (found in image)
/usr/local/bin/cosmian_kms does not exist
...
=== End Debug Info ===
```

### 원인

Docker 이미지의 기본 entrypoint 스크립트가 `/usr/local/bin/cosmian_kms`를 찾으려고 하지만, 실제 바이너리는 `/bin/cosmian_kms`에 위치합니다.

### 해결 방법

[docker-compose.yml](docker-compose.yml:23-35)에서 명시적으로 entrypoint를 지정:

```yaml
cosmian-kms:
  image: ghcr.io/cosmian/kms:latest
  container_name: kms
  entrypoint: ["/bin/cosmian_kms"]  # 이 줄 추가
  command: []
  ports:
    - "9998:9998"
  volumes:
    - cosmian-kms:/root/cosmian-kms/sqlite-data
  networks:
    - kms-network
  environment:
    - KMS_SQLITE_PATH=/root/cosmian-kms/sqlite-data
```

### 확인

```bash
# 컨테이너 재시작
docker compose down
docker compose up -d

# 정상 작동 확인
curl http://localhost:9998/version

# KMS UI 접속
open http://localhost:9998/ui
```

정상적으로 작동하면 다음과 같은 응답을 받습니다:
```json
{
  "version": "5.14.1",
  ...
}
```

## 일반적인 문제 해결

### KMS 연결 실패

```bash
# KMS 컨테이너 상태 확인
docker ps | grep kms

# KMS 로그 확인
docker logs kms

# KMS 재시작
docker compose restart cosmian-kms
```

### PostgreSQL 연결 실패

```bash
# PostgreSQL 상태 확인
docker ps | grep postgres

# PostgreSQL 로그 확인
docker logs kms-postgres

# 데이터베이스 접속 테스트
docker exec -it kms-postgres psql -U postgres -d userdb
```

### 포트 충돌

KMS(9998) 또는 PostgreSQL(5432) 포트가 이미 사용 중인 경우:

```bash
# 포트 사용 확인
lsof -i :9998
lsof -i :5432

# 사용 중인 프로세스 종료 후 재시작
docker compose down
docker compose up -d
```

### 완전 초기화

모든 데이터를 삭제하고 처음부터 다시 시작:

```bash
# 컨테이너와 볼륨 모두 삭제
docker compose down -v

# 다시 시작
docker compose up -d
```

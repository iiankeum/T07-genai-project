# 아맞다 자가 호스팅

> AI 초안 · 돌린 사람: 신*림 · Codex · 2026-11-18

## 1. Node 직접 설치 (기본)

기존 팀 서버의 Node.js 24 + SQLite 직접 실행을 유지한다. Docker는 필요하지 않다. 아래 명령은 새 설치용이며 기존 팀 서버의 환경 파일·GPU 설정을 덮어쓰지 않는다.

```sh
cd src/app
npm ci
umask 077
cp .env.example .env
node --env-file=.env server.mjs
```

브라우저에서 `http://127.0.0.1:5600`을 열고 계정을 만든다. `AUTH_MAIL_MODE=outbox`는 실제 메일을 보내지 않는다. 설치 담당자가 `DATA_DIR/outbox`에 만들어진 인증 JSON의 `url`을 가입한 브라우저에서 열어 인증한다. `DATA_DIR`를 생략하면 `src/app/.data`를 사용한다. 기존 서버에서는 이미 사용하는 서비스 관리자의 중지·시작 절차를 유지한다.

| 실행 방식 | 실제 하는 일 |
|---|---|
| `AI_PROVIDER=off` | 자동 AI 처리 없음. 수동 주문 관리 가능 |
| `AI_PROVIDER=fixture` / `npm run start:offline` | 가짜 대화에 대한 고정 응답. 모델 추론 아님 |
| `AI_PROVIDER=ollama` | 같은 기기 `127.0.0.1:11434`의 설치된 로컬 모델로 요청. 모델 자동 다운로드·클라우드 대체 없음 |
| Mac 앱 | 위 웹 앱을 로컬 Node로 실행하는 별도 실행기. [Mac 안내](mac-app.md)의 준비와 검증 범위를 따른다 |

실제 로컬 주문 정리는 Ollama와 모델을 먼저 설치하고 `OLLAMA_NO_CLOUD=1`로 Ollama를 실행한 뒤 `.env`에서 `AI_PROVIDER=ollama`, `OLLAMA_MODEL=qwen3:4b`, `ALLOW_PAID_AI=0`을 지정한다. 모델 준비 전에는 연결/모델 오류를 보여주며 fixture나 Claude로 바꾸지 않는다. 녹음 파일 전사는 별도 Whisper 일꾼이 필요하다. 기존 CPU/CUDA 경로를 유지하며 Apple Metal 음성 전사는 구현하지 않았다.

### Docker 설치 (선택)

Docker Engine/Compose를 이미 사용하는 설치자만 저장소 루트에서 실행한다. 첫 빌드에서 Node 이미지와 패키지를 다운로드한다.

```sh
umask 077
cp src/app/.env.example src/app/.env
docker compose --env-file src/app/.env up -d --build --wait
```

Compose의 `app-data` 볼륨이 컨테이너 `/data`에 연결된다. 인증 outbox도 `/data/outbox`에 있다. **Ollama의 loopback 주소는 컨테이너 자신을 가리킨다.** 이 PR의 Docker 예제는 fixture 체험용이며 호스트 Mac의 Ollama를 자동 연결하지 않는다. 실제 로컬 추론은 Node 직접 실행 또는 Mac 앱 경로로 검증한다.

## 2. 비공개 운영 설정

`src/app/.env`를 읽을 수 있는 사람을 배포 담당자로 제한한다. 앱은 호스트의 `127.0.0.1:5600`으로만 게시된다. 팀에서 접속할 때에는 TLS를 제공하는 리버스 프록시가 이 주소로 전달하게 하고 `PUBLIC_BASE_URL`을 브라우저와 일꾼이 쓰는 HTTPS 주소로 지정한다. 프록시는 외부 Host를 전달하고, 브라우저나 일꾼이 보낸 전달 헤더는 자신이 정한 값으로 덮어쓴다. HTTPS 주소는 세션 쿠키와 이메일 인증 링크에도 사용된다.

| 설정 | 값과 역할 |
|---|---|
| `DEMO_MODE` | `0`이면 로그인한 작업공간에 데이터가 저장된다. `1`이면 가짜 데이터용 공개 데모다. 데모와 실제 운영에는 다른 볼륨을 쓴다. |
| `AUTH_MAIL_MODE` | `outbox`는 설치 담당자가 인증 링크를 읽어 수동으로 전달하는 모드다. `off`는 발송을 끈다. 현재 구성의 가입·비밀번호 재설정에는 outbox 전달이 필요하다. |
| `PUBLIC_BASE_URL` | 인증 링크와 일꾼의 오디오 다운로드 주소에 넣을 접속 주소. 로컬 예제는 `http://127.0.0.1:5600`이다. |
| `AHMATDA_PORT` | Docker가 호스트에 게시할 포트. 바꾸면 로컬 `PUBLIC_BASE_URL`도 같은 포트로 바꾼다. |
| `AHMATDA_DOMAIN` | 새 주문 카드에 적용할 업종 프로필과 버전. 기본은 `automotive@1`이다. |
| `AI_PROVIDER` | 서버 기본은 `off`. `fixture`는 고정 응답, `ollama`는 같은 기기 로컬 모델, `anthropic`은 외부 Claude다. |
| `ALLOW_PAID_AI` · `ANTHROPIC_API_KEY` · `CLAUDE_MODEL` | 실제 Claude 사용 시에만 `ALLOW_PAID_AI=1`과 API 키를 설정한다. 기본 모델은 `claude-opus-5-5`다. 비공개 작업공간은 연동 설정에서 원문 전송을 명시적으로 허용(`configured`)해야 호출된다. `off`와 `masked`는 외부 호출을 차단한다. |
| `MAX_UPLOAD_BYTES` · `MAX_AUDIO_SEC` | 업로드 한 건의 바이트·초 제한. 기본 10 MiB와 300초다. |
| `LEGACY_WORKSPACE_OWNER_EMAIL` | 기존 단일 DB를 인계할 때만 설정한다. 이 주소로 가입하고 검증을 마친 소유자에게 기존 데이터를 연결한다. |

Claude를 연결하면 카드 정리·브리핑·질문 처리에 API 비용이 생긴다. `DAILY_AI_LIMIT`으로 서버의 호출 횟수를 제한한다. 개발·검증 중에는 `ALLOW_PAID_AI=0`을 사용한다.

`masked`에는 아직 서버의 실제 가림 처리가 연결되지 않았다. 이 선택은 ‘가린 뒤 전송 완료’가 아니라 외부 전송 차단 상태다. `configured`를 선택하면 받아쓴 원문과 승인 지식이 제공자에게 전송될 수 있으므로 운영자가 데이터 처리 정책을 먼저 확정해야 한다.

## 3. 녹음 파일 받아쓰기

브라우저 마이크 체험과 녹음 파일의 일괄 전사는 입력 경로가 다르다. 녹음 파일은 서버에서 16 kHz mono WAV로 변환한 뒤 SQLite 대기열에 들어간다. 일감은 별도 PC에서 실행하는 Whisper 일꾼이 가져와 처리한다.

1. 작업공간 ID를 확인하고 서버의 `WORKER_WORKSPACE_ID`로 지정한다. 랜덤 토큰을 별도로 생성해 서버와 일꾼 PC의 `WORKER_TOKEN`에 같은 값을 넣는다. 설정을 바꾸면 기존 Node 서비스를 재시작한다. Docker를 선택한 경우에만 `docker compose --env-file src/app/.env up -d --wait`로 반영한다.
2. 받아쓰기 PC에서 [PC 프로그램 설치 안내](../src/pc-agent/README.md)에 따라 `worker`를 실행한다. 일꾼의 `SERVER_URL`은 서버의 `PUBLIC_BASE_URL`과 같은 주소로 지정한다. 첫 실행에서 Whisper 모델을 받는다. NVIDIA GPU를 쓰거나 CPU로 실행할 수 있다.
3. 화면에서 가짜 녹음을 올리고 통화 상태가 대기, 받아쓰기, 카드 정리 순으로 바뀌는지 확인한다. 일꾼이 꺼져 있으면 대기열에 남는다.
4. 녹음 폴더의 자동 전송이 필요한 경우, 그 작업공간에서 발급한 ingest 토큰을 녹음 PC의 `INGEST_TOKEN`에 설정한다. `watch` 모드는 가짜 녹음 폴더에서 먼저 확인한다.

일꾼은 서버로 접속한다. 일꾼 PC에 들어오는 포트를 열지 않아도 된다. [받아쓰기 일꾼 API](../src/app/docs/worker-api.md)는 기존 데모의 인증 예제를 포함한다. 비공개 작업공간의 토큰 범위는 위 설정을 따른다.

현재 한 서버 인스턴스의 일꾼은 `WORKER_WORKSPACE_ID` 하나의 대기열만 처리한다. 다른 작업공간에도 업로드는 가능하지만 그 대기열을 자동으로 처리하지 않는다. 여러 작업공간의 동시 받아쓰기는 작업공간별 별도 설치 또는 일꾼 토큰별 작업공간 매핑 확장이 필요하다. `check` 명령은 비공개 상태 조회에도 일꾼 토큰을 보낸다.

## 4. 낱말 사전과 업종 설정

작업공간의 지식베이스(`/#/knowledge`)에서 현장말, 오인식, 거래처, 차종, 부품, 업무 절차를 관리한다. 별칭·표준어·관련 용어·출처를 추가하거나 CSV로 등록한다. 승인한 항목은 받아쓰기 힌트와 카드 정리에 쓰인다.

기본 업종은 자동차 부품 대리점이다. 다른 업종을 추가하려면 [업종 프로필 확장 안내](../src/app/docs/업종-프로필.md)에 따라 프로필을 만들고 `AHMATDA_DOMAIN`을 새 ID와 버전으로 지정한 뒤 앱을 다시 빌드한다. 기존 카드는 작성 시 적용한 프로필 버전을 유지한다.

## 5. 데이터 보관과 백업

Compose의 `app-data` 볼륨은 컨테이너의 `/data`에 연결된다. 같은 Compose 프로젝트를 다시 띄우면 볼륨을 재사용한다. `docker compose down -v`는 해당 볼륨을 삭제한다.

| 경로 | 데이터 |
|---|---|
| `accounts.sqlite` | 계정과 작업공간 |
| `workspaces/<작업공간 ID>/` | 통화·카드·일감 SQLite DB, 변환한 WAV 파일 등 작업공간 데이터 |
| `callnote.sqlite` · `audio/` | 기존 단일 DB와 오디오 또는 공개 데모 데이터 |
| `outbox/` | 주소 인증과 비밀번호 재설정의 임시 링크 |

DB와 오디오의 같은 시점을 남기려면 앱을 잠시 멈추고 **볼륨 전체**를 백업한다. 백업 파일은 가동 서버와 별도로 암호화해 보관한다. 환경 파일이 필요하면 자격 증명 보관소에 별도로 저장한다.

```sh
umask 077
backup="ahmatda-data-$(date +%Y%m%d-%H%M%S).tar.gz"
docker compose --env-file src/app/.env stop app
docker compose --env-file src/app/.env run --rm --no-deps -T --user 0 app \
  tar -C /data -czf - . > "$backup"
tar -tzf "$backup" >/dev/null
docker compose --env-file src/app/.env up -d --wait
```

복원은 새 Compose 프로젝트와 빈 볼륨에 한다. 아래의 `backup`에는 복구할 백업 파일 경로를 지정한다. 같은 포트를 써야 하는 경우 기존 앱을 먼저 멈춘다.

```sh
docker compose -p ahmatda-restore --env-file src/app/.env run --rm --no-deps -T --user 0 app \
  tar -C /data -xzf - < "$backup"
docker compose -p ahmatda-restore --env-file src/app/.env up -d --wait
curl -fsS http://127.0.0.1:5600/healthz
```

로그인해서 통화·카드·녹음이 열리는지 확인한다. 복원본이 가동 중인 상태에서 기존 프로젝트를 시작할 경우 포트와 리버스 프록시 연결을 먼저 확인한다.

## 6. 업그레이드

업그레이드 전 앱 커밋과 환경설정을 기록하고 5절의 방식으로 백업한다. 새 커밋을 체크아웃한 뒤 한 번에 하나의 앱 컨테이너를 실행한다.

```sh
GIT_COMMIT="$(git rev-parse HEAD)" docker compose --env-file src/app/.env up -d --build --wait
curl -fsS http://127.0.0.1:5600/healthz
```

`/healthz`는 서버와 SQLite 연결을 확인한다. 이어 로그인·카드 열기·녹음 재생을 확인한다. 업그레이드 중 DB가 바뀐 경우에는 이전 버전과 그 시점의 볼륨 백업으로 함께 복구한다.

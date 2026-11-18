> AI 초안 · 돌린 사람: 신*림 · Codex · 2026-11-18

# 아맞다 Mac 앱

같은 웹 화면을 macOS 창에서 연다. 기본 실행은 이 Mac의 Node 24와 SQLite를 사용한다. 로그인, 통화 업로드·조회, 주문 카드와 배송 처리는 로컬 워크스페이스에서 이루어진다. 파일 받아쓰기는 별도로 준비한 faster-whisper CPU 일꾼이 맡고, 주문 카드 초안·질문 답변은 Ollama가 `qwen3:4b`로 처리한다.

> 검증 상태: Apple Silicon 빌드·ad hoc 서명·번들 소스와 의존성·Node/SQLite 초기화·부모 종료 연동을 확인했다. Mac 앱 실제 기동·로그인 화면·준비 상태 안내와 버튼 동작을 확인했다. 실제 qwen3:4b와 앱 adapter로 가짜 주문 1건 추출도 확인했다(약 2.1초). 새 사용자 설치 전체 흐름·파일 선택·Whisper 전사·전체 주문 파이프라인은 별도 검증 대상이다. 아래 모델 준비와 오프라인 확인은 설치 후 수행할 절차다.

터미널 없는 일반 사용자 설치와 모델 준비의 목표·미구현 범위는 [Mac 릴리즈 계획](mac-release-plan.md)을 따른다. 현재 문서는 개발 검증용 수동 경로다.

## 소스에서 빌드하고 설치하기

macOS 14 이상과 Xcode Command Line Tools가 필요하다. 앱은 빌드한 Mac의 아키텍처에 맞춰 만든다. 빌드에는 Node 24 공식 바이너리와 그 배포본의 `LICENSE`를 사용한다. 시스템 라이브러리만 참조하는 Node를 앱에 복사하므로 실행하는 Mac에는 별도 Node 설치가 필요 없다. 배포 서명과 공증은 준비 단계다. 아래에서 만드는 로컬 빌드에는 ad hoc 서명을 사용한다.

```sh
# 최초 빌드 준비. npm 패키지가 없는 경우 실행한다.
(cd src/app && npm ci)

# 빌드. npm 패키지와 Node가 설치되어 있으면 네트워크 연결이 필요 없다.
bash src/mac-app/build.sh

# 앱이 열려 있으면 ⌘Q로 종료한 다음 복사한다.
mkdir -p "$HOME/Applications"
ditto out/Ahmatda.app "$HOME/Applications/Ahmatda.app"
open "$HOME/Applications/Ahmatda.app"
```

Node를 `PATH` 밖에 설치했거나 그 배포본의 `LICENSE`가 `bin`의 상위 디렉터리에 없으면 두 경로를 지정한다.

```sh
AHMATDA_NODE_BINARY=/path/to/node24/bin/node \
AHMATDA_NODE_LICENSE=/path/to/node24/LICENSE \
bash src/mac-app/build.sh
```

빌드 결과물은 `out/Ahmatda.app`에 둔다. `.env`, SQLite, 로컬 녹음, 사용자 파일, Ollama와 Whisper 모델은 번들에 포함하지 않는다. 녹음 파일 업로드에는 `ffmpeg`와 `ffprobe`가 필요하다. 실행기는 `/opt/homebrew/bin`과 `/usr/local/bin`을 포함한 고정 경로에서 두 명령을 찾는다.

## 이 Mac 모드

1. 앱을 열어 창 제목의 **이 Mac**을 확인한다. 앱은 `127.0.0.1:5601`에서만 듣고, 기본 자체 운영 서버 포트 `5600`과 별개로 동작한다. 로컬 서버가 기동하고 `/healthz`가 정상일 때 업무 화면을 연다.
2. 회원가입 후 메뉴의 **이동 → 로컬 자료 폴더 열기**에서 `data/outbox`를 연다. 최근 `verify` JSON의 `url` 값을 복사한다. **이동 → 링크 열기**(⌘L)에 붙여 넣어 인증을 마친다. 인증 메일은 이 Mac에 파일로 저장된다.
3. 로그인하여 워크스페이스를 만든다. 계정과 워크스페이스, 통화, 녹음과 카드는 `~/Library/Application Support/Ahmatda/data`에 저장된다. 앱을 종료하거나 업데이트해도 이 자료는 남는다.

앱은 로컬 노드 서버에 유료 AI를 끈 상태와 빈 API 키를 전달한다. Mac 앱은 기존 데모 서버나 원격 GPU 일꾼에 연결하지 않는다. ⌘Q로 앱을 닫으면 같이 시작한 Node 서버가 종료된다. Ollama와 CPU 일꾼은 따로 시작하고 종료한다. 앱의 기동·상태 로그는 Console에서 `org.ininhyeop.t07.ahmatda`로 검색한다.

### 로컬 AI 준비 상태

앱이 켜지면 로컬 AI 상태를 먼저 표시한다. **이동 → 로컬 AI 준비 상태**에서도 다시 확인할 수 있다. Ollama 연결 안 됨, 설정 모델 없음, 설치 확인, AI 꺼짐을 구분한다. `127.0.0.1:11434/api/tags`만 조회하며 리다이렉트는 따르지 않는다. 설치 확인은 실제 추론 성공을 뜻하지 않는다.

**수동 업무 계속**으로 모델 없이 업무 화면을 사용할 수 있다. **모델 준비 안내**는 현재 개발용 수동 준비 방법을 설명한다. 전사 일꾼 상태 검증·일반 사용자 전체 설치 마법사는 아직 제공하지 않는다. 주문 모델 파일 준비는 아래의 별도 메뉴를 사용한다.

준비 상태 판정의 회귀 테스트:

```sh
swiftc src/mac-app/LocalModelStatus.swift src/mac-app/tests/main.swift -o /tmp/ahmatda-model-status-tests
/tmp/ahmatda-model-status-tests
```

### Ollama 준비와 사용

Ollama를 설치한다. 이미 Ollama 앱이나 데몬이 실행 중이면 종료한 뒤 터미널에서 아래처럼 실행한다. 모델은 최초 한 번 따로 내려받는다. [Ollama macOS 설치](https://docs.ollama.com/macos) · [Ollama 로컬 모드](https://docs.ollama.com/faq#how-do-i-disable-ollamas-cloud-features)

```sh
# 터미널 1. 전용 로컬 모델 서버를 켜 둔다.
OLLAMA_HOST=127.0.0.1:11434 OLLAMA_NO_CLOUD=1 ollama serve
```

```sh
# 터미널 2. 연결된 상태에서 모델을 한 번 준비한다.
OLLAMA_HOST=127.0.0.1:11434 ollama pull qwen3:4b
OLLAMA_HOST=127.0.0.1:11434 ollama list
```

아맞다 창에서 통화 원문으로 카드를 생성하거나 업무 질문을 보낸다. 모델을 준비하지 않았거나 Ollama가 꺼져 있으면 AI 처리 시 로컬 모델 연결·설치 오류가 표시된다. 로그인, 데이터 조회, 수동 편집은 사용할 수 있다.

로컬 AI를 끄려면 **로컬 자료 폴더 열기**에서 `ai.json` 파일을 `{"provider":"off"}`로 저장하고 앱을 다시 시작한다. 설치한 다른 Ollama 모델을 쓰려면 `{"provider":"ollama","model":"qwen3:4b"}`의 모델 값을 그 이름으로 바꾼다. 앱은 이 파일에서 `off`와 로컬 `ollama` 설정만 읽는다.

### CPU 받아쓰기 일꾼 준비와 사용

1. Python 3 가상환경을 로컬 앱 자료 폴더 아래에 만든다. 최초 설치와 모델 받기는 네트워크가 연결된 터미널에서 실행한다. `small`은 한국어를 지원하는 모델이며 Mac 일꾼은 CPU `int8`로 실행한다. [faster-whisper CPU 실행 예제](https://github.com/SYSTRAN/faster-whisper#faster-whisper)

   ```sh
   ahmatda_local="$HOME/Library/Application Support/Ahmatda"
   python3 -m venv "$ahmatda_local/whisper-venv"
   "$ahmatda_local/whisper-venv/bin/python" -m pip install 'faster-whisper>=1.2,<2' numpy
   "$ahmatda_local/whisper-venv/bin/python" -c \
     'import sys; from faster_whisper import download_model; download_model("small", output_dir=sys.argv[1])' \
     "$ahmatda_local/whisper-small"
   ```

2. 로그인하여 워크스페이스를 만든 상태에서 작업공간 ID를 확인한다. 한 번 만든 토큰을 앱과 CPU 일꾼에서 같이 쓴다. 다음 명령은 토큰 내용을 터미널에 출력하지 않는다. `ws_`로 시작하는 실제 로컬 작업공간 ID를 입력한다.

   ```sh
   /usr/bin/sqlite3 "$ahmatda_local/data/accounts.sqlite" 'SELECT id, name FROM workspaces;'
   printf '로컬 작업공간 ID: '
   read -r ahmatda_workspace
   (umask 077; printf 'WORKER_WORKSPACE_ID=%s\nWORKER_TOKEN=%s\n' \
     "$ahmatda_workspace" "$(openssl rand -hex 32)" > "$ahmatda_local/worker.env")
   chmod 600 "$ahmatda_local/worker.env"
   ```

3. 아맞다를 ⌘Q로 끝내고 다시 연 뒤 같은 워크스페이스를 선택한다. 별도 터미널에서 아래처럼 일꾼을 실행한다. 모델에는 내려받은 디렉터리의 전체 경로를 지정한다. `HF_HUB_OFFLINE=1`은 실행 중 Hugging Face 연결을 끈다.

   ```sh
   ahmatda_local="$HOME/Library/Application Support/Ahmatda"
   ahmatda_app="$HOME/Applications/Ahmatda.app"
   env -u SERVER_URL -u WORKER_TOKEN -u INGEST_TOKEN \
     CALLNOTE_SECRETS_DIR="$ahmatda_local" CALLNOTE_AGENT_HOME="$ahmatda_local/worker" \
     HF_HUB_OFFLINE=1 "$ahmatda_local/whisper-venv/bin/python" \
     "$ahmatda_app/Contents/Resources/pc-agent/callnote_agent.py" worker \
     --server http://127.0.0.1:5601 --env-file "$ahmatda_local/worker.env" \
     --name mac-cpu --device cpu --model "$ahmatda_local/whisper-small"
   ```

4. 앱에서 가짜 음성 녹음을 업로드한다. 받아쓴 글이 저장되면 초안 카드를 생성하여 확인한다. 받아쓰기는 파일 업로드 경로에서 확인한다. 웹 화면의 마이크 실시간 받아쓰기는 WebKit의 음성 인식 지원을 따른다.

## 오프라인 확인

1. Ollama 목록에 `qwen3:4b`가 있고 Whisper 모델 자료와 Python 환경이 준비됐는지 확인한다.
2. 인터넷을 끊고 두 모델 프로세스와 앱을 열어 첫 로그인과 워크스페이스를 확인한다.
3. 가짜 녹음 업로드 → CPU 받아쓰기 → Ollama 카드 생성 → 카드 확정과 배송 상태 변경을 차례로 확인한다. 질문 답변도 한 번 보낸다.
4. 앱을 다시 열고 통화·카드를 확인한다. Ollama를 종료한 상태에서도 업무 화면과 수동 카드 편집에 접근하고, 모델 요청에 연결 오류가 표시되는지 확인한다.

## 서버 모드

아맞다를 종료한 뒤 HTTPS 주소를 지정하여 앱을 연다. 창 제목에 **서버**와 호스트가 표시된다. 로그인과 업무 자료는 지정한 서버에 저장된다. 이 모드에서 앱은 로컬 Node나 모델을 시작하지 않으며, 로컬 모드의 로그인 세션과 분리된 웹뷰를 사용한다. 저장소가 제공하는 원격 설치와 실행은 [자체 운영 가이드](self-hosting.md)를 따른다.

```sh
open "$HOME/Applications/Ahmatda.app" --args --server https://your-ahmatda.example
```

## 실모델 검증 기록 (2026-11-18)

공식 Ollama 0.40.16과 qwen3:4b Q4_K_M을 앱 전용 경로에 준비하고 Metal에서 가짜 부품 주문을 추출했다. 앱의 실제 `ai-ollama.mjs`를 사용했으며 유료 제공자는 호출하지 않았다. 모델 약 2.50GB, 추론 메모리 약 3.18GB, 단일 응답 약 2.1초였다. 이는 일반 성능 보장이나 음성 전사 검증이 아니다.

[가짜 입력 실추론 결과](../work/03-개발-태림/자료/e2e-v16-resume-20261118/real-local-model-fake-input.json)에 버전·해시·범위를 기록했다. [Ollama 라이선스](https://github.com/ollama/ollama/blob/main/LICENSE)는 MIT, [Qwen3-4B 모델](https://huggingface.co/Qwen/Qwen3-4B)은 Apache-2.0이다.

모델을 이미 준비한 개발자는 다음으로 재현한다. 다운로드나 서버 자동 시작은 하지 않는다.

```sh
node src/mac-app/tests/real-local-model.mjs --run-real-local-model
```

클라우드 기능을 끈 loopback Ollama를 사용했다. OS 네트워크 자체를 차단한 오프라인 시험은 아직 하지 않았다. 앱 메뉴에서도 모델 설치 확인을 실제로 표시했다.

## 주문 모델 준비 메뉴 (개발 검증용)

**이동 → 주문 정리 모델 준비**에서 qwen3:4b의 출처·약2.50GB·Apache-2.0 안내를 보고 시작한다. 공식 배포 서버의 고정 모델 파일을 받아 해시를 검증한다. 이미 정상 설치된 파일은 재사용한다. 기존 모델을 바꾸는 경우 manifest를 백업하고, 실패·취소 시 임시 파일을 정리한다. 녹음·원문·사용자 자격증명은 보내지 않는다.

앱 전용 Ollama0.40.16 CLI 파일의 크기·해시가 일치해야 시작한다. 이것은 전체 런타임 라이브러리 검증이나 서버 실행 확인이 아니다. **런타임 자동 설치·서버 자동 시작·받아쓰기 모델 준비는 아직 포함하지 않는다.**

- 기본 CLI `node src/mac-app/setup-local-model.mjs --status`는 읽기 검사만 한다. `--prepare`를 명시해야 파일을 받는다.
- 공식 registry와 그 응답이 지목하는 고정 CDN호스트·digest경로만 허용한다. HTTP·임의 호스트·자격증명·무제한 리다이렉트는 거절한다.
- 기존 손상 blob을 자동 덮어쓰지 않는다. 강제종료 후 남은 lock도 자동 삭제하지 않는다. 문제가 있으면 자료를 확인한 뒤 복구해야 한다.
- 파일 중간부터 이어 받기는 아직 없다. 실패한 파일은 다시 받는다.
- 13개 회귀·실제 공식 config487B 다운로드·기존 모델 해시검사·Mac 실제 메뉴→준비 완료까지 검증했다. 이 helper로2.50GB를 처음부터 받는 전체 시험은 아직 하지 않았다.

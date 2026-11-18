> AI 초안 · 돌린 사람: 신*림 · Codex · 2026-11-18

# 아맞다 Mac 앱

같은 웹 화면을 macOS 창에서 연다. 기본 실행은 이 Mac의 Node 24와 SQLite를 사용한다. 준비된 앱 전용 Ollama는 11435에서 앱과 함께 시작·종료한다. 로그인, 통화 업로드·조회, 주문 카드와 배송 처리는 로컬 워크스페이스에서 이루어진다. 파일 받아쓰기는 별도로 준비한 faster-whisper CPU 일꾼이 맡고, 주문 카드 초안·질문 답변은 Ollama가 `qwen3:4b`로 처리한다.

> 검증 상태: Apple Silicon 빌드·ad hoc 서명·번들 소스와 의존성·Node/SQLite 초기화·부모 종료 연동을 확인했다. Mac 앱 실제 기동·로그인 화면·준비 상태 안내와 버튼 동작을 확인했다. 실제 qwen3:4b와 앱 adapter로 가짜 주문 1건 추출도 확인했다(약 2.1초). 실제 Whisper와 HTTP 업로드·큐·카드 저장·브라우저 표시도 합성음성1건으로 확인했다. 새 사용자 설치 전체 흐름·파일 선택·상시워커 운영·현장 음성 품질은 별도 검증 대상이다. 아래 모델 준비와 오프라인 확인은 설치 후 수행할 절차다.

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
2. 회원가입 후 **이동 → 로컬 가입 인증 링크 열기**에 가입 이메일을 적는다. 유효한 로컬 인증 화면을 열며 암호 확인은 웹 화면에서 직접 진행한다. 터미널이나 outbox 파일 복사는 필요 없다. 외부 메일 인증이 아닌 이 Mac의 개발용 outbox 방식이며, 서버 로그인·암호·1회용 링크 검사는 그대로 유지한다.
3. 로그인하여 워크스페이스를 만든다. 계정과 워크스페이스, 통화, 녹음과 카드는 `~/Library/Application Support/Ahmatda/data`에 저장된다. 앱을 종료하거나 업데이트해도 이 자료는 남는다.

앱은 로컬 노드 서버에 유료 AI를 끈 상태와 빈 API 키를 전달한다. Mac 앱은 기존 데모 서버나 원격 GPU 일꾼에 연결하지 않는다. ⌘Q로 앱을 닫으면 같이 시작한 Node 서버가 종료된다. 준비된 앱 전용 Ollama는 앱이 시작·종료하며 CPU 일꾼은 아직 별도로 시작한다. 앱의 기동·상태 로그는 Console에서 `org.ininhyeop.t07.ahmatda`로 검색한다.

### 로컬 AI 준비 상태

앱이 켜지면 로컬 AI 상태를 먼저 표시한다. **이동 → 로컬 AI 준비 상태**에서도 다시 확인할 수 있다. Ollama 연결 안 됨, 설정 모델 없음, 설치 확인, AI 꺼짐을 구분한다. `127.0.0.1:11434/api/tags`만 조회하며 리다이렉트는 따르지 않는다. 설치 확인은 실제 추론 성공을 뜻하지 않는다.

**수동 업무 계속**으로 모델 없이 업무 화면을 사용할 수 있다. **모델 준비 안내**는 현재 개발용 수동 준비 방법을 설명한다. 전사 일꾼 상태 검증·일반 사용자 전체 설치 마법사는 아직 제공하지 않는다. 주문 모델 파일 준비는 아래의 별도 메뉴를 사용한다.

준비 상태 판정의 회귀 테스트:

```sh
swiftc src/mac-app/LocalModelStatus.swift src/mac-app/tests/main.swift -o /tmp/ahmatda-model-status-tests
/tmp/ahmatda-model-status-tests
```

### 앱 전용 Ollama 실행기

앱 자료 폴더의 `runtime/ollama-v0.40.16`에 준비된 공식 실행기를 사용한다. **실행기 네트워크 다운로드는 하지 않는다.** Ollama 포함 빌드라면 앱 안의 검증된 실행기를 첫 실행에 앱 전용 폴더로 설치한다. 기본 소스 빌드는 포함 옵션이 없으면 기존 설치가 필요하다. 감독기는 고정46파일·10개 라이브러리 링크를 검증하고, 포트 충돌이 없을 때 자기 자식만 시작한다. 다운로드된 실행파일을 임의로 교체하거나 보안 설정을 낮추지 않는다.

- 앱 전용 주소는 `127.0.0.1:11435`다. 일반 Node서버의 기본 Ollama11434는 바꾸지 않는다.
- 자기 자식의 시작 신호와 정확한 버전 응답을 확인한 뒤에만 앱 AI를 활성화한다.
- 준비 실패·충돌이면 이번 실행을 AI off 수동모드로 시작한다. 사용자의 다른 모델 서버는 종료·수정하지 않는다.
- 정상 실행 후 감독기가 죽으면 업무 서버도 멈춰 다른 프로세스로 원문을 보내지 않게 한다.
- 앱 종료 시 자기 프로세스 그룹만 정리한다. 클라우드는 꺼져 있고 모델 경로는 앱 전용이다.
- 검증15초·기동15초, 종료 약3초 상한. 앱은 이 준비 이후 업무 서버를 연다.

이 Mac에서 실제 앱 기동→11435 실추론→앱 종료→5601/11435해제를 확인했으며, 기존11434는 유지됐다.

로컬 AI를 끄려면 자료 폴더의 `ai.json`에 `{"provider":"off"}`를 저장한다. 다른 로컬 모델은 `{"provider":"ollama","model":"모델이름"}`으로 선택한다. 클라우드 모델은 허용하지 않는다. 설정파일을 바꾼 뒤 앱을 다시 연다.

### CPU 받아쓰기 일꾼 준비와 사용

1. Python 3 가상환경을 로컬 앱 자료 폴더 아래에 만든다. 최초 설치와 모델 받기는 네트워크가 연결된 터미널에서 실행한다. `small`은 한국어를 지원하는 모델이며 Mac 일꾼은 CPU `int8`로 실행한다. [faster-whisper CPU 실행 예제](https://github.com/SYSTRAN/faster-whisper#faster-whisper)

   ```sh
   ahmatda_local="$HOME/Library/Application Support/Ahmatda"
   python3 -m venv "$ahmatda_local/whisper-venv"
   "$ahmatda_local/whisper-venv/bin/python" -m pip install 'faster-whisper==1.2.1' 'numpy==2.5.5'
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

앱 전용 Ollama0.40.16 CLI 파일의 크기·해시가 일치해야 시작한다. 이것은 전체 런타임 라이브러리 검증이나 서버 실행 확인이 아니다. Ollama 포함 개발 빌드는 첫 실행 때 런타임을 설치한다. 앱이 실행기를 시작하기 전에는 별도 감독기가 전체 파일 무결성과 자기 서버 상태를 추가로 검증한다. 받아쓰기 모델은 별도 메뉴로 준비한다.

- 기본 CLI `node src/mac-app/setup-local-model.mjs --status`는 읽기 검사만 한다. `--prepare`를 명시해야 파일을 받는다.
- 공식 registry와 그 응답이 지목하는 고정 CDN호스트·digest경로만 허용한다. HTTP·임의 호스트·자격증명·무제한 리다이렉트는 거절한다.
- 기존 손상 blob을 자동 덮어쓰지 않는다. 강제종료 후 남은 lock도 자동 삭제하지 않는다. 문제가 있으면 자료를 확인한 뒤 복구해야 한다.
- 파일 중간부터 이어 받기는 아직 없다. 실패한 파일은 다시 받는다.
- 13개 회귀·실제 공식 config487B 다운로드·기존 모델 해시검사·Mac 실제 메뉴→준비 완료까지 검증했다. 이 helper로2.50GB를 처음부터 받는 전체 시험은 아직 하지 않았다.

## 음성부터 카드까지 검증

가짜 합성음성의 실제 Whisper 전사→HTTP 결과 API→Qwen 카드→SQLite→브라우저 화면을 확인했다. 원문에 없는 거래처·차종 생성 결함을 발견해 사후검증에서 비우고 확인 경고를 표시하도록 보완했다. [범위·결과·재현](../work/03-개발-태림/산출물/v1.6-실제음성-주문카드-검증.md)을 확인한다. 실제 전화 품질과 일반 사용자 설치 완성을 뜻하지 않는다.

## 받아쓰기 모델 준비 메뉴

**이동 → 받아쓰기 모델 준비**는 공식 Systran/faster-whisper-small의 고정revision4파일 약486MB를 내려받아 각각 SHA256을 검증한다. 신규 파일을 모두 확인한 뒤 디렉터리 단위로 반영한다. 실패·취소 때 정상 모델은 유지하고, 기존 불완전 디렉터리를 자동 삭제하거나 덮어쓰지 않는다. 실행기/Python/pip는 설치하거나 실행하지 않는다.

별도 빈 폴더에서486,212,372B 전체 신규 다운로드·4파일 해시·완료 상태를 확인했고, 실제 Mac 메뉴의 기존 설치 재확인도 통과했다. 상태의 `runtimePresent`는 파일 존재만 뜻하며 실행기 무결성·전사 성공으로 표시하지 않는다. 이어받기는 미지원이다.

## 검증과 배포 경계

- Swift 상태/인증링크14개, 실행기 감독기/설치19개, Whisper준비10개, 주문모델준비13개 회귀 통과.
- 실제 Mac 자동AI기동·실추론·종료정리, Whisper준비 메뉴, 없는 가입링크 안전처리 확인.
- 성공 가입 링크의 파서는 테스트했지만 실제 새 사용자 가입 전체를 네이티브앱으로 끝낸 것은 아니다. 기존 웹 가입 E2E와 별개다.
- 신규Mac 전체설치, 전사 실행기 설치/자동일꾼, 재개·복구, 현장 음성평가는 남아 있다.
- 이 컴퓨터에서 외부배포용 **Developer ID Application 인증서0개**를 확인했다. ad hoc검증은 완료했지만 정식서명·공증은 진행하지 않았다. 인증서 발급·계정변경·보안우회도 하지 않았다.

## Ollama를 포함한 개발용 앱 빌드

이미 준비된 공식 런타임을 확인하고 넣는다. 빌드 과정의 네트워크 다운로드는 없다. 원본 바이너리와46파일·10개 라이브러리 링크를 고정해시로 확인하며 라이선스·고지도 함께 넣는다. 런타임 원본 서명을 변경하지 않고 최상위 앱을 ad hoc 서명한다.

```sh
AHMATDA_BUNDLE_OLLAMA=1 bash src/mac-app/build.sh
```

기본 소스는 앱 자료 폴더의 `runtime/ollama-v0.40.16`이다. 개발자는 `AHMATDA_OLLAMA_RUNTIME`으로 같은 공식파일 디렉터리를 지정할 수 있다. 어떤 경로여도 고정해시 검증을 통과해야 한다. `.tgz` 보관본은 앱에 넣지 않는다.

첫 실행 시 설치 대상이 없으면 번들 원본 검사→임시폴더 복사→재검증→반영한다. 기존 정상 또는 손상 폴더는 덮어쓰지 않는다. lock·디스크여유·취소·심볼릭링크·쓰기권한 검사를 수행한다. 일반 동시실행은 보호하지만 동일 사용자의 적대적인 검사/rename 사이 경로교체까지 보장하는 OS원자성은 아니다.

빈 임시저장소에 실제 공식런타임 설치·전체재검증·재실행 보존을 확인했다. 이것은 새 Mac 전체설치 시험과 다르다. Ollama 포함 빌드의 앱서명 검사는 통과했지만 DeveloperID서명·공증은 아니다. Python/Whisper는 아래 별도 선택 플래그로 포함할 수 있다.

## 이동 가능한 받아쓰기 실행기 준비 (개발자용)

개인 Python 또는 venv를 복사하지 않고 공식 Astral python-build-standalone CPython3.12.16과 고정된24개 wheel로 별도 실행기를 만든다. 다운로드 약84.24MB, 설치 후 약290MB이며 모델486MB는 별도다. 유료 API·전역 Python 변경·소스 패키지 빌드를 하지 않는다.

```sh
# 기본은 읽기 검사만 한다.
node src/mac-app/prepare-whisper-runtime.mjs --status
# 개발자가 명시적으로 실행할 때만 공식 파일을 받아 준비한다.
node src/mac-app/prepare-whisper-runtime.mjs --prepare-development-runtime
```

앱 자료 폴더의 `runtime/whisper-portable-3.12.16`에 설치한다. 고정 SHA256·크기 확인 후 오프라인 wheel 설치와 의존성 검사를 실행한다. 기존 폴더는 덮어쓰지 않고 실패·취소 시 임시 파일을 정리한다. 개인 Python 경로에 의존하지 않으며 지원 진입점은 `python/bin/python3.12 -I`다. pip 등 생성된 콘솔 스크립트의 shebang은 준비 당시 경로이므로 이동 후 사용하지 않는다.

설치 후 기록하는 파일 목록은 변경 탐지용이다. 공급자 서명이나 독립적인 배포 인증을 대체하지 않는다. `inferenceVerified:false`는 설치만으로 전사 성공을 주장하지 않는 표시다. 각 배포본·wheel의 라이선스 파일을 보존하며 전체 재배포 고지·서명·공증 검토는 남아 있다. 별도 선택 빌드로 Mac 앱에 포함할 수 있다. 앱 메뉴 연결·자동 일꾼 인증/시작은 별도 단계다.

실제 helper로84,241,226B를 모두 신규 다운로드하고 빈 폴더 설치·경로 이동 뒤 Python격리모드에서3.7초 가짜음성을 전사했다. 첫 모델 로드9.75초, 전사1.7초였으며 원문과 같았다. [검증 기록](../work/03-개발-태림/자료/real-local-audio-20261118/portable-whisper-fake-input.json). helper11개 회귀 통과. 이 결과는 앱 자동 설치나 실전화 품질을 뜻하지 않는다.

## 전사 실행기 포함 개발 빌드

```sh
AHMATDA_BUNDLE_OLLAMA=1 AHMATDA_BUNDLE_WHISPER=1 bash src/mac-app/build.sh
```

이미 준비된 `runtime/whisper-portable-3.12.16`을 검사해 앱에 포함한다. `AHMATDA_WHISPER_RUNTIME`으로 같은 준비 도구가 만든 경로를 지정할 수 있다. 빌드 중 네트워크 다운로드·pip 실행·전역 설치는 하지 않는다. 모델 파일과 사용자 자료는 포함하지 않는다.

번들의 `install-whisper-runtime.mjs --install-from-bundle`은 전용 private 자료 폴더로 복사·재검증하며 기존 정상 또는 손상 설치를 덮어쓰지 않는다. 기본 `--status`는 읽기 확인이다. 설치helper9개 회귀와 실제 포함빌드·ad hoc검사·빈 폴더 설치·격리Python import를 확인했다. [증거](../work/03-개발-태림/자료/real-local-audio-20261118/whisper-bundle-install.json). 이 단계는 자동 일꾼 등록이나 신규 Mac 전체 설치 검증과 다르다.

> AI 초안 · 돌린 사람: 신*림 · ChatGPT dot · 2026-11-18

# Mac 개발 패키지 배포 점검

**현재는 외부 배포 완료판이 아니다.** 같은 Mac(macOS26.6.1)의 개발 시험과 실제 신규Mac 설치를 구분한다. 계정·인증서 발급, 보안 설정 완화, 배포는 수행하지 않았다.

## 확인한 것

- ZIP 무결성과 `codesign --verify --deep --strict` 통과. 서명은 ad hoc이며 TeamIdentifier가 없다.
- c7dcf23 ZIP을 새 임시폴더에 풀고 빈 HOME·시스템 PATH만 둔 환경에서 번들 Node 서버, Python 패키지 import, FFmpeg/ffprobe, 로컬 폰트 응답과 서버 종료를 확인했다. 실물 신규Mac 시험은 아니다.
- 구성요소의 실제 dylib 로드 명령에서 비시스템 절대경로 의존성을 찾지 못했다. `/DLC` 문자열은 일부 라이브러리의 자체 install-name이며 그 자체를 외부 로드 의존성으로 보지 않는다.
- 앱 안에 사용자 `.env`, SQLite, outbox, worker.env, capability, 모델가중치 `model.bin` 패턴이 없는지 검사했다. 모든 종류의 비밀정보가 없다는 완전한 보증은 아니다.
- 최소 오디오 FFmpeg에 대응 소스·옵션·로그·LGPL고지를 포함했다. 이것은 PyAV에 포함된 별도 FFmpeg의 고지를 대신하지 않는다.

## 배포 차단·추가 확인

| 항목 | 확인 상태 | 필요한 다음 검증 |
|---|---|---|
| Gatekeeper | `spctl`이 Code Signing subsystem 내부 오류를 반환했다 | 허용 판정으로 취급하지 않는다. 정식 서명·공증 후 별도 Mac에서 확인 |
| 최소 OS | 앱 셸14.0, Node13.5, Python11, 최소FFmpeg14.0 선언. Ollama `mlx_metal_v4`의 dylib4개는26.2 | macOS14에서 CPU/다른Metal 대체경로가 되는지 미검증. 전체 지원버전 확정 전14지원 보장 금지 |
| 패키지 원문 고지 | CTranslate24.9.0·FlatBuffers25.12.19·Tokenizers0.23.3 wheel에 원문파일 미발견 | 정확한 공식tag 원문을 별도 `ThirdPartySupplemental`에 추가했다. 전이의존성 전체 고지는 별도 검토 |
| PyAV의 FFmpeg | libavcodec 표시 `LGPL version 3 or later`. configure에는 version3·libx264·libx265, gpl/nonfree 플래그 없음. 실제 x264/x265 dylib 링크/파일 포함 | GPL/nonfree 빌드로 단정하지 않는다. 라이선스 표시와 링크구성, 대응소스/재링크 등 재배포 의무를 별도로 확인 |
| 장기 운영 | 실Whisper10분/online100회 통과. 추가 mock 프로세스 수명관리 회귀 통과 | 수시간·수일, 재부팅·절전·디스크부족·메모리추세, 현장음성 검증 필요 |

Ollama26.2 대상은 `mlx_metal_v4/libjaccl.dylib`, `libmlx.dylib`, `libmlxc.dylib`, `libollama_xgrammar.dylib`이다. 앱의 Info.plist 최소버전을 임의로 바꾸거나 미검증 대체경로를 성공했다고 표시하지 않았다.

## 추가 고지 출처

- [CTranslate2 v4.9.0 LICENSE](https://raw.githubusercontent.com/OpenNMT/CTranslate2/v4.9.0/LICENSE)
- [FlatBuffers v25.12.19 LICENSE](https://raw.githubusercontent.com/google/flatbuffers/v25.12.19/LICENSE)
- [Tokenizers v0.23.3 LICENSE](https://raw.githubusercontent.com/huggingface/tokenizers/v0.23.3/LICENSE)

다운로드 원문의 SHA256은 `src/mac-app/licenses/sources.json`에 기록한다. 원본 wheel과 실행파일을 수정하지 않고 고지만 별도로 포함한다. 정식 재배포 적합성 판단을 끝낸 문서는 아니다.

[빈 HOME 시험 기록](../work/03-개발-태림/자료/real-local-audio-20261118/clean-package-c7dcf23.json). 최신 개발 패키지는 `node src/mac-app/tests/clean-package.mjs --inspect-development-bundle`로 검사하며, 추가원문 고지3개의 해시도 확인한다.

보완 후9097030 개발 ZIP도 동일한 빈 HOME 시험을 통과했고 추가 고지3개의 SHA256을 확인했다. [보완 패키지 기록](../work/03-개발-태림/자료/real-local-audio-20261118/clean-package-9097030.json). 패키지 크기는 약326MB이며 외부배포 차단 항목은 그대로다.


## 공식 근거와 안전한 대안 (2026-11-18 추가 점검)

### macOS 하위호환

[Ollama 공식 macOS 문서](https://docs.ollama.com/macos)는 Sonoma14 이상과 Apple M CPU/GPU를 지원 대상으로 적는다. 이는 제품의 일반 지원 안내이며, 현재 묶은 v0.40.16의 모든 dylib가14에서 로드된다는 검증 결과는 아니다. 현재 Mac26.6.1의 성공을14 실기 성공으로 바꾸어 쓰지 않는다.

[v0.40.16 환경 설정 소스](https://raw.githubusercontent.com/ollama/ollama/v0.40.16/envconfig/config.go)에 `OLLAMA_LLM_LIBRARY`는 존재한다. 그러나 변수의 존재만으로 이 패키지에서 CPU 강제 실행 또는 하위OS 대체경로가 성공한다고 판단하지 않는다. 출처가 다른 NVIDIA GPU 비활성화 예시를 Apple Silicon에 적용하지 않았다.

안전한 현재 대안은 실행기 준비 실패 시 로컬 AI를 끄고 업무 서버를 여는 기존 경로다. `Ahmatda.swift`의 `AI_PROVIDER=off` 분기를 확인했고, 실행기 실패·종료·자식 정리 등을 포함한 Mac helper90개를 다시 통과했다. 이는 mock 기반 실패처리 회귀이며 macOS14에서 앱이 실제로 실행된다는 보증은 아니다. 다음 실기 검증은14·15의 시작, 실제 모델 추론, 실패 시 AI꺼짐, 종료 시 포트 회수다. 최소OS 선언과 vendor 바이너리는 변경하지 않았다.

### PyAV 재배포 대안

[PyAV v19.0.2 설치 문서](https://raw.githubusercontent.com/PyAV-Org/PyAV/v19.0.2/docs/overview/installation.rst)는 자체 FFmpeg8.x에 연결한 소스 빌드를 안내한다. [동일 태그 setup.py](https://raw.githubusercontent.com/PyAV-Org/PyAV/v19.0.2/setup.py)는 avcodec·avdevice·avfilter·avformat·avutil·swresample·swscale을 요구한다. 현재 최소 변환기는 static이며 일부 라이브러리를 제외했으므로 그대로 PyAV 대체재가 되지 않는다.

기술적 후보는 별도 shared FFmpeg에서 GPL/nonfree/version3·외부라이브러리 자동탐지·x264/x265를 끄고 필요한 라이브러리를 유지한 뒤 고정 PyAV 소스로 wheel을 다시 만드는 것이다. 공식 문서의8.x와 현재 wheel의9.x 차이도 컴파일·ABI·실제 전사로 검증해야 한다. 이번 점검에서는 새 바이너리를 만들거나 설치하지 않았다.

[FFmpeg 공식 지침](https://ffmpeg.org/legal.html)은 동적 연결, 바이너리에 정확히 대응하는 소스와 빌드 옵션, 고지 및 외부 라이브러리 검토를 안내한다. [n9.0.2 라이선스 원문](https://raw.githubusercontent.com/FFmpeg/FFmpeg/n9.0.2/LICENSE.md)은 x264/x265를 GPL 외부 라이브러리로 구분한다. 기존 wheel의 LGPL3+ 표기와 실제 링크를 함께 검토해야 하며 gpl 플래그 문자열이 없다는 이유만으로 적합하다고 판정하지 않는다. 자체 빌드도 법적 적합성을 자동 보증하지 않는다.

즉시 가능한 보수적 선택은 `AHMATDA_BUNDLE_WHISPER`를 켜지 않아 해당 실행기를 포함하지 않는 것이다. build.sh 기본값0을 코드로 확인했다. 이 경우 터미널 없는 음성 전사 준비라는 제품 목표를 충족하지 못하므로 완성판으로 안내하지 않는다. 현재 개발 ZIP은 기존 그대로 보존하고 외부 배포하지 않았다.


## 격리 재빌드 검증 결과

공식 FFmpeg9.0.2 소스에서 shared 라이브러리7개를 만들고 PyAV19.0.2를 다시 컴파일했다. GPL/nonfree/version3/x264/x265/자동탐지/네트워크는 비활성화했다. 새 wheel은3,264,750B이며 SHA256은 `b6315114df45bc329ebec6098f3bd48cca1d1453db4c5e4d2d76888131f90f91`이다. 실제 libavcodec 표시는 LGPL2.1+다. x264/x265 파일·로드와 비시스템 절대로드가 없음을 검사했다.

WAV·MP3·M4A 직접 디코딩과 M4A→배열→Whisper 합성음성 전사를 통과했다. Python을 다른 폴더로 옮기고 원래 빌드 라이브러리 경로를 없앤 후에도 동일 전사에 성공했다. 57개 Mach-O 개발 서명 검사가 통과했으나 공증은 아니다. 빌드 도구가 들어 있는 개발 Python 복사본 자체는 배포물이 아니다.

중요한 추가 발견: 기존 제공 wheel과 재빌드 wheel 모두 faster-whisper1.2.1의 `metadata_errors` 인자에서 동일하게 실패한다. 새 바이너리 회귀가 아니다. [PyAV19 API](https://raw.githubusercontent.com/PyAV-Org/PyAV/v19.0.2/av/container/core.py)와 [faster-whisper1.2.1 호출부](https://raw.githubusercontent.com/SYSTRAN/faster-whisper/v1.2.1/faster_whisper/audio.py)를 대조했다. 격리 복사본에서 해당 인자만 제거하면 양쪽3개 포맷이 통과하고 잘못된 입력은 오류가 유지된다. 기존 앱의 WAV→배열 전사 경로는 이미 이 호출을 사용하지 않으며, 기존·재빌드 런타임에서 실제 pc-agent 전사도 통과했다.

증거: [재빌드·이동 시험](../work/03-개발-태림/자료/real-local-audio-20261118/pyav-rebuilt-fake-input.json), [기존 wheel 비교](../work/03-개발-태림/자료/real-local-audio-20261118/compat-vendor-fake-input.json), [새 wheel 비교](../work/03-개발-태림/자료/real-local-audio-20261118/compat-rebuilt-fake-input.json). 기존 앱·지원 런타임·ZIP은 교체하지 않았다. macOS14 실기, 전체 라이선스 의무와 최종 배포 적합성은 미확정이다.


### 앱 호환 경로 반영

vendor 패키지를 덮어쓰지 않고 자체 `decode_audio_compat.py`를 추가했다. `WhisperTranscriber`의 명시적 파일·바이너리 스트림 입력만 PyAV의 지원 API로 디코딩한다. 기존 서버 WAV 검증과 배열 전달은 변경하지 않는다. 입력64MiB/디코딩10분 상한, 로컬파일 제한, 오류 전파를 적용했다. Mac 빌드 복사 목록에 helper를 추가했다.

Python38개, Node171개, Mac helper90개 회귀가 통과했다. 실제 새 helper의 WAV·MP3·M4A·BytesIO 입력과 기존 worker WAV 배열 모두 정확한 합성문장 전사를 확인했다. 빌드에 들어갈 Python 소스2개만 별도 임시폴더로 복사한 staging 검사도 통과했다. 전체 앱 재빌드·사용자 런타임 교체는 하지 않았다.

[실제 앱 API 시험](../work/03-개발-태림/자료/real-local-audio-20261118/repo-compat-result-fake-input.json), [staging 시험](../work/03-개발-태림/자료/real-local-audio-20261118/staged-compat-result-fake-input.json). 재현 도구는 `src/mac-app/tests/real-pyav-compat.py`다. `--run-synthetic-model-test --fixtures <synthetic.wav/mp3/m4a 폴더> --model <이미 준비된 로컬 모델>`을 명시해야 하며 모델 다운로드를 수행하지 않는다.


## 재현 가능한 개발 빌드 도구

`prepare-pyav-wheel.mjs`와 `pyav-build-manifest.json`을 추가했다. 기본/`--status`는 상태만 출력한다. 준비는 다음 명시 명령으로만 수행한다. Python 원본은 내부상대링크를 검증하고 별도 staging에 복사하며 원본 불변을 재검사한다. 기존 출력 디렉터리는 덮어쓰지 않는다.

```sh
node src/mac-app/prepare-pyav-wheel.mjs --status
node src/mac-app/prepare-pyav-wheel.mjs --prepare-development-wheel \
  --python-source /절대경로/기존/python \
  --output /절대경로/새로운/pyav-build-result \
  --pkg-config /절대경로/pkg-config
```

고정 공식 소스2개와 빌드 wheel8개 약20.8MB를 SHA256/크기로 확인한다. archive 경로·링크타입 거절, 원본과 출력 겹침 거절, lock/취소/실패 정리, 출력경합 보존을 검사한다. PyAV 새wheel을 개발 Python 복사본에만 설치해 기존av 제거, 57개 바이너리 아키텍처·의존성·개발서명과 실제 LGPL표시를 감사한다. 결과에는 wheel, 대응소스2개, LGPL/PyAV 원문3개, configure·build·audit로그 및 manifest를 보존한다. 빌드용 Python이나 빌드도구는 결과물에 넣지 않는다.

실제 CLI의 다운로드→컴파일→wheel제작→감사가 성공했고, 새wheel을 또 다른 Python 복사본에 설치하여 staging 앱 소스의3개 포맷·BytesIO·worker WAV 전사를 통과했다. helper103개(새 안전검사13개 포함)도 통과했다. 수동 제작본과 wheel 해시가 달라 **기능적 재현 성공이지 바이트 동일 재현은 아니다.** [증거](../work/03-개발-태림/자료/real-local-audio-20261118/pyav-script-rebuild-fake-input.json).

기존9097030 ZIP과 별도백업의 SHA256이 `c2324131bf44536ff0b8fca1524d64d2adf4c0b98b78e2c32c6f307c784e44dc`로 같음을 확인했다. 기존 앱·지원런타임·기본 WHEELS는 교체하지 않았다. 다음 단계는 새 wheel/대응소스를 검증된 런타임 준비 경로에 편입하고 별도 패키지를 만드는 것이며, 아직 수행하지 않았다. 소스·고지 보존 자체가 모든 법적 의무 충족을 뜻하지 않는다.


## 별도 개발 런타임 편입

`prepare-pyav-runtime.mjs`는 검증된 기본 런타임을 복사하고 그 안의 PyAV만 새wheel로 교체한다. 고정 소스 메타데이터·원본소스 SHA·wheel SHA·구성을 대조하고 설치 후 실제57개 바이너리의 라이선스·로드 의존성·서명을 다시 검사한다. 설치 전후 패키지집합25개가 같아 빌드도구가 들어오지 않았음을 확인했다. 대응소스·원문고지·구성·감사는 `pyav-redistribution`에 포함한다.

```sh
node src/mac-app/prepare-pyav-runtime.mjs --prepare-development-runtime \
  --source-runtime /절대경로/기존/whisper-portable-3.12.16 \
  --wheel-build /절대경로/pyav-build-result \
  --output /절대경로/새로운/alternative-runtime
node src/mac-app/prepare-pyav-runtime.mjs --inspect /절대경로/새로운/alternative-runtime
```

네트워크 없이 동작하며 기존경로·출력을 보존한다. 실패·취소 시 새staging을 정리한다. 기본 런타임을 전환하지 않았으므로 되돌리기는 기존 경로를 계속 사용하는 방식이며, 실제 업데이트 후 복구 기능을 구현했다는 뜻은 아니다. 새 kind는 `development-whisper-pyav-lgpl-v1`이고 기존 설치기·자동 일꾼·앱번들은 이프로파일을 아직 선택하지 않는다.

원본·이동된 대안runtime 모두 inventory 검사와 WAV/MP3/M4A·BytesIO·workerWAV 전사를 통과했다. 실제 제작wheel의 사본1바이트를 바꾼 입력은 설치 전에 checksum 오류로 거절됐다. helper113개(새10개 포함) 통과. [합성음성 증거](../work/03-개발-태림/자료/real-local-audio-20261118/alternative-runtime-fake-input.json).

inventory는 로컬 제작물의 변경 탐지이지 게시자 서명·소스와 바이너리의 암호학적 대응 증명이 아니다. 신뢰한 로컬 빌드 결과만 입력한다. 기본앱·지원runtime·ZIP·WHEELS는 그대로다. 다음 단계는 이프로파일을 선택하는 명시적 개발번들 경로와 별도 패키지의 첫설치/일꾼 수용시험이다. 정식배포·법적적합성·다른Mac 호환성은 여전히 미확정이다.


## 명시적 개발앱 프로파일 연결

기본 프로파일을 바꾸지 않고 별도 `Ahmatda-PyAV-Dev.app` 빌드 경로를 추가했다. 번들의 고정 JSON으로 개발runtime을 선택하고 Swift는 plist와 JSON의 일치를 확인한다. 기본앱은 기존 Ahmatda 자료폴더, 개발앱은 별도 Ahmatda-PyAV-Dev 자료폴더를 사용한다. 모델준비·Ollama·설치기·일꾼 모두 같은 프로파일로 분리했다. 임의 경로·알 수 없는 프로파일은 거절한다.

helper121개, Swift20개, Node171개 통과. 별도개발앱 빌드/ad hoc strict검사 및 번들CLI status에서 dev런타임검증true/기본자료 미사용을 확인했다. 임시 가짜계정·개발번들로 브라우저 연결→실제Whisper 큐 처리→ready→연결해제→일꾼종료를 통과했다. 카드제공자는 fixture이며 실제LLM이 아니다. 전사는 '두 개' 대신 '두개'여서 첫 엄격검사는 실패했고 재시험은 공백 정규화 비교로 통과했다. 원문과 정확일치false를 그대로 보존한다. [증거](../work/03-개발-태림/자료/real-local-audio-20261118/devprofile-managed-worker-fake-input.json).

새 native 개발앱의 GUI를 실제로 열어 가입·모델다운로드·첫업무를 끝내지는 않았다. 기존 앱/ZIP/백업·설치자료를 보존했다. 두 앱은 같은 loopback포트를 쓰므로 동시에 실행하지 않는다. 기본앱 재선택은 기존경로 복귀이며 DB병합·업데이트 복구를 뜻하지 않는다. [명시 빌드 방법](mac-app.md)을 따른다.


## native 개발앱 첫사용 확인

8e5d454의 CI·보안 검사가 모두 통과했다. 실제 개발앱을 열어 별도 자료 창, 실행기 미준비 시 AI꺼짐/수동업무 안내, 로그인→회원가입 이동, 빈 양식의 필수값 검증, 로그인 복귀를 확인했다. 종료 후5601/11435 포트가 해제됐다. 개발 자료폴더에만 빈 DB가 만들어졌고 users/workspaces는 모두0이다.

가입 화면은 새 비밀번호 입력과 이용약관·개인정보 처리방침 동의를 요구한다. 이 단계는 완료하지 않았으며 계정생성·동의·API우회는 하지 않았다. 따라서 nativeGUI 계정→첫 전사 전체를 통과했다고 표시하지 않는다. 다음 단계는 사용자가 테스트 계정 생성·동의 흐름을 직접 완료하거나, 별도로 승인된 기존 테스트 계정을 제공한 뒤 이어가는 것이다. 인증을 제거하는 테스트모드는 추가하지 않는다. [관찰 기록](../work/03-개발-태림/자료/real-local-audio-20261118/native-dev-first-use.json).

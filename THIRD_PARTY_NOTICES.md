# 제3자 구성요소 고지

아맞다 저장소의 프로젝트 소스에는 [MIT 라이선스](LICENSE)를 적용한다. 제3자 구성요소는 각 배포본의 라이선스와 고지를 함께 따른다.

## 웹 서버와 컨테이너

| 구성요소 | 라이선스·고지 위치 |
|---|---|
| Node.js 및 내장 SQLite | [Node.js 라이선스와 구성요소별 고지](https://github.com/nodejs/node/blob/v24.x/LICENSE) |
| Debian 컨테이너 패키지 및 FFmpeg/ffprobe | 컨테이너의 `/usr/share/doc/<패키지>/copyright`. FFmpeg의 경우 `/usr/share/doc/ffmpeg/copyright` |
| `@anthropic-ai/sdk` · `@opentelemetry/api` | Apache-2.0. 설치된 패키지의 라이선스 파일 및 [npm 잠금 파일](src/app/package-lock.json) |
| `@babel/runtime` · `@stablelib/base64` · `json-schema-to-ts` · `standardwebhooks` · `ts-algebra` | MIT. 설치된 패키지의 라이선스 파일 및 [npm 잠금 파일](src/app/package-lock.json) |
| `fast-sha256` | Unlicense. [npm 잠금 파일](src/app/package-lock.json) 및 [패키지 배포처](https://www.npmjs.com/package/fast-sha256) |
| Pretendard JP · Noto Sans KR 웹 글꼴 | [Pretendard 글꼴 고지](https://github.com/orioncactus/pretendard/blob/main/LICENSE) · [Noto Sans KR 글꼴 고지](https://github.com/google/fonts/blob/main/ofl/notosanskr/OFL.txt) |

## 선택 사항

받아쓰기 PC에 별도로 설치하는 구성요소와 모델은 [PC 프로그램 설치 안내](src/pc-agent/README.md)에서 버전과 설정을 확인한다. 고지는 [faster-whisper](https://github.com/SYSTRAN/faster-whisper/blob/master/LICENSE), [CTranslate2](https://github.com/OpenNMT/CTranslate2/blob/master/LICENSE), [Whisper](https://github.com/openai/whisper/blob/main/LICENSE), [NVIDIA CUDA](https://docs.nvidia.com/cuda/eula/) 및 실제로 내려받은 모델의 배포 페이지를 참고한다. Claude는 환경설정으로 연결하는 외부 서비스다.

## Mac 실행기와 로컬 모델 (선택)

모델 가중치는 이 저장소나 앱 빌드에 포함하지 않는다. 모델 최초 다운로드는 앱의 명시 준비 메뉴 또는 설치자가 수행한다. 프로젝트 소스의 MIT와 모델 라이선스를 동일하게 취급하지 않는다.

| 구성요소 | 확인한 고지 | 배포 경계 |
|---|---|---|
| Ollama | [MIT](https://github.com/ollama/ollama/blob/main/LICENSE) | 선택 Ollama 포함 개발 빌드. 공식0.40.16 원본·MIT LICENSE·LLAMA_CPP/MLX/XGRAMMAR 등 배포본 고지를 함께 보존한다. 클라우드 대체 없음 |
| Qwen3-4B | 공식 [모델 카드](https://huggingface.co/Qwen/Qwen3-4B)의 Apache-2.0 | 예제 `qwen3:4b`의 기반 모델. 실제 내려받은 아티팩트의 태그·다이제스트와 고지를 기록해야 한다 |
| faster-whisper | [MIT](https://github.com/SYSTRAN/faster-whisper/blob/master/LICENSE) | 별도 Python 환경. 기존 CPU 경로 사용 |
| Whisper | [MIT](https://github.com/openai/whisper/blob/main/LICENSE) | 실제 사용하는 변환 모델의 모델 카드·고지도 함께 확인한다 |
| 번들 Node.js | [Node.js v24 라이선스](https://github.com/nodejs/node/blob/v24.x/LICENSE) | 실제 배포 Node 버전과 함께 제공된 구성요소 고지를 앱에 포함해야 한다 |

공증·서명·업데이트 및 제3자 아티팩트별 고지 확인은 공개 배포 전 단계다. 현재 소스 빌드가 App Store 또는 서명된 설치 배포 검증을 뜻하지 않는다.

### 이동 가능한 Python 전사 실행기 준비 도구 (개발 전용)

`prepare-whisper-runtime.mjs`는 공식 [Astral python-build-standalone](https://github.com/astral-sh/python-build-standalone/releases/tag/20261110)의 CPython3.12.16과 PyPI 고정 wheel24개를 별도 앱 자료 폴더에 준비한다. 원본 LICENSE 및 wheel의 `dist-info/licenses` 고지는 삭제하지 않는다. Python 배포본에는 자체 종속 구성요소가 있고 PyAV wheel에는 FFmpeg 관련 구성요소가 있으므로 패키지 이름의 단일 라이선스만으로 전체 재배포 조건을 판단하지 않는다. 이 도구와 로컬 전사 검증은 전체 번들의 재배포 고지 검토·Developer ID 서명·공증을 완료했다는 뜻이 아니다. 준비된 실행기는 `AHMATDA_BUNDLE_WHISPER=1` 개발 빌드에 선택적으로 포함하며 원본 고지를 함께 보존한다.

### 선택 오디오 변환기

`AHMATDA_BUNDLE_AUDIO=1`은 [공식 FFmpeg9.0.2](https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz)를 LGPL2.1-or-later 최소 오디오 구성으로 빌드한 ffmpeg/ffprobe를 포함한다. GPL/version3/nonfree, 네트워크, 외부 라이브러리 자동탐지를 끈다. 대응 원본소스·COPYING.LGPLv2.1·LICENSE.md·configure옵션·빌드로그를 `runtime/ffmpeg-audio-9.0.2/redistribution`에 함께 제공한다. [공식 법적 고지](https://ffmpeg.org/legal.html)를 기준으로 최종 재배포 의무를 검토해야 한다. SHA256은 공식 Homebrew소스 메타데이터와 대조했으며 PGP서명은 검증하지 않았다. 앱의 ad hoc검사는 DeveloperID·공증을 뜻하지 않는다.

### 정확한 버전의 추가 원문 고지

CTranslate24.9.0(MIT), FlatBuffers25.12.19(Apache-2.0), Tokenizers0.23.3(Apache-2.0)의 공식tag LICENSE를 `src/mac-app/licenses`와 앱 `ThirdPartySupplemental`에 별도로 포함한다. 출처·해시는 `sources.json`에 기록하며 원본 wheel은 변경하지 않는다. 이는 전체 전이의존성의 고지나 PyAV의 별도 FFmpeg/x264/x265 재배포 의무를 모두 충족했다는 뜻이 아니다. [배포 점검](docs/mac-distribution-audit.md)의 차단 항목을 확인한다.


### 격리 PyAV 개발 wheel

`prepare-pyav-wheel.mjs`의 결과는 기본 앱에 자동 편입되지 않는 개발 산출물이다. 고정 FFmpeg9.0.2·PyAV19.0.2 소스와 LGPL2.1/PyAV 원문 고지, 빌드 옵션·로그·해시를 결과의 `sources`, `logs`, `build-manifest.json`에 보존한다. 새 FFmpeg의 실제 라이선스 표시와 x264/x265 미포함을 검사하지만, 앱 전체 재배포 의무나 특허 검토를 완료했다고 보지 않는다. 빌드도구는 결과물에 포함하지 않는다. [검증 범위와 제약](docs/mac-distribution-audit.md)을 따른다.

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

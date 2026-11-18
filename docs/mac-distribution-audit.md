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

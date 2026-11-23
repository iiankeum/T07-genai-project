# 온프레미스 한국어 음성 인식 모델 비교 — 전화 주문 받아쓰기용

> AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) 조사 에이전트 1개 · 한결(총괄·서버) 작업방 · 조사일 2026-11-11 · 검토: 아직 없음

대상은 자동차 부품 대리점의 주문 전화다. 한국어이고, 8kHz 협대역이다. PC 안에서 돌리는 모델만 본다.

## 0. 읽는 법

- 숫자마다 `[S번호]` 로 출처를 단다. 출처 주소는 맨 끝 「10. 출처」에 있다.
- 블로그는 `(블로그)`, 모델 만든 쪽이 스스로 잰 값은 `(자체 보고)` 로 표시한다.
- 출처에서 숫자를 찾지 못하면 「확인 못 함」이라고 적는다.
- 한국어는 **CER(글자 오류율)** 과 **WER(어절 오류율)** 이 크게 다르다. 같은 모델 · 같은 자료에서 WER 26.75% 가 CER 7.58% 로 나온다 [S21]. WER 과 CER 을 서로 비교하지 않는다.
- 같은 CER 이라도 자료 · 정규화 방법이 다르면 비교할 수 없다. 예를 들어 large-v3 의 FLEURS 한국어 CER 은 OpenAI 그림에서 3.1% [S2], 정규화 없이 모든 분할을 합친 연구에서 7.4% [S19], 다른 모델 카드에서 5.31% [S24] 다.
- 대부분 수치는 2026-11 보다 오래됐다. 측정 시점을 함께 적는다.

## 1. 5줄 요약

1. 한국어 정확도는 large-v3 와 large-v3-turbo 가 가장 좋다(FLEURS CER 3.1% · 3.2%) [S2][S4]. turbo 는 large 보다 약 8배 빠르고 VRAM 약 6GB 라 PC 용으로 균형이 가장 맞다 [S2].
2. 전화 음질에서는 떨어진다. 한 한국어 비교표에서 OpenAI Whisper CER 은 KsponSpeech(대화)에서 12.06%, 저음질 전화망에서 17.27% 였다. 전화 자료로 다듬은 Whisper 는 저음질 전화망에서 4.26% 였다 [S17]. 같은 통화를 8kHz 와 16kHz 로 놓고 잰 한국어 연구는 찾지 못했다.
3. faster-whisper 는 같은 정확도로 최대 4배 빠르다. large-v2 를 int8 로 돌리면 VRAM 2,926MB 로 13분 음성을 59초에 받아쓴다 [S5]. GPU 가 없으면 small 이 현실적이다(13분 음성 1분 42초, RAM 1,477MB) [S5].
4. 무음 꼬리 환각(「시청해주셔서 감사합니다」 등)은 실제로 있다 [S12]. 영어 실험에서 Silero VAD 가 환각을 21.3% 에서 0.2% 로 줄였다 [S10]. VAD · `condition_on_previous_text=False` · 문구 차단 목록을 함께 쓴다. `hotwords` · `initial_prompt` 는 224토큰 안의 힌트일 뿐이다 [S9].
5. NVIDIA Canary · Parakeet 는 한국어가 없다 [S26]. MMS · SeamlessM4T 는 Whisper 보다 정확도가 낮고 비상업 라이선스다 [S30][S31][S19]. 화자 분리는 통화가 2채널로 녹음되면 필요 없다. 섞여 있으면 pyannote community-1 을 붙인다(H100 에서 1시간에 31초, CALLHOME DER 26.7%) [S33].

## 2. 핵심 비교표

| 모델 | 한국어 정확도 | 속도 | 메모리 | 설치 조건 | 출처 |
| --- | --- | --- | --- | --- | --- |
| Whisper tiny (39M) | FLEURS WER 36.1% · KsponSpeech CER 30.90~33.57% | large 대비 ~10배 | VRAM ~1GB · RAM ~273MB(whisper.cpp) | `pip install -U openai-whisper` + ffmpeg | S1 S2 S14 S15 S32 |
| Whisper base (74M) | FLEURS WER 27.8% · KsponSpeech CER 21.12~22.85% | ~7배 | VRAM ~1GB · RAM ~388MB | 같음 | S1 S2 S14 S32 |
| Whisper small (244M) | FLEURS WER 19.6% · KsponSpeech CER 16.75% | ~4배 · CPU 13분 음성 1분 42초(faster-whisper int8) | VRAM ~2GB · RAM 1,477MB(faster-whisper int8) | 같음. CPU 만으로 가능 | S1 S2 S5 S15 |
| Whisper medium (769M) | FLEURS WER 16.4% · KsponSpeech CER 11.94~14.33% | ~2배 | VRAM ~5GB · RAM ~2.1GB(whisper.cpp) | 같음 | S1 S2 S14 S15 S32 |
| Whisper large-v2 (1550M) | FLEURS WER 14.3%(CER 약 3.2%) · KsponSpeech CER 10.83~14.66% | 1배 · faster-whisper fp16 13분→63초 | VRAM ~10GB · faster-whisper fp16 4,525MB / int8 2,926MB | 같음 | S1 S2 S5 S14 S15 |
| Whisper large-v3 (1550M) | FLEURS CER 3.1% · Common Voice 15 CER 5.2% · KsponSpeech other CER 11.13%(블로그) | 1배(README 의 large 행) | VRAM ~10GB | 같음 | S2 S3 S16 |
| Whisper large-v3-turbo (809M) | FLEURS CER 3.2% · CV15 CER 5.6% · Zeroth CER 7.58% · 원격진료 전화(환자) CER 5.32% | ~8배 | VRAM ~6GB | 같음 | S2 S4 S20 S21 |
| faster-whisper(엔진) | 원본과 같은 정확도(README 주장) | 원본 대비 최대 4배 · large-v2 int8 batch 8 로 13분→16초 | large-v2 int8 2,926MB(batch 8 은 4,500MB) | Python 3.9+, GPU 는 CUDA 12 + cuDNN 9 | S5 |
| 한국어 파인튜닝 turbo (ghost613) | Zeroth CER 2.06%(자체 보고) | turbo 와 같은 구조 | turbo 와 같은 구조 | faster-whisper 변환본 있음 · 라이선스 미기재 | S21 |
| 한국어 파인튜닝 turbo (batisay-ko-turbo) | 콜센터 8kHz CER 5.67%(자체 보고) | 확인 못 함 | 확인 못 함 | 매출 10억 원 이상 상업 이용은 별도 문의 | S22 |
| whisper.cpp(엔진) | Whisper 와 같은 가중치 | small CPU 13분→2분 5초(OpenVINO 1분 45초) | small RAM 1,049MB · large ~3.9GB | C/C++ 빌드, 예제는 16비트 WAV | S5 S32 |
| NVIDIA Nemotron 3.5 ASR Streaming 0.6B | FLEURS CER 7.12~7.59% | 확인 못 함 | 확인 못 함 | NeMo 26.06 또는 transformers 5.13+, OpenMDW-1.1 | S28 |
| NVIDIA Nemotron 3.5 Transcribe 30B-A4B | FLEURS CER 2.78% | 확인 못 함 | 배포 목표 H100 80GB 1장 | 데이터센터급 GPU | S29 |
| NVIDIA Canary-1B-v2 · Parakeet-TDT-0.6B-v3 | 한국어 미지원 | — | — | — | S26 |
| Meta MMS (1B) | FLEURS WER 37.3~82.1%(같은 표 Whisper large-v2 14.3%) | 확인 못 함 | 확인 못 함 | CC-BY-NC 4.0(비상업) | S30 |
| Meta SeamlessM4T v2 (2.3B) | FLEURS CER 10.3%(같은 조건 Whisper-v3-Large 7.4%) | 확인 못 함 | 확인 못 함 | CC-BY-NC 4.0(비상업) | S19 S31 |
| pyannote community-1 (화자 분리) | CALLHOME DER 26.7% | H100 에서 음성 1시간당 31초 | 확인 못 함 | HF 토큰 · 이용 조건 동의, 내려받은 뒤 오프라인 실행 | S33 |
| WhisperX (받아쓰기+정렬+화자 분리) | Whisper 와 같음 | large-v2 로 70배 실시간 | GPU 8GB 미만(large-v2, beam 5) | CUDA 12.8 안내, HF 토큰 | S34 |

## 3. Whisper 크기별

### 3.1 크기 · 메모리 · 속도 (OpenAI 공식 README)

| 크기 | 파라미터 | 필요 VRAM | 상대 속도 | CPU 실행 RAM(whisper.cpp) |
| --- | --- | --- | --- | --- |
| tiny | 39M | ~1GB | ~10배 | ~273MB |
| base | 74M | ~1GB | ~7배 | ~388MB |
| small | 244M | ~2GB | ~4배 | ~852MB |
| medium | 769M | ~5GB | ~2배 | ~2.1GB |
| large(v1·v2·v3) | 1550M | ~10GB | 1배 | ~3.9GB |
| turbo(large-v3-turbo) | 809M | ~6GB | ~8배 | 확인 못 함 |

- VRAM · 상대 속도 · 파라미터는 [S2], RAM 은 [S32] 의 표다.
- 상대 속도는 A100 에서 **영어**를 받아쓴 값이다. README 는 언어 · 말 속도 · 장비에 따라 실제 속도가 크게 달라진다고 적는다 [S2].
- turbo 는 large-v3 를 다듬은 모델이다. 디코더를 32층에서 4층으로 줄였다 [S4]. 번역은 학습하지 않았다 [S2]. 태국어 · 광둥어에서 더 크게 떨어진다고 발표했다 [S4]. 발표일은 2024-10-01 이다 [S4].
- large-v3 는 2023-11-06 에 나왔다. 멜 주파수 칸이 80개에서 128개로 늘었다 [S3].

### 3.2 한국어 정확도

**FLEURS (읽은 문장, 16kHz)**

| 모델 | FLEURS WER(논문, 2022-12) [S1] | FLEURS CER(OpenAI 그림) | Common Voice 15 CER(OpenAI 그림) |
| --- | --- | --- | --- |
| tiny | 36.1% | 확인 못 함 | 확인 못 함 |
| base | 27.8% | 확인 못 함 | 확인 못 함 |
| small | 19.6% | 확인 못 함 | 확인 못 함 |
| medium | 16.4% | 확인 못 함 | 확인 못 함 |
| large(v1) | 15.2% | 확인 못 함 | 확인 못 함 |
| large-v2 | 14.3% | 약 3.2% (그림 막대 길이로 읽은 근사값) [S2] | 약 6.5% (근사값) [S2] |
| large-v3 | 해당 없음(논문 뒤에 나옴) | 3.1% [S2] | 5.2% [S2] |
| large-v3-turbo | 해당 없음 | 3.2% (beam 5) [S4] | 5.6% (beam 5) [S4] |

- 논문 표는 WER 이고, README 그림은 한국어를 CER(기울임 글씨)로 표시한다 [S1][S2]. 두 열은 비교할 수 없다.
- 논문의 Common Voice 9 표에는 한국어가 없다 [S1].
- OpenAI 는 large-v3 가 large-v2 보다 오류를 10~20% 줄였다고 발표했다(여러 언어 전체 기준) [S3]. 한국어 FLEURS 는 그림상 거의 같다(3.1% 대 약 3.2%) [S2].
- turbo 는 large-v3 보다 FLEURS 0.1%p, CV15 0.4%p 높다(같은 그림, beam 5 에서 large-v3 는 3.1% · 5.2%) [S4].

**KsponSpeech (두 사람 자유 대화, 16kHz)**

| 출처 · 시점 | tiny | base | small | medium | large-v2 | large-v3 |
| --- | --- | --- | --- | --- | --- | --- |
| ETRI 논문(2023-09), eval-clean / eval-other [S14] | 33.57 / 30.90 | 22.85 / 21.12 | 확인 못 함 | 11.94 / 11.96 | 10.83 / 10.83 | 확인 못 함 |
| 기상 전문가 ASR 논문(2024-10), Eval 3k [S15] | 32.67 | 확인 못 함 | 16.75 | 14.33 | 14.66 | 확인 못 함 |
| 업체 블로그(2025-11), eval-other [S16] (블로그) | — | — | — | — | — | 11.13 |

- 단위는 CER(%)다.
- ETRI 논문은 KsponSpeech 1,000시간으로 medium 을 파인튜닝해 eval-clean CER 을 11.94% 에서 7.61% 로 낮췄다 [S14].
- medium 과 large-v2 차이는 작고, base 이하는 두 배 가까이 나쁘다 [S14].

**Zeroth (읽은 문장)**

- large-v3-turbo 를 그대로 쓰면 Zeroth test CER 7.58%, WER 26.75% 다(파인튜닝 전 값) [S21].

**전화 관련 수치는 「7. 전화 음질」에 모았다.**

### 3.3 large-v3 계열 주의점

- large-v3 발표 토론방에 「v3 가 v2 보다 환각이 잦다」는 사용자 보고가 여러 건 있다 [S3].
- 경쟁사 Deepgram 블로그는 v3 가 v2 보다 4배 자주 환각한다고 주장한다. 경쟁사 자료이고 방법이 공개되지 않았다(블로그) [S40].
- 그래서 large-v2 도 시험 후보로 남겨 둔다(AI 판단).

## 4. faster-whisper (CTranslate2)

### 4.1 원본 대비 속도 · 메모리 (공식 README)

README 는 「같은 정확도로 openai/whisper 보다 최대 4배 빠르고 메모리를 덜 쓴다」고 적는다 [S5]. 아래는 README 의 벤치마크다. 13분 음성, beam 5 다. 비교 버전은 faster-whisper 1.1.0 · openai/whisper v20240930 · whisper.cpp 1.7.2 다(2024-11 무렵) [S5].

**GPU · large-v2 (RTX 3070 Ti 8GB, CUDA 12.4)** [S5]

| 구현 | 정밀도 | 시간 | VRAM |
| --- | --- | --- | --- |
| openai/whisper | fp16 | 2분 23초 | 4,708MB |
| whisper.cpp (Flash Attention) | fp16 | 1분 5초 | 4,127MB |
| transformers (SDPA) | fp16 | 1분 52초 | 4,960MB |
| faster-whisper | fp16 | 1분 3초 | 4,525MB |
| faster-whisper (batch_size=8) | fp16 | 17초 | 6,090MB |
| faster-whisper | int8 | 59초 | 2,926MB |
| faster-whisper (batch_size=8) | int8 | 16초 | 4,500MB |

**CPU · small (Intel Core i7-12700K, 8스레드)** [S5]

| 구현 | 정밀도 | 시간 | RAM |
| --- | --- | --- | --- |
| openai/whisper | fp32 | 6분 58초 | 2,335MB |
| whisper.cpp | fp32 | 2분 5초 | 1,049MB |
| whisper.cpp (OpenVINO) | fp32 | 1분 45초 | 1,642MB |
| faster-whisper | fp32 | 2분 37초 | 2,257MB |
| faster-whisper (batch_size=8) | fp32 | 1분 6초 | 4,230MB |
| faster-whisper | int8 | 1분 42초 | 1,477MB |
| faster-whisper (batch_size=8) | int8 | 51초 | 3,608MB |

- 계산: large-v2 fp16 은 13분을 63초에 처리하니 약 12배 실시간이다. batch 8 이면 약 46배다.
- turbo · large-v3 를 faster-whisper 로 돌린 공식 수치는 README 에 없다. 확인 못 함.
- 최신 버전은 1.2.1(2025-10-31) 이다 [S8].

### 4.2 int8 · float16

- 설정 이름은 `compute_type` 이다. GPU 는 `"float16"` 또는 `"int8_float16"`, CPU 는 `"int8"` 을 README 예제가 쓴다 [S5].
- large-v2 GPU 에서 int8 은 VRAM 을 4,525MB 에서 2,926MB 로 줄이고 시간은 63초에서 59초로 비슷하다 [S5].
- int8 이 **한국어** CER 을 얼마나 바꾸는지는 공식 수치가 없다. 확인 못 함.

### 4.3 VAD 필터

- Silero VAD 를 내장한다 [S5].
- `WhisperModel.transcribe` 의 `vad_filter` 기본값은 `False` 다. `BatchedInferencePipeline.transcribe` 는 `True` 다 [S6].
- `VadOptions` 기본값: `threshold` 0.5, `min_speech_duration_ms` 0, `min_silence_duration_ms` 2000, `speech_pad_ms` 400, `max_speech_duration_s` 무한 [S7].
- README 는 「기본 동작은 보수적이라 2초보다 긴 침묵만 없앤다」고 적고, 예제로 `min_silence_duration_ms=500` 을 보인다 [S5].

### 4.4 `initial_prompt` · `hotwords`

- `initial_prompt`: `WhisperModel.transcribe` 에서는 **첫 창(window)** 에만 들어간다 [S6]. 배치 파이프라인 설명에는 「각 창마다」 넣는다고 적혀 있다 [S6].
- `hotwords`: 「모델에 주는 핫워드 · 힌트 문구. `prefix` 를 쓰면 효과 없음」 [S6]. 코드를 보면 별도 가중치를 주는 방식이 아니다. 앞 문맥 자리에 토큰을 덧붙인다. 길이는 `max_length` 의 절반 아래로 잘린다 [S6].
- OpenAI 안내서는 Whisper 가 일반 언어 모델처럼 지시를 따르지 않고, 프롬프트를 224토큰까지만 받는다고 적는다. 드문 단어 · 약어의 철자 사전을 넣는 용도이고, 품번(SKU) 목록은 작아야 한다고 적는다 [S9].
- 부품명 · 차종명을 힌트로 줬을 때 한국어 CER 이 얼마나 줄어드는지 공개 수치는 확인 못 함.

### 4.5 환각 — 무음 꼬리에서 지어내는 문구

**현상**

- 커뮤니티가 잡음만 든 소리를 Whisper 에 넣어 모은 환각 문구 자료가 있다. 한국어 28줄이 있고 「시청해주셔서 감사합니다」 「구독해주세요」 「다음 영상에서 만나요」 「MBC 뉴스 ○○○입니다」 같은 영상 끝맺음 문구다 [S12]. 문구마다 1~2회라 빈도 자료로는 쓸 수 없다. (커뮤니티 자료)
- 오픈소스 받아쓰기 앱은 한국어 차단 문구로 「시청해주셔서 감사합니다」 「감사합니다」 「구독과 좋아요 부탁드립니다」를 둔다 [S13]. (실무 예)
- 원인은 공식 확인된 것이 없다.

**크기 (영어 실험)**

- large-v3 에 말소리 없는 소리 301,317개를 넣자 40.3% 에서 환각이 나왔다(ICASSP 2025, 영어 설정) [S10].
- 같은 연구의 환각 검출 비율(두 시험 조건 중 첫째 값): 처리 안 함 21.3% → `hallucination_silence_threshold` 20 은 14.6% → WebRTC VAD 12.5% → Silero VAD 0.2% → Silero VAD + 반복 제거 + 환각 문구 목록 0.0%. 같은 순서로 WER 은 104.8% → 39.8% → 68.3% → 8.0% → 6.5% 다 [S10].
- 실제 음성 받아쓰기의 약 1% 에 통째로 지어낸 구절이 있었고, 그중 38% 가 해로운 내용이었다는 연구가 있다(2023년 Whisper 기준, 말 사이 침묵이 긴 실어증 화자에서 더 많음) [S11].

**대처 (faster-whisper 설정)**

1. `vad_filter=True` 로 켠다. 전화에는 대기음 · 보류음이 있으니 `min_silence_duration_ms` 를 기본값 2000 보다 줄여 시험한다 [S5][S7].
2. `condition_on_previous_text=False` 로 둔다. 기본값은 `True` 다. 코드 설명은 「끄면 창 사이 문장이 덜 이어지지만 반복 루프 · 타임스탬프 어긋남 같은 실패에 덜 빠진다」고 적는다 [S6].
3. `hallucination_silence_threshold` 는 `word_timestamps=True` 일 때만 동작한다. 환각이 의심되면 지정한 초보다 긴 침묵을 건너뛴다 [S6]. 영어 실험에서는 VAD 보다 효과가 작았다 [S10].
4. 판정 기준 기본값은 `no_speech_threshold` 0.6, `log_prob_threshold` -1.0, `compression_ratio_threshold` 2.4 다 [S6].
5. 받아쓴 뒤 한국어 끝맺음 문구 목록으로 거른다 [S12][S13]. 손님이 실제로 「감사합니다」라고 말한 것을 지우지 않도록 「발화 전체가 그 문구일 때」로 조건을 좁힌다(AI 판단).
6. `language="ko"` 로 고정한다. 언어 감지 단계를 건너뛴다(AI 판단).

### 4.6 설치 조건

- Python 3.9 이상이다. FFmpeg 를 따로 깔 필요가 없다. PyAV 가 묶어 온다 [S5].
- GPU 는 CUDA 12 용 cuBLAS 와 cuDNN 9 가 필요하다. CUDA 11 + cuDNN 8 이면 ctranslate2 3.24.0, CUDA 12 + cuDNN 8 이면 4.4.0 으로 내린다 [S5].
- 윈도우는 Purfview 의 whisper-standalone-win 묶음에서 NVIDIA 라이브러리를 받아 PATH 에 두는 방법이 안내돼 있다 [S5].
- 모델은 Hugging Face 에서 CTranslate2 형식으로 자동으로 받는다. 파인튜닝 모델은 `ct2-transformers-converter` 로 바꾼다 [S5].

## 5. 한국어 파인튜닝 Whisper 공개 모델

| 모델 | 바탕 | 학습 자료 | 보고된 수치 | 라이선스 · 시점 | 출처 |
| --- | --- | --- | --- | --- | --- |
| ghost613/whisper-large-v3-turbo-korean | large-v3-turbo | Zeroth 206시간 | Zeroth test CER 7.58% → 2.06%, WER 26.75% → 4.89% (자체 보고) | 카드에 라이선스 없음 · 2024-10 · faster-whisper 변환본 있음 | S21 |
| batiai/batisay-ko-turbo | large-v3-turbo | AI Hub 기반 약 4,300시간(콜센터 8kHz · 잡음 통화 포함) | 콜센터 8kHz CER 5.67%, KsponSpeech clean 6.99% · other 8.33%, 실제 긴 통화 5건 14.85% (자체 보고) | BatiAI Community v2(연 매출 10억 원 이상 상업 이용 등은 문의, 4년 뒤 Apache 2.0) · 2026-06 | S22 |
| SungBeom/whisper-small-ko | small | AI Hub 7종 13,946시간(고객응대음성 · 복지 분야 콜센터 상담 포함) | WER 9.48% (자체 검증 분할, 0.2 epoch) | Apache-2.0 · 2023-12 마지막 수정 | S23 |

- batisay-ko-turbo 의 긴 통화 14.85% 는 사람이 아닌 자동 전사를 기준으로 쟀다고 카드가 적는다. 표의 「large」 열(콜센터 10.00%)이 무엇인지 카드에 정의가 없다 [S22].
- ghost613 저자는 「수렴하지 않았고 더 좋아질 수 있다」고 적는다 [S21].
- 참고 1: BuzzASR/korean(large-v3, MIT)은 FLEURS CER 5.16%(그대로 쓴 large-v3 5.31%), Common Voice 25 CER 4.24%(6.01%) 를 보고한다 [S24]. 전화 수치는 없다.
- 참고 2: INo0121/whisper-base-ko-callvoice 는 AI Hub 저음질 전화망 약 66.9시간으로 base 를 학습했다. CER 30.75% 다 [S25]. 작은 모델은 전화 음질에서 한계가 크다. 카드는 학습용으로만 쓰라고 적는다 [S25].
- 참고 3: 리턴제로 Whisper 는 저음질 전화망 CER 4.26% 를 냈다 [S17]. 가중치 공개 여부는 확인 못 함.

## 6. 그 밖의 온프레미스 대안

### 6.1 NVIDIA NeMo · Parakeet · Canary · Riva · Nemotron

- **Canary-1B-v2 · Parakeet-TDT-0.6B-v3**: 유럽 25개 언어만 지원한다. 한국어가 없다 [S26]. Canary-1B-v2 는 2025-08-14 공개, CC-BY-4.0 이다 [S26].
- **NeMo 체크포인트 문서**에 한국어를 명시한 모델이 없다 [S26].
- **Riva 한국어 Conformer-CTC**(NGC): 약 120M, 한국어 3,500시간 이상으로 학습했다. 공개 정확도 수치가 없다. Riva 라이선스(NVIDIA AI Enterprise EULA)를 따른다. 2024-05-31 수정 [S27].
- **Nemotron 3.5 ASR Streaming 0.6B**(2026-06-04): ko-KR 을 「바로 전사 가능」 등급으로 지원한다. FLEURS 한국어 CER 은 언어 지정 모드에서 7.59%(80ms 청크) ~ 7.12%(1.12초 청크)다. OpenMDW-1.1, 상업 이용 가능이다. GPU 메모리 · 8kHz 언급은 없다 [S28].
- **Nemotron 3.5 Transcribe 30B-A4B**(2026-10-28): FLEURS 한국어 CER 2.78%, 화자 구분 내장이다. 전체 34B(활성 4.3B)다. 배포 목표는 H100 80GB 1장이고 RTX 5090 은 NVFP4 로만 된다 [S29]. 일반 PC 용이 아니다.
- 정리(AI 판단): PC 에서 돌릴 만한 0.6B 는 FLEURS CER 이 Whisper turbo(3.2%) 보다 높다. 30B 는 비슷하거나 조금 낫지만 장비가 너무 크다.

### 6.2 Meta MMS · SeamlessM4T

- **MMS**: FLEURS 한국어 WER 이 MMS 변형별로 37.3% ~ 82.1% 다. 같은 표에서 Whisper large-v2 는 14.3% 다(Whisper 정규화 적용) [S30, 표 A1]. FLEURS 로 따로 학습한 MMS 의 CER 은 dev 11.4% · test 11.8% 다 [S30, 표 A3]. mms-1b-all 은 1B, wav2vec2 CTC + 언어별 어댑터, **CC-BY-NC 4.0(비상업)** 이다 [S30].
- **SeamlessM4T v2 large**: 한국어 음성 입력을 지원한다. 2.3B, **CC-BY-NC 4.0** 이다 [S31]. FLEURS 전체 분할 합산 CER 이 10.3% 로, 같은 조건 Whisper-v3-Large 7.4% 보다 높다 [S19].
- 둘 다 비상업 라이선스라 회사 서비스에 쓰기 어렵다.

### 6.3 whisper.cpp (CPU 실행)

- 메모리: tiny ~273MB, base ~388MB, small ~852MB, medium ~2.1GB, large ~3.9GB [S32].
- CPU 속도(13분 음성, small, beam 5, i7-12700K 8스레드): fp32 2분 5초 · RAM 1,049MB, OpenVINO 1분 45초 · 1,642MB [S5]. 같은 조건 faster-whisper int8 은 1분 42초 · 1,477MB 다 [S5]. whisper.cpp 1.7.2 기준이다.
- medium · large 를 CPU 로 끝까지 받아쓴 공식 속도는 확인 못 함. 벤치마크 모음은 이슈 #89 에 있다 [S32].
- 최신 v1.9.5(2026-10-06)다. Silero VAD(`--vad`), 정수 양자화(q5_0 등), CUDA · Vulkan · OpenVINO 등을 지원한다 [S32].
- `whisper-cli` 예제는 16비트 WAV 만 받는다 [S32].

### 6.4 화자 분리를 붙이는 비용

- **먼저 확인**: 녹음 장치가 통화를 2채널(우리 쪽 · 손님 쪽)로 저장하면 채널별로 받아쓰는 것으로 화자 구분이 끝난다. 한 채널로 섞여 저장될 때만 아래가 필요하다(AI 판단).
- **pyannote speaker-diarization-community-1**
  - CC-BY-4.0 이다. Hugging Face 이용 조건 동의와 토큰이 필요하다. 내려받은 뒤에는 인터넷 없이 돌릴 수 있다 [S33].
  - 속도: H100 에서 음성 1시간당 31초(약 1시간 파일), 37초(약 5분 파일)다 [S33]. 기본은 CPU 로 돈다 [S33]. CPU 속도는 확인 못 함.
  - DER: CALLHOME(part 2) 26.7% 다. 유료 클라우드 precision-2 는 16.6% 다 [S33].
  - 입력은 16kHz 모노로 맞춰지고, 다른 샘플레이트는 자동으로 바뀐다(3.1 카드 기준) [S33]. ffmpeg 가 필요하다 [S33].
  - pyannote.audio 최신 4.0.7(2026-06-30) [S33].
- **WhisperX**
  - faster-whisper + 단어 정렬 + pyannote community-1 묶음이다 [S34].
  - large-v2 로 70배 실시간, beam 5 에서 GPU 8GB 미만이다 [S34].
  - 한국어 정렬 모델은 kresnik/wav2vec2-large-xlsr-korean 이다 [S34]. 이 모델은 Zeroth WER 4.74% · CER 1.78%(자체 보고), Apache-2.0 이다 [S35].
  - 숫자 · 기호가 든 단어(예: 「2014.」)는 정렬 사전에 없으면 시각이 붙지 않는다 [S34]. 품번이 많은 주문 전화에 영향이 있다.
  - 겹쳐 말하기를 잘 다루지 못한다고 README 가 적는다 [S34].
  - CUDA 12.8 설치를 안내한다. 최신 3.8.6(2026-05-25) [S34].

### 6.5 조사 범위 밖 참고 (한국어 수치 미확인)

- SenseVoice Small: 한국어를 지원한다. 「10초 음성을 70ms 에 처리, Whisper-Large 보다 15배 빠름」이라고 카드가 적지만 장비는 안 적었다. 한국어 정확도 수치는 없다 [S41].
- Qwen3-ASR 1.7B · 0.6B: 한국어를 지원하고 Apache-2.0 이다. 한국어 개별 수치는 없다 [S41].

## 7. 전화 음질(8kHz)에서 Whisper 성능

- Whisper 는 16kHz 입력을 전제로 한다(`SAMPLE_RATE = 16000`) [S39]. faster-whisper 의 음성 읽기 기본값도 16000 이다 [S42]. 8kHz 통화는 16kHz 로 올려서 넣게 된다.
- **같은 한국어 통화를 8kHz 와 16kHz 로 놓고 Whisper 를 비교한 연구는 찾지 못했다. 확인 못 함.**

가까운 근거는 아래와 같다.

1. **한국어 비교표(업체 관리, 2025-02 측정)** [S17]
   - OpenAI Whisper CER: KsponSpeech eval clean 12.06%, 상담(콜센터 가상 시나리오) 7.51%, 저음질 전화망 17.27%.
   - 저음질 전화망 자료는 6,500시간, 8k 92% · 광대역 8%, 2021년 구축이다 [S18].
   - 같은 표의 저음질 전화망 CER: 리턴제로 Whisper(전화 자료로 다듬음) 4.26%, Naver ClovaSpeech 6.49%, AWS 7.59% [S17].
   - 계산: 일반 Whisper 는 대화 자료보다 전화 잡음 자료에서 약 1.4배(17.27 ÷ 12.06) 나빴다. 전화 자료로 다듬으면 약 4분의 1(4.26 ÷ 17.27)로 줄었다.
   - 주의: 표는 OpenAI API 링크만 달고 모델 버전을 적지 않았다. 확인 못 함.
2. **영어 전화 대화(논문, 2022-12)**: large-v2 WER 이 LibriSpeech clean 2.7%, Switchboard 13.8%, CallHome 17.6% 다 [S1]. 전화 대화는 대역폭뿐 아니라 말투도 달라서 8kHz 효과만의 숫자는 아니다.
3. **영어 · 힌디 8kHz 콜센터(2026-06)**: Whisper-large-v3 를 그대로 쓰면 WER 이 영어 28.7%, 힌디 49.2% 다 [S36]. 같은 연구에서 NeMo 를 실제 녹음으로 파인튜닝하면 영어 15.2% 다 [S36].
4. **인도 언어 연구(2026-06)**: 8kHz 로 내린 음성을 일반 리샘플링하면 「중간 정도」 손실이 있다. 신경망 음질 복원(VoiceFixer, AudioSR)은 오히려 WER 을 나쁘게 했다. 2G(GSM) 코덱은 일관되게 성능을 떨어뜨렸다 [S37]. 수치는 그림에만 있어 확인 못 함.
5. **한국어 원격진료 전화(2026-04)**: large-v3-turbo 를 약 1,300시간으로 파인튜닝했다. 환자 발화 CER 5.32% → 4.98%, WER 22.92% → 22.42% 다. 오디오는 16kHz 로 맞췄다 [S20]. 원래 샘플레이트는 확인 못 함.
6. **8kHz 콜센터 파인튜닝 모델(자체 보고)**: batisay-ko-turbo 5.67% [S22].
7. **작은 모델**: base 를 저음질 전화망 66.9시간으로 학습해도 CER 30.75% 다 [S25].

정리(AI 판단):

- 일반 Whisper 를 전화에 그대로 쓰면 대화 녹음보다 오류가 꽤 늘 수 있다. 한국어 근거는 업체 비교표 한 건(약 1.4배)이다.
- 신경망 대역 확장 같은 음질 복원은 쓰지 않는다. 단순히 16kHz 로 리샘플링해 넣는다.
- 오류를 크게 줄이는 길은 전화 자료로 다듬은 모델이다(4.26% · 5.67% 사례).

## 8. 이 과제에 주는 시사점 (AI 판단 · 사람 확인 필요)

1. 첫 시험 조합: faster-whisper + large-v3-turbo(또는 한국어 파인튜닝 turbo), GPU `int8_float16` 또는 `float16`, `language="ko"`, `vad_filter=True`, `condition_on_previous_text=False`, beam 5.
2. 비교 후보: large-v2(환각 보고가 적다는 사용자 의견 [S3]), 한국어 파인튜닝 turbo 2종 [S21][S22].
3. GPU 가 없으면 small int8 을 CPU 로 돌린다. KsponSpeech CER 이 small 16.75% 대 large-v2 14.66% 다 [S15]. 전화에서는 차이가 더 벌어질 수 있다.
4. 부품명 · 품번은 `hotwords` 나 `initial_prompt` 로 224토큰 안에서 힌트를 준다 [S9]. 효과는 우리 녹음으로 직접 잰다.
5. 환각은 VAD + 끝맺음 문구 차단 목록으로 막는다 [S10][S12].
6. 화자 분리는 통화 녹음이 2채널인지 먼저 확인한다.
7. 실제 통화 수십 건을 사람이 받아써서 CER 을 잰다. 실제 녹음과 받아쓴 글은 공개 저장소에 넣지 않는다(AGENTS.md 규칙).
8. 라이선스: MMS · SeamlessM4T 는 비상업이다 [S30][S31]. batisay-ko-turbo 는 매출 조건이 있다 [S22]. ghost613 모델은 라이선스가 적혀 있지 않다 [S21]. 상업 이용 전에 확인한다.

## 9. 확인 못 한 것

- 같은 한국어 통화를 8kHz · 16kHz 로 놓고 Whisper 를 비교한 연구.
- tiny ~ medium, large-v3 의 한국어 전화 음성 CER.
- int8 양자화가 한국어 CER 에 주는 영향.
- turbo · large-v3 를 faster-whisper 로 돌린 공식 속도 · VRAM.
- medium · large 의 CPU 전체 받아쓰기 속도.
- pyannote community-1 의 CPU 속도와 한국어 전화 DER.
- `hotwords` · `initial_prompt` 가 한국어 부품명 인식을 얼마나 개선하는지.
- AI Hub 자료로 학습한 공개 모델의 상업 이용 조건.
- Nemotron 3.5 ASR Streaming 0.6B 의 GPU 메모리와 8kHz 성능.
- 리턴제로 Whisper 의 가중치 공개 여부, 업체 비교표 속 OpenAI Whisper 의 모델 버전.

## 10. 출처

- [S1] Whisper 논문 「Robust Speech Recognition via Large-Scale Weak Supervision」(2022-12). 표 2(LibriSpeech · CallHome · Switchboard), 표 11(Common Voice 9), 표 13(FLEURS) — https://arxiv.org/abs/2212.04356
- [S2] OpenAI Whisper 공식 README(모델 크기 표 · 언어별 성능 그림) — https://github.com/openai/whisper , 그림 원본 — https://github.com/openai/whisper/blob/main/language-breakdown.svg
- [S3] large-v3 발표(2023-11-06)와 사용자 의견 — https://github.com/openai/whisper/discussions/1762
- [S4] turbo 발표(2024-10-01)와 언어별 그림(beam 5) — https://github.com/openai/whisper/discussions/2363
- [S5] faster-whisper 공식 README(벤치마크 · 설치 · VAD) — https://github.com/SYSTRAN/faster-whisper
- [S6] faster-whisper `transcribe.py`(옵션 기본값 · hotwords 구현) — https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py
- [S7] faster-whisper `vad.py`(VadOptions 기본값) — https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/vad.py
- [S8] faster-whisper PyPI(1.2.1, 2025-10-31) — https://pypi.org/project/faster-whisper/
- [S9] OpenAI 음성-텍스트 안내서(224토큰 프롬프트 한도) — https://developers.openai.com/api/docs/guides/speech-to-text
- [S10] 「Investigation of Whisper ASR Hallucinations Induced by Non-Speech Audio」(ICASSP 2025) — https://arxiv.org/abs/2501.11378
- [S11] 「Careless Whisper: Speech-to-Text Hallucination Harms」(FAccT 2024) — https://arxiv.org/abs/2402.08021
- [S12] Whisper 환각 문구 모음(커뮤니티 자료, `phrases.csv` 의 `ko` 줄) — https://huggingface.co/datasets/sachaarbonel/whisper-hallucinations
- [S13] 오픈소스 받아쓰기 앱의 환각 차단 목록(실무 예) — https://github.com/VocaHQ/vocamac/blob/main/Sources/VocaMac/Services/HallucinationGuard.swift
- [S14] 「Building robust Korean speech recognition model by fine-tuning large pretrained model」(말소리와 음성과학 15(3), 2023-09, ETRI). 표 4 · 표 5 — https://koreascience.kr/article/JAKO202330043250854.page
- [S15] 「Evaluating Automatic Speech Recognition Systems for Korean Meteorological Experts」(2024-10, v3 2025-09). 표 3 — https://arxiv.org/abs/2410.18444
- [S16] (블로그) 「Small Models, Big Heat — Conquering Korean ASR with Low-bit Whisper」(2025-11) — https://www.edge-ai-vision.com/?p=56084
- [S17] 한국어 음성 인식 비교표(업체가 관리, 2025-02 측정) — https://github.com/rtzr/Awesome-Korean-Speech-Recognition
- [S18] AI Hub 저음질 전화망 음성인식 데이터 — https://www.aihub.or.kr/aihubdata/data/view.do?currMenu=115&topMenu=100&aihubDataSe=realm&dataSetSn=571
- [S19] 「Fleurs-SLU」 표 8(언어별 CER, v3 2025-08) — https://arxiv.org/abs/2501.06117
- [S20] 「Optimizing whisper for Korean telemedicine: Fine-tuning domain-specific ASR for clinical telephone transcription」(Digital Health, 2026-04) — https://scholarworks.gnu.ac.kr/item/e79f88fa-3eea-48cf-81dc-c918ff865d30 (DOI https://doi.org/10.1177/20552076261444914)
- [S21] (자체 보고) ghost613/whisper-large-v3-turbo-korean — https://huggingface.co/ghost613/whisper-large-v3-turbo-korean , faster-whisper 변환본 — https://huggingface.co/ghost613/faster-whisper-large-v3-turbo-korean
- [S22] (자체 보고) batiai/batisay-ko-turbo — https://huggingface.co/batiai/batisay-ko-turbo
- [S23] (자체 보고) SungBeom/whisper-small-ko — https://huggingface.co/SungBeom/whisper-small-ko
- [S24] (자체 보고) BuzzASR/korean — https://huggingface.co/BuzzASR/korean
- [S25] (자체 보고) INo0121/whisper-base-ko-callvoice — https://huggingface.co/INo0121/whisper-base-ko-callvoice
- [S26] NVIDIA Canary-1B-v2 모델 카드 — https://huggingface.co/nvidia/canary-1b-v2 , NeMo ASR 체크포인트 목록 — https://docs.nvidia.com/nemo/speech/nightly/asr/asr_checkpoints.html
- [S27] NVIDIA Riva 한국어 Conformer(NGC) — https://catalog.ngc.nvidia.com/orgs/nvidia/teams/riva/models/speechtotext_ko_kr_conformer
- [S28] NVIDIA Nemotron 3.5 ASR Streaming 0.6B 모델 카드 — https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b
- [S29] NVIDIA Nemotron 3.5 Transcribe 30B-A4B 모델 카드 — https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B
- [S30] MMS 논문 「Scaling Speech Technology to 1,000+ Languages」(2023-05) 표 A1 · A3 — https://arxiv.org/abs/2305.13516 , mms-1b-all 카드 — https://huggingface.co/facebook/mms-1b-all
- [S31] SeamlessM4T v2 large 모델 카드 — https://huggingface.co/facebook/seamless-m4t-v2-large
- [S32] whisper.cpp 공식 README(메모리 표 · 백엔드 · VAD) — https://github.com/ggml-org/whisper.cpp , 릴리스(v1.9.5, 2026-10-06) — https://github.com/ggml-org/whisper.cpp/releases , 벤치마크 이슈 — https://github.com/ggml-org/whisper.cpp/issues/89
- [S33] pyannote.audio README(속도 · DER) — https://github.com/pyannote/pyannote-audio , community-1 카드 — https://huggingface.co/pyannote/speaker-diarization-community-1 , 3.1 카드(입력 형식) — https://huggingface.co/pyannote/speaker-diarization-3.1 , PyPI(4.0.7) — https://pypi.org/project/pyannote.audio/
- [S34] WhisperX README — https://github.com/m-bain/whisperX , 정렬 모델 목록 — https://github.com/m-bain/whisperX/blob/main/whisperx/alignment.py , PyPI(3.8.6) — https://pypi.org/project/whisperx/
- [S35] (자체 보고) kresnik/wav2vec2-large-xlsr-korean — https://huggingface.co/kresnik/wav2vec2-large-xlsr-korean
- [S36] 「Responsible ASR: Overcoming Challenges of Foundational Models in Narrow-Band and Low-Resource Settings」(2026-06) 표 2 — https://arxiv.org/abs/2606.18659
- [S37] 「Factors affecting ASR performance: A study using state of the art ASR models in Indic Languages」(2026-06) 3.2절 — https://arxiv.org/abs/2606.09335
- [S39] OpenAI Whisper `audio.py`(SAMPLE_RATE) — https://github.com/openai/whisper/blob/main/whisper/audio.py
- [S40] (경쟁사 블로그) Deepgram 「Whisper-v3 Results」(2023-11, 2024-06 갱신) — https://deepgram.com/learn/whisper-v3-results
- [S41] SenseVoice Small 카드 — https://huggingface.co/FunAudioLLM/SenseVoiceSmall , Qwen3-ASR 1.7B 카드 — https://huggingface.co/Qwen/Qwen3-ASR-1.7B
- [S42] faster-whisper `audio.py`(decode_audio 기본 16000) — https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/audio.py

### 출처 메모

- large-v2 의 FLEURS CER 약 3.2% · CV15 CER 약 6.5% 는 그림에 숫자로 적혀 있지 않다. [S2] 그림의 막대 끝 좌표를 로그 눈금으로 바꿔 읽은 근사값이다. turbo 그림 [S4] 에서도 같은 값이 나온다.
- [S2] · [S4] 그림 속 large-v3 · turbo 숫자는 그림 원본(SVG)에 적힌 값을 그대로 옮겼다.

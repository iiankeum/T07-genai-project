# 함께 들어 있는 남의 소프트웨어

설치본에는 아래 오픈소스가 들어 있다. 각 라이선스를 따른다.

| 이름 | 하는 일 | 라이선스 |
|---|---|---|
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | 받아쓰기 엔진 | MIT |
| [CTranslate2](https://github.com/OpenNMT/CTranslate2) | 모델 실행 | MIT |
| [Silero VAD](https://github.com/snakers4/silero-vad) (faster-whisper 에 들어 있음) | 말소리 구간 찾기 | MIT |
| [ONNX Runtime](https://github.com/microsoft/onnxruntime) | VAD 실행 | MIT |
| [PyAV](https://github.com/PyAV-Org/PyAV) | 소리 파일 풀기 | BSD-3-Clause |
| [FFmpeg](https://ffmpeg.org/) (PyAV 에 들어 있음, 동적 연결) | 소리 파일 풀기 | LGPL-2.1+ · 소스: https://ffmpeg.org/download.html |
| [tokenizers](https://github.com/huggingface/tokenizers) | 힌트 길이 재기 | Apache-2.0 |
| [huggingface_hub](https://github.com/huggingface/huggingface_hub) | 모델 받기 | Apache-2.0 |
| [NumPy](https://numpy.org/) | 계산 | BSD-3-Clause |
| [Python](https://www.python.org/) | 실행 환경 | PSF License |

설치 뒤 따로 받는 것(설치본에는 없음):

| 이름 | 어디서 | 라이선스 |
|---|---|---|
| Whisper 모델(large-v3-turbo 등, CTranslate2 변환본) | Hugging Face (Systran, mobiuslabsgmbh) | MIT |
| NVIDIA cuBLAS · cuDNN (「GPU 가속 받기」를 누를 때만) | PyPI 의 NVIDIA 공식 패키지 | NVIDIA 소프트웨어 라이선스 |

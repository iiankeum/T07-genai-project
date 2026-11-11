"""음성 인식(받아쓰기).

- none           : 음성 인식을 쓰지 않는다. 받아쓴 글(.txt)만 처리한다.
- faster-whisper : PC 안에서 돌린다. 녹음이 밖으로 나가지 않는다. (pip install faster-whisper)
- openai         : OpenAI 음성 인식 API. 녹음이 외부로 전송된다. (pip install openai)
"""
from __future__ import annotations

from pathlib import Path

from .config import Settings
from .glossary import Glossary

AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac", ".aac", ".amr", ".3gp"}
TEXT_EXTS = {".txt", ".md"}


class STTError(RuntimeError):
    pass


def _hint(glossary: Glossary) -> str:
    # Whisper는 앞 문맥(prompt)에 나온 낱말을 더 잘 알아듣는다
    words = ", ".join(glossary.prompt_terms())
    return f"자동차 부품 대리점 주문 전화. 정비소, 공업사, 품번, 차번호, 연식. {words}"


_fw_model = None


def _faster_whisper(path: Path, settings: Settings, glossary: Glossary) -> str:
    global _fw_model
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise STTError("faster-whisper가 설치되지 않았습니다: pip install faster-whisper") from e
    if _fw_model is None:
        _fw_model = WhisperModel(settings.whisper_model, device="auto", compute_type="int8")
    segments, _info = _fw_model.transcribe(
        str(path), language="ko", initial_prompt=_hint(glossary), vad_filter=True
    )
    return "\n".join(s.text.strip() for s in segments if s.text.strip())


def _openai(path: Path, settings: Settings, glossary: Glossary) -> str:
    try:
        from openai import OpenAI
    except ImportError as e:
        raise STTError("openai 패키지가 설치되지 않았습니다: pip install openai") from e
    client = OpenAI()
    with open(path, "rb") as f:
        res = client.audio.transcriptions.create(
            model=settings.openai_stt_model, file=f, language="ko", prompt=_hint(glossary)
        )
    return res.text


def transcribe(path: Path, settings: Settings, glossary: Glossary) -> str:
    path = Path(path)
    ext = path.suffix.lower()
    if ext in TEXT_EXTS:
        return path.read_text(encoding="utf-8-sig")
    if ext not in AUDIO_EXTS:
        raise STTError(f"지원하지 않는 파일 형식입니다: {ext}")
    backend = settings.stt_backend
    if backend == "faster-whisper":
        return _faster_whisper(path, settings, glossary)
    if backend == "openai":
        return _openai(path, settings, glossary)
    raise STTError(
        "음성 인식이 꺼져 있습니다(STT_BACKEND=none). "
        ".env에서 STT_BACKEND=faster-whisper 또는 openai로 바꾸거나, 받아쓴 .txt 파일을 올려 주세요."
    )

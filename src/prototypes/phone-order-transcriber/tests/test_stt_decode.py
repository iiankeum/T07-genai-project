"""음성 패키지가 설치된 환경에서만 도는 실제 디코딩 테스트 (없으면 건너뜀).

pip install -r requirements-stt.txt 후 python -m pytest -q tests 로 확인한다.
"""
import math
import struct
import wave

import pytest

fw = pytest.importorskip("faster_whisper")


def _tone(path, rate, seconds=1.0):
    n = int(rate * seconds)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(8000 * math.sin(2 * math.pi * 440 * i / rate))) for i in range(n)))


def test_decode_16k_wav(tmp_path):
    p = tmp_path / "tone16k.wav"
    _tone(p, 16000)
    assert len(fw.decode_audio(str(p))) == 16000


def test_decode_8k_phone_wav_resamples(tmp_path):
    p = tmp_path / "tone8k.wav"  # 전화 녹음에 흔한 8kHz
    _tone(p, 8000)
    assert abs(len(fw.decode_audio(str(p))) - 16000) <= 32

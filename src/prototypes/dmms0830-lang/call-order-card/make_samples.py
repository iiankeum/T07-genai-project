"""가짜 주문 통화 대본(data/calls.json)을 음성 파일로 만든다.

- samples/clean/callNN.wav : 합성 음성 그대로 (16kHz)
- samples/phone/callNN.wav : 전화 음질로 낮춘 것 (300~3400Hz, 8kHz, mu-law 왕복, 잡음 섞음)
- samples/noisy/callNN.wav : 잡음이 심한 전화 (대역을 더 좁히고 잡음을 4배로)

합성 음성은 사람 목소리보다 또박또박해서 실제 통화보다 쉽다.
"흐름이 도는지"와 "숫자·현장 말에서 어디가 틀리는지"를 먼저 보는 용도다.
"""
import asyncio
import json
import subprocess
import sys
import wave
from pathlib import Path

import edge_tts
import numpy as np

HERE = Path(__file__).parent
OUT = HERE / "samples"
RATE = 16000

DEALER_VOICE = "ko-KR-SunHiNeural"
SHOP_VOICES = ["ko-KR-InJoonNeural", "ko-KR-HyunsuMultilingualNeural"]
SHOP_SPEED = ["+12%", "+5%", "+20%"]  # 정비소 쪽은 말이 빠르다


def decode(path: Path) -> np.ndarray:
    """오디오 파일을 16kHz 모노 숫자 배열로 읽는다."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.int16)


def write_wav(path: Path, pcm: np.ndarray, rate: int = RATE) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.astype(np.int16).tobytes())


def to_phone(src: Path, dst: Path, low: int = 300, high: int = 3400, noise: float = 0.03) -> None:
    """전화 음질 흉내: 좁은 대역 + 눌림 + 잡음 + 8kHz mu-law 왕복."""
    tmp = dst.with_suffix(".ulaw.wav")
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(src),
         "-f", "lavfi", "-i", f"anoisesrc=color=pink:amplitude={noise}",
         "-filter_complex",
         f"[0:a]highpass=f={low},lowpass=f={high},acompressor=threshold=-20dB:ratio=5,volume=1.4[a];"
         "[a][1:a]amix=inputs=2:duration=first:normalize=0[m]",
         "-map", "[m]", "-ar", "8000", "-ac", "1", "-c:a", "pcm_mulaw", str(tmp)],
        check=True,
    )
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-c:a", "pcm_s16le", str(dst)], check=True
    )
    tmp.unlink()


async def synth(text: str, voice: str, rate: str, path: Path) -> None:
    """합성 서비스가 가끔 503 을 내므로 몇 번 다시 해 본다."""
    for attempt in range(5):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(str(path))
            return
        except Exception:
            if attempt == 4:
                raise
            await asyncio.sleep(1.5 * (attempt + 1))


async def main() -> None:
    calls = json.loads((HERE / "data" / "calls.json").read_text(encoding="utf-8"))["calls"]
    (OUT / "clean").mkdir(parents=True, exist_ok=True)
    (OUT / "phone").mkdir(parents=True, exist_ok=True)
    (OUT / "noisy").mkdir(parents=True, exist_ok=True)
    tmp = OUT / "_turns"
    tmp.mkdir(exist_ok=True)
    gap = np.zeros(int(RATE * 0.3), dtype=np.int16)

    for n, call in enumerate(calls):
        clean = OUT / "clean" / f"{call['id']}.wav"
        if not clean.exists():  # 이미 합성한 통화는 다시 만들지 않는다
            shop_voice = SHOP_VOICES[n % len(SHOP_VOICES)]
            shop_speed = SHOP_SPEED[n % len(SHOP_SPEED)]
            parts = []
            for i, turn in enumerate(call["turns"]):
                mp3 = tmp / f"{call['id']}_{i:02d}.mp3"
                if turn["who"] == "dealer":
                    await synth(turn["say"], DEALER_VOICE, "+8%", mp3)
                else:
                    await synth(turn["say"], shop_voice, shop_speed, mp3)
                parts += [decode(mp3), gap]
            write_wav(clean, np.concatenate(parts))
        to_phone(clean, OUT / "phone" / f"{call['id']}.wav")
        to_phone(clean, OUT / "noisy" / f"{call['id']}.wav", low=400, high=3000, noise=0.12)
        print(f"{call['id']}  {len(decode(clean)) / RATE:5.1f}초", flush=True)

    for f in tmp.iterdir():
        f.unlink()
    tmp.rmdir()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(main())

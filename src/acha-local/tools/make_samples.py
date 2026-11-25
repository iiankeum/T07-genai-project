"""정답을 아는 시험 녹음을 만든다(edge-tts 합성 목소리 · 내용은 모두 지어낸 것).

    .venv\\Scripts\\python tools\\make_samples.py

samples\\<이름>\\audio.wav · reference.txt 가 생긴다.
{말한것|정답} 꼴은 「소리로는 왼쪽을 말하고, 받아쓴 글에는 오른쪽이 나와야 한다」는 뜻이다(현장말을 표준말로 적기).
전화 녹음은 전화선처럼 8kHz 로 좁히고 잡음을 조금 섞는다.
"""
from __future__ import annotations

import asyncio
import re
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from glossary_stt.engine import load_audio  # noqa: E402

A, B, C = "ko-KR-InJoonNeural", "ko-KR-SunHiNeural", "ko-KR-HyunsuMultilingualNeural"

SAMPLES = {
    "부품주문-전화": {
        "phone": True,
        "lines": [
            (A, "여보세요, 다온부품이죠? 여기 새솔공업사인데요."),
            (B, "네, 새솔공업사 사장님, 말씀하세요."),
            (A, "아반떼 앞 {쇼바|쇼크업소버} 두 짝이랑 타이로드엔드 하나요."),
            (B, "네, 쇼크업소버 두 개, 타이로드엔드 하나요."),
            (A, "그리고 쏘렌토 {라지에다|라디에이터} 하나, 로어암 좌측 하나 같이 넣어 주세요."),
            (B, "라디에이터는 지금 재고가 있고요, 로어암은 내일 오전에 들어옵니다."),
            (A, "아 그래요? 그럼 등속조인트하고 허브베어링도 확인해 주세요."),
            (B, "등속조인트는 있는데 허브베어링은 순정이 없고 대체품만 있어요."),
            (A, "대체품 괜찮아요. 캘리퍼 씰 키트도 하나요."),
            (B, "네, 점화코일 네 개는 지난번에 말씀하신 거 맞으시죠?"),
            (A, "맞아요. 인젝터 하나 추가하고, {휀다|펜더} 앞 우측 하나요."),
            (B, "펜더 우측, 인젝터 하나 추가했습니다. 오후 세 시에 한빛모터스 기사님 편에 보내 드릴게요."),
            (A, "네 감사합니다. 블로워모터는 다음에 다시 전화 드릴게요."),
        ],
    },
    "AI수업-강의": {
        "phone": False,
        "lines": [
            (C, "오늘은 트랜스포머 구조를 복습하겠습니다. 입력 문장은 먼저 토크나이저를 거쳐 토큰으로 나뉘고, 각 토큰은 임베딩 벡터로 바뀝니다."),
            (C, "여기에 포지셔널 인코딩을 더해 순서 정보를 넣어 줍니다. 핵심은 셀프 어텐션입니다."),
            (C, "각 토큰에서 쿼리, 키, 밸류를 만들고, 쿼리와 키의 내적을 소프트맥스에 통과시켜 가중치를 구합니다."),
            (C, "이걸 여러 개 나란히 하는 것이 멀티헤드 어텐션이고요, 그다음에 피드포워드 네트워크와 레이어 노멀라이제이션, 잔차 연결이 붙습니다."),
            (C, "이렇게 사전학습한 모델을 우리 데이터에 맞추는 걸 파인튜닝이라고 하는데, 요즘은 전체를 다 학습하지 않고 {로라|LoRA} 같은 방법으로 일부만 학습합니다."),
            (C, "또 모델이 그럴듯한 거짓말을 하는 할루시네이션을 줄이려고, 검색한 문서를 같이 넣어 주는 {래그|RAG}, 검색 증강 생성을 많이 씁니다."),
            (C, "다음 시간에는 양자화와 지식 증류를 다루겠습니다. 과제는 허깅페이스에서 모델 하나를 받아 퍼플렉서티를 재 보는 겁니다."),
        ],
    },
}

_PAIR = re.compile(r"\{([^|{}]+)\|([^|{}]+)\}")


def spoken(text: str) -> str:
    return _PAIR.sub(lambda m: m.group(1), text)


def expected(text: str) -> str:
    return _PAIR.sub(lambda m: m.group(2), text)


async def tts(text: str, voice: str, path: Path) -> None:
    import edge_tts
    await edge_tts.Communicate(text, voice).save(str(path))


def narrowband(x: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """간단한 전화선 흉내: 3.4kHz 위를 FFT 로 잘라내고 잡음을 더한다."""
    n = len(x)
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, 1 / 16000)
    spec[(freqs > 3400) | (freqs < 300)] = 0
    y = np.fft.irfft(spec, n).astype(np.float32)
    y += rng.normal(0, 0.004, n).astype(np.float32)
    return np.clip(y * 0.9, -1, 1)


def save_wav(path: Path, x: np.ndarray) -> None:
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(pcm.tobytes())


async def main() -> None:
    rng = np.random.default_rng(7)
    for name, spec in SAMPLES.items():
        out = ROOT / "samples" / name
        out.mkdir(parents=True, exist_ok=True)
        parts = []
        with tempfile.TemporaryDirectory() as tmp:
            for i, (voice, line) in enumerate(spec["lines"]):
                mp3 = Path(tmp) / f"{i:02d}.mp3"
                await tts(spoken(line), voice, mp3)
                parts.append(load_audio(str(mp3)))
                parts.append(np.zeros(int(16000 * 0.5), dtype=np.float32))
        audio = np.concatenate(parts)
        if spec["phone"]:
            audio = narrowband(audio, rng)
        save_wav(out / "audio.wav", audio)
        (out / "reference.txt").write_text("\n".join(expected(l) for _v, l in spec["lines"]) + "\n", encoding="utf-8")
        print(f"{name}: {len(audio) / 16000:.1f}초")


if __name__ == "__main__":
    asyncio.run(main())

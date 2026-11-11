"""calls.json 의 가짜 통화 대본을 전화 녹음처럼 들리는 음성 파일로 만든다.

합성(edge-tts) → 화자별 목소리 · 높낮이 · 빠르기 → 두 화자를 시간축에 배치 →
(공장소리 통화는 정비소 쪽에 공장 잡음) → 전화 음질(300~3400Hz · 8kHz · mu-law · 선로 잡음).

**음성 파일은 저장소에 넣지 않는다**(용량 · 합성 서비스 약관). 기본 저장 위치는 ~/.t07-demo-audio/
    phone/cNN.wav    8kHz 모노 — 주로 쓰는 것(대리점 녹음기에서 나온 파일 흉내)
    noisy/cNN.wav    8kHz 모노 — 더 나쁜 회선(잡음 · 좁은 대역 · 끊김)
    stereo/cNN.wav   8kHz 2채널 — 왼쪽 대리점, 오른쪽 정비소(화자 구분 정답 확인용)
    clean/cNN.wav    16kHz 모노 — 합성 음성 그대로(잡음 없음)
    web/cNN.mp3      phone 을 16kHz mp3 로 — 사이트에서 틀기 좋은 크기
    timings/cNN.json 턴마다 시작 · 끝 초(모든 파일이 같은 시간축)
    index.json       전체 목록

    pip install edge-tts numpy      # ffmpeg 도 PATH 에 있어야 한다
    python make_audio.py                    # 전부
    python make_audio.py --only c01,c02     # 몇 건만
    python make_audio.py --out D:/somewhere

합성 음성은 사람보다 또박또박하고 말이 안 겹친다. 그래서 실제 통화보다 쉽다.
「흐름이 도는지 · 숫자와 현장 말에서 어디가 틀리는지」를 보는 용도다.
"""
import argparse
import asyncio
import hashlib
import json
import random
import subprocess
import sys
import wave
from pathlib import Path

import edge_tts
import numpy as np

HERE = Path(__file__).parent
RATE = 16000
PHONE_RATE = 8000

# 화자 → (목소리, 높낮이, 빠르기, 음량 배수). edge-tts 의 한국어 목소리는 3개뿐이라
# 다국어 목소리와 높낮이 · 빠르기를 섞어 사람마다 다르게 들리게 했다(Whisper large-v3 로 알아듣는지 확인함).
VOICES = {
    # 대리점
    "김 부장": ("ko-KR-InJoonNeural", "-4Hz", "+0%", 1.0),
    "이 대리": ("ko-KR-SunHiNeural", "+0Hz", "+6%", 1.0),
    # 정비소 — 남
    "박 사장": ("ko-KR-HyunsuMultilingualNeural", "-14Hz", "-8%", 0.95),
    "정 실장": ("de-DE-FlorianMultilingualNeural", "-2Hz", "+6%", 1.0),
    "이 실장": ("ko-KR-HyunsuMultilingualNeural", "+0Hz", "+15%", 1.0),
    "송 사장": ("en-US-BrianMultilingualNeural", "+0Hz", "+8%", 1.0),
    "윤 사장": ("fr-FR-RemyMultilingualNeural", "-10Hz", "-10%", 0.9),
    "최 반장": ("ko-KR-HyunsuMultilingualNeural", "-8Hz", "+12%", 1.1),
    "강 실장": ("ko-KR-HyunsuMultilingualNeural", "+6Hz", "+22%", 1.05),
    "남 공장장": ("de-DE-FlorianMultilingualNeural", "-10Hz", "+0%", 1.1),
    "양 기사": ("en-US-BrianMultilingualNeural", "+8Hz", "+12%", 0.95),
    "서 공장장": ("fr-FR-RemyMultilingualNeural", "-4Hz", "+10%", 1.25),
    "임 사장": ("ko-KR-HyunsuMultilingualNeural", "-10Hz", "+3%", 1.0),
    "조 기사": ("ko-KR-HyunsuMultilingualNeural", "+12Hz", "+10%", 0.9),
    "문 실장": ("en-US-BrianMultilingualNeural", "-6Hz", "+3%", 1.0),
    "진 실장": ("ko-KR-InJoonNeural", "+6Hz", "+12%", 1.0),
    "홍 사장": ("fr-FR-RemyMultilingualNeural", "-12Hz", "-4%", 1.0),
    "백 사장": ("de-DE-FlorianMultilingualNeural", "+2Hz", "+8%", 1.1),
    "권 실장": ("en-US-BrianMultilingualNeural", "+4Hz", "+18%", 1.0),
    # 정비소 — 여
    "한 과장": ("fr-FR-VivienneMultilingualNeural", "-2Hz", "+4%", 1.0),
    "오 실장": ("en-US-AvaMultilingualNeural", "-2Hz", "+4%", 1.0),
    "유 사장": ("de-DE-SeraphinaMultilingualNeural", "-10Hz", "-6%", 1.0),
    "모르는 사람": ("en-US-EmmaMultilingualNeural", "-6Hz", "+0%", 1.0),
}


# ---------- 소리 다루기 (numpy 만 쓴다) ----------

def decode(path: Path) -> np.ndarray:
    """오디오 파일 → 16kHz 모노 float32(-1~1)."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def write_wav(path: Path, x: np.ndarray, rate: int, channels: int = 1) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())


def band(x: np.ndarray, lo: float, hi: float, rate: int = RATE) -> np.ndarray:
    """FFT 로 lo~hi Hz 만 남긴다(경계는 부드럽게)."""
    if len(x) == 0:
        return x
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / rate)
    gain = np.clip((f - lo * 0.8) / (lo * 0.4), 0, 1) * np.clip((hi * 1.15 - f) / (hi * 0.3), 0, 1)
    return np.fft.irfft(spec * gain, n=len(x)).astype(np.float32)


def colored(n: int, exponent: float, rng: np.random.Generator) -> np.ndarray:
    """1/f^exponent 잡음(0 백색 · 1 분홍 · 2 갈색). RMS 1 로 맞춘다."""
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / RATE)
    f[0] = f[1] if len(f) > 1 else 1
    x = np.fft.irfft(spec / f ** (exponent / 2), n=n)
    return (x / (np.sqrt(np.mean(x ** 2)) + 1e-9)).astype(np.float32)


def rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x ** 2)) + 1e-9)


def trim(x: np.ndarray, thr: float = 0.02, pad: float = 0.05) -> np.ndarray:
    """합성 음성 앞뒤의 무음을 잘라 낸다(간격은 우리가 정한다)."""
    idx = np.where(np.abs(x) > thr * (np.abs(x).max() + 1e-9))[0]
    if len(idx) == 0:
        return x
    p = int(pad * RATE)
    return x[max(0, idx[0] - p): idx[-1] + p]


def factory_noise(n: int, rng: np.random.Generator) -> np.ndarray:
    """정비 공장 소리 흉내: 컴프레서 웅웅 + 임팩 렌치 드르륵 + 쇠 부딪는 소리 + 에어 부는 소리."""
    t = np.arange(n) / RATE
    x = 0.022 * band(colored(n, 2.0, rng), 40, 900)                      # 바닥 웅웅
    x += 0.006 * np.sin(2 * np.pi * 120 * t) + 0.003 * np.sin(2 * np.pi * 240 * t + 1.3)
    pos = int(rng.uniform(0.5, 3.0) * RATE)
    while pos < n:                                                       # 임팩 렌치
        L = int(rng.uniform(0.35, 1.4) * RATE)
        seg = band(rng.standard_normal(L).astype(np.float32), 900, 5500)
        tt = np.arange(L) / RATE
        rattle = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * rng.uniform(18, 32) * tt))
        env = np.minimum(1, np.minimum(tt / 0.02, (L / RATE - tt) / 0.03))
        seg = seg / rms(seg) * rng.uniform(0.05, 0.11) * rattle * env
        end = min(n, pos + L)
        x[pos:end] += seg[: end - pos]
        pos = end + int(rng.uniform(2.0, 7.0) * RATE)
    pos = int(rng.uniform(0.2, 2.0) * RATE)
    while pos < n:                                                       # 쇠 부딪는 소리
        L = int(0.3 * RATE)
        tt = np.arange(L) / RATE
        f1 = rng.uniform(1200, 3200)
        seg = (np.sin(2 * np.pi * f1 * tt) + 0.5 * np.sin(2 * np.pi * f1 * 2.71 * tt)) * np.exp(-tt / 0.045)
        end = min(n, pos + L)
        x[pos:end] += (rng.uniform(0.08, 0.2) * seg[: end - pos]).astype(np.float32)
        pos = end + int(rng.uniform(1.2, 5.0) * RATE)
    pos = int(rng.uniform(4, 12) * RATE)
    while pos < n:                                                       # 에어 부는 소리
        L = int(rng.uniform(0.5, 1.3) * RATE)
        seg = band(rng.standard_normal(L).astype(np.float32), 2000, 7000)
        tt = np.arange(L) / RATE
        env = np.minimum(1, np.minimum(tt / 0.05, (L / RATE - tt) / 0.15))
        end = min(n, pos + L)
        x[pos:end] += (seg / rms(seg) * 0.05 * env)[: end - pos]
        pos = end + int(rng.uniform(8, 20) * RATE)
    return x


def mulaw_roundtrip(x: np.ndarray, mu: float = 255.0) -> np.ndarray:
    """전화망의 8비트 mu-law 압축을 한 번 거친 소리."""
    x = np.clip(x, -1, 1)
    y = np.sign(x) * np.log1p(mu * np.abs(x)) / np.log1p(mu)
    y = np.round(y * 127) / 127
    return (np.sign(y) * np.expm1(np.abs(y) * np.log1p(mu)) / mu).astype(np.float32)


def line(x: np.ndarray, lo: int, hi: int, drive: float) -> np.ndarray:
    """한쪽 회선: 좁은 대역 + 살짝 눌림(포화)."""
    y = band(x, lo, hi)
    return (np.tanh(y * drive) / np.tanh(drive)).astype(np.float32)


def to_8k(x: np.ndarray) -> np.ndarray:
    return band(x, 1, 3800)[::2]  # 3.8kHz 아래만 남기고 반으로 솎는다


def phone_mix(dealer: np.ndarray, shop: np.ndarray, rng, *, lo=300, hi=3400, hiss=0.035, drops=0):
    """두 쪽을 전화 회선에 태워 섞고 8kHz mu-law 로 만든다. (모노, 스테레오) 를 돌려준다.

    hiss(선로 잡음)를 너무 작게(0.006) 두면 Whisper 의 무음 거르기(Silero VAD, 기본 0.5)가
    말까지 무음으로 보고 버린다(54건 중 절반이 첫 마디만 남음). 0.035 면 일반 통화는 거의 다 살아난다
    (공장소리 통화는 여전히 일부를 놓친다 — 현실에서도 어려운 경우라 시험거리로 둔다).
    """
    d = line(dealer, lo, hi, 1.6)
    s = line(shop, lo + 20, hi - 100, 2.2)
    n = len(d)
    noise = band(colored(n, 1.0, rng), 200, 3600) * hiss
    mono = d + s + noise
    if drops:  # 회선이 잠깐 끊기는 소리
        for _ in range(drops):
            p = int(rng.uniform(0.1, 0.9) * n)
            mono[p: p + int(rng.uniform(0.03, 0.09) * RATE)] *= 0.05
    peak = max(np.abs(mono).max(), 1e-6)
    g = min(1.0, 0.95 / peak)
    mono = mulaw_roundtrip(to_8k(mono * g))
    st = np.stack([mulaw_roundtrip(to_8k((d + noise) * g)), mulaw_roundtrip(to_8k((s + noise) * g))], axis=1)
    return mono, st


# ---------- 합성 ----------

class Synth:
    def __init__(self, cache: Path, parallel: int = 6):
        self.cache = cache
        cache.mkdir(parents=True, exist_ok=True)
        self.sem = asyncio.Semaphore(parallel)
        self.inflight: dict[str, asyncio.Task] = {}  # 같은 말을 두 번 동시에 합성하지 않게

    async def get(self, text: str, speaker: str) -> Path:
        voice, pitch, rate, _ = VOICES.get(speaker, VOICES["모르는 사람"])
        key = hashlib.sha1(f"{voice}|{pitch}|{rate}|{text}".encode()).hexdigest()[:16]
        path = self.cache / f"{key}.mp3"
        if path.exists() and path.stat().st_size > 500:
            return path
        if key not in self.inflight:
            self.inflight[key] = asyncio.ensure_future(self._make(text, voice, pitch, rate, path))
        return await self.inflight[key]

    async def _make(self, text, voice, pitch, rate, path: Path) -> Path:
        tmp = path.with_suffix(".part")
        async with self.sem:
            for attempt in range(6):  # 합성 서비스가 가끔 503 을 낸다
                try:
                    await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(str(tmp))
                    if tmp.stat().st_size > 500:
                        tmp.replace(path)
                        return path
                except Exception:
                    pass
                await asyncio.sleep(1.5 * (attempt + 1))
        raise RuntimeError(f"합성 실패: {voice} {text[:30]}")


async def render(call: dict, synth: Synth, out: Path) -> dict:
    cid = call["id"]
    rng = np.random.default_rng(int(hashlib.sha1(cid.encode()).hexdigest()[:8], 16))
    prng = random.Random(cid)
    who_name = {"dealer": call["speakers"]["dealer"], "shop": call["speakers"]["shop"]}
    paths = await asyncio.gather(*[synth.get(t["say"], who_name[t["who"]]) for t in call["turns"]])

    # 시간축에 배치한다
    pieces, pos, prev_len = [], int(0.6 * RATE), 1.0
    for t, p in zip(call["turns"], paths):
        x = trim(decode(p))
        level = (0.10 if t["who"] == "dealer" else 0.075) * VOICES.get(who_name[t["who"]], VOICES["모르는 사람"])[3]
        x = x / rms(x) * level
        if pieces:
            gap = prng.uniform(0.18, 0.65)
            if prev_len < 1.2 and prng.random() < 0.25:
                gap = -0.12  # 짧은 대답은 앞말에 살짝 겹친다
            pos += int(gap * RATE)
        pieces.append((t, x, pos))
        pos += len(x)
        prev_len = len(x) / RATE
    n = pos + int(0.8 * RATE)
    dealer = np.zeros(n, np.float32)
    shop = np.zeros(n, np.float32)
    timings = []
    for i, (t, x, start) in enumerate(pieces):
        (dealer if t["who"] == "dealer" else shop)[start: start + len(x)] += x
        timings.append({"i": i, "who": t["who"], "speaker": who_name[t["who"]],
                        "start": round(start / RATE, 2), "end": round((start + len(x)) / RATE, 2), "say": t["say"]})

    write_wav(out / "clean" / f"{cid}.wav", np.clip(dealer + shop, -1, 1), RATE)
    shop_line = shop.copy()
    if call.get("audio_noise") == "factory":
        shop_line += factory_noise(n, rng)
    mono, st = phone_mix(dealer, shop_line, rng)
    write_wav(out / "phone" / f"{cid}.wav", mono, PHONE_RATE)
    write_wav(out / "stereo" / f"{cid}.wav", st.reshape(-1), PHONE_RATE, channels=2)
    noisy, _ = phone_mix(dealer, shop_line + 0.03 * colored(n, 1.0, rng), rng, lo=400, hi=3000, hiss=0.03, drops=3)
    write_wav(out / "noisy" / f"{cid}.wav", noisy, PHONE_RATE)
    (out / "web").mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out / "phone" / f"{cid}.wav"),
                    "-ar", "16000", "-ac", "1", "-b:a", "32k", str(out / "web" / f"{cid}.mp3")], check=True)
    (out / "timings").mkdir(parents=True, exist_ok=True)
    (out / "timings" / f"{cid}.json").write_text(json.dumps(
        {"id": cid, "duration": round(n / RATE, 2), "turns": timings}, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"id": cid, "date": call["date"], "time": call["time"], "customer": call["customer"],
            "noise": call.get("audio_noise"), "duration": round(n / RATE, 1)}


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--calls", default=str(HERE / "calls.json"))
    ap.add_argument("--out", default=str(Path.home() / ".t07-demo-audio"))
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    out = Path(args.out)
    calls = json.loads(Path(args.calls).read_text(encoding="utf-8"))["calls"]
    if args.only:
        keep = set(args.only.split(","))
        calls = [c for c in calls if c["id"] in keep]
    synth = Synth(out / "_cache")
    rows = []
    for i in range(0, len(calls), 6):  # 여섯 통화씩 한꺼번에 합성
        batch = await asyncio.gather(*[render(c, synth, out) for c in calls[i: i + 6]])
        for r in batch:
            print(f"{r['id']}  {r['duration']:5.1f}초  {r['customer'] or '-'}  {r['noise'] or ''}", flush=True)
        rows += batch
    idx_path = out / "index.json"
    old = {r["id"]: r for r in json.loads(idx_path.read_text(encoding="utf-8"))["calls"]} if idx_path.exists() else {}
    old.update({r["id"]: r for r in rows})
    idx = {"_설명": "가짜 통화 음성(합성). 대본 · 정답은 저장소 src/demo-data/calls.json. 저장소에 올리지 않는다.",
           "folders": {"phone": "8kHz 모노 전화 음질(주로 쓸 것)", "noisy": "8kHz 나쁜 회선", "stereo": "8kHz 왼쪽 대리점 · 오른쪽 정비소",
                       "clean": "16kHz 합성 그대로", "web": "16kHz mp3 32kbps(사이트 재생용)", "timings": "턴별 시작 · 끝 초"},
           "calls": [old[k] for k in sorted(old)]}
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(rows)}건 → {out}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(main())

"""받아쓰기 엔진(faster-whisper)을 PC 안에서 돌린다. 인터넷은 모델을 처음 받을 때만 쓴다."""
from __future__ import annotations

import os
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from .hints import HintPlan

SAMPLE_RATE = 16000

# 고를 수 있는 모델. size 는 내려받는 크기(대략).
MODELS = {
    "small": {"repo": "Systran/faster-whisper-small", "label": "작게 · 빠름", "sizeMB": 484},
    "large-v3-turbo": {"repo": "mobiuslabsgmbh/faster-whisper-large-v3-turbo", "label": "권장 · 빠르고 정확", "sizeMB": 1620},
    "large-v3": {"repo": "Systran/faster-whisper-large-v3", "label": "가장 정확 · 느림", "sizeMB": 3090},
}
MODEL_FILES = ["config.json", "preprocessor_config.json", "model.bin", "tokenizer.json", "vocabulary.*"]

VAD_PARAMS = {"threshold": 0.35}   # 기본 0.5 는 조용한 전화 · 먼 마이크 목소리를 무음으로 버리는 일이 있다
VAD_MIN_KEEP = 0.3                 # VAD 가 말의 70% 넘게 지웠으면 VAD 없이 다시 받아쓴다


def app_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA") or str(Path.home() / ".local" / "share")
    return Path(base) / "AchaLocal"


def bundle_dir() -> Path:
    """설치본(PyInstaller)이면 실행 파일 옆, 개발 중이면 저장소 뿌리."""
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return Path(__file__).resolve().parent.parent


_cuda_added: set[str] = set()


def add_cuda_dlls() -> list[str]:
    """그래픽카드 가속에 필요한 NVIDIA DLL 폴더를 찾는다(있으면).

    찾는 곳: ① 설치 폴더의 cuda\\ ② 데이터 폴더의 cuda\\ (설정의 「GPU 가속 받기」가 넣는 곳) ③ 개발용 pip nvidia-* 패키지.
    """
    found: list[str] = []
    if sys.platform != "win32":
        return found
    candidates = [bundle_dir() / "cuda", Path(sys.executable).parent / "cuda", app_dir() / "cuda"]
    for p in list(sys.path):
        nv = Path(p) / "nvidia"
        if nv.is_dir():
            candidates += [d / "bin" for d in nv.iterdir() if (d / "bin").is_dir()]
    for d in candidates:
        if d.is_dir() and any(d.glob("*.dll")):
            found.append(str(d))
    new = [d for d in found if d not in _cuda_added]
    for d in new:
        try:
            os.add_dll_directory(d)
        except OSError:
            pass
        _cuda_added.add(d)
    if new:
        os.environ["PATH"] = os.pathsep.join(new + [os.environ.get("PATH", "")])
    return found


def models_dir() -> Path:
    return app_dir() / "models"


def local_model_path(name: str) -> str | None:
    """이미 받아 둔 모델 폴더. ① 직접 지정한 폴더 ② 이 프로그램의 models\\ ③ Hugging Face 기본 보관함."""
    if os.path.isdir(name) and os.path.isfile(os.path.join(name, "model.bin")):
        return name
    info = MODELS.get(name)
    if not info:
        return None
    mine = models_dir() / name
    if (mine / "model.bin").is_file():
        return str(mine)
    try:
        from huggingface_hub import snapshot_download
        return snapshot_download(info["repo"], allow_patterns=MODEL_FILES, local_files_only=True)
    except Exception:  # noqa: BLE001
        return None


def download_model(name: str, progress: Callable[[int, int], None] | None = None) -> str:
    """모델을 이 프로그램 폴더로 받는다. 끝나면 인터넷 없이 쓴다."""
    from huggingface_hub import snapshot_download
    info = MODELS[name]
    target = models_dir() / name
    target.mkdir(parents=True, exist_ok=True)
    total = info["sizeMB"] * 1024 * 1024
    done = threading.Event()

    def watch():
        while not done.wait(1.0):
            if progress:
                size = sum(f.stat().st_size for f in target.rglob("*") if f.is_file())
                progress(min(size, total), total)

    t = threading.Thread(target=watch, daemon=True)
    t.start()
    try:
        snapshot_download(info["repo"], allow_patterns=MODEL_FILES, local_dir=str(target))
    finally:
        done.set()
    if progress:
        progress(total, total)
    return str(target)


@dataclass
class Engine:
    model_name: str
    device: str = "cpu"
    compute: str = "int8"
    model: object = None
    gpu: str = ""
    lock: threading.Lock = field(default_factory=threading.Lock)

    @property
    def label(self) -> str:
        where = f"GPU · {self.gpu}" if self.device == "cuda" else "CPU"
        return f"{self.model_name} ({where})"

    @property
    def tokenizer(self):
        return getattr(self.model, "hf_tokenizer", None)


def load_engine(name: str, device: str = "auto") -> Engine:
    import numpy as np
    from faster_whisper import WhisperModel

    path = local_model_path(name)
    if path is None:
        raise FileNotFoundError(f"모델 {name} 이 아직 없습니다. 먼저 받으세요.")
    if device in ("auto", "cuda"):
        add_cuda_dlls()
        try:
            m = WhisperModel(path, device="cuda", compute_type="float16")
            segs, _ = m.transcribe(np.zeros(SAMPLE_RATE, dtype=np.float32), language="ko")
            list(segs)  # 실제로 한 번 돌려 봐야 그래픽카드가 되는지 안다
            return Engine(name, "cuda", "float16", m, gpu_name())
        except Exception:  # noqa: BLE001
            if device == "cuda":
                raise
    # 논리 코어(하이퍼스레딩) 수만큼 쓰면 오히려 느렸다(6코어 12스레드 PC: 6개 75초 · 12개 92초).
    cpu_threads = max(1, min(8, (os.cpu_count() or 2) // 2))
    m = WhisperModel(path, device="cpu", compute_type="int8", cpu_threads=cpu_threads)
    return Engine(name, "cpu", "int8", m, "")


def gpu_name() -> str:
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            import subprocess
            out = subprocess.run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"], capture_output=True,
                                 text=True, timeout=5, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            return out.stdout.strip().splitlines()[0] if out.stdout.strip() else "NVIDIA"
    except Exception:  # noqa: BLE001
        pass
    return "NVIDIA"


def load_audio(path_or_file) -> "np.ndarray":  # noqa: F821
    """아무 소리 파일(mp3 · m4a · wav · webm · mp4 …)을 16kHz 모노 float32 로 푼다.

    faster-whisper 1.2.1 의 decode_audio 는 PyAV 15 이후에 없어진 인자(metadata_errors)를 써서 깨진다.
    그래서 같은 일을 직접 한다.
    """
    import gc
    import io
    import av
    import numpy as np

    resampler = av.audio.resampler.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)
    buf = io.BytesIO()
    with av.open(path_or_file, mode="r") as container:
        if not container.streams.audio:
            raise ValueError("소리가 들어 있지 않은 파일입니다.")
        for frame in container.decode(audio=0):
            try:
                frames = resampler.resample(frame)
            except av.error.InvalidDataError:
                continue
            for f in frames:
                buf.write(f.to_ndarray().tobytes())
        for f in resampler.resample(None):
            buf.write(f.to_ndarray().tobytes())
    del resampler
    gc.collect()
    return np.frombuffer(buf.getbuffer(), dtype=np.int16).astype(np.float32) / 32768.0


@dataclass
class Segment:
    start: float
    end: float
    text: str


def transcribe(engine: Engine, audio, plan: HintPlan | None = None, language: str | None = "ko",
               hint_mode: str = "hotwords", beam_size: int = 5,
               progress: Callable[[float], None] | None = None,
               cancel: threading.Event | None = None) -> tuple[list[Segment], dict]:
    """받아쓴다.

    hint_mode
      - "none":     힌트 없이
      - "prompt":   initial_prompt 로만(첫 30초에만 쓰인다 — 흔히 쓰는 방식)
      - "hotwords": 30초마다 힌트를 다시 넣는다(이 프로그램의 기본)
    """
    duration = len(audio) / SAMPLE_RATE
    kw = dict(language=language or None, beam_size=beam_size, condition_on_previous_text=False)
    if plan and plan.hotwords and hint_mode == "prompt":
        kw["initial_prompt"] = plan.hotwords
    elif plan and plan.hotwords and hint_mode == "hotwords":
        kw["hotwords"] = plan.hotwords

    def run(vad: bool):
        started = time.time()
        with engine.lock:
            if vad:
                segs, info = engine.model.transcribe(audio, vad_filter=True, vad_parameters=VAD_PARAMS, **kw)
            else:
                segs, info = engine.model.transcribe(audio, vad_filter=False, **kw)
            out: list[Segment] = []
            for s in segs:
                if cancel is not None and cancel.is_set():
                    raise InterruptedError("취소함")
                text = s.text.strip()
                if text:
                    out.append(Segment(round(s.start, 2), round(s.end, 2), text))
                if progress and duration > 0:
                    progress(min(1.0, s.end / duration))
        return out, info, time.time() - started

    segments, info, elapsed = run(True)
    kept = getattr(info, "duration_after_vad", None)
    fallback = bool(duration > 5 and kept is not None and kept < VAD_MIN_KEEP * duration)
    if fallback:
        segments, info, elapsed2 = run(False)
        elapsed += elapsed2
    meta = {
        "duration": round(duration, 1), "elapsed": round(elapsed, 1), "language": getattr(info, "language", language),
        "vadFallback": fallback, "hintMode": hint_mode if plan and plan.hotwords else "none",
        "engine": f"faster-whisper {engine.label}",
    }
    return segments, meta

"""NVIDIA 그래픽카드 가속 파일(cuBLAS · cuDNN)을 받아 데이터 폴더의 cuda\\ 에 넣는다.

설치본에는 이 파일들을 넣지 않는다(1GB 넘게 커지고, NVIDIA 파일을 우리가 다시 배포하게 된다).
대신 NVIDIA 가 PyPI 에 직접 올린 공식 패키지(wheel)를 사용자 PC 가 받아서 DLL 만 꺼낸다.
버전은 ctranslate2 4.9 와 함께 시험한 것으로 고정한다.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from typing import Callable

from .engine import app_dir

PACKAGES = [
    ("nvidia-cublas-cu12", "12.9.2.10"),
    ("nvidia-cudnn-cu12", "9.28.1.4"),
    ("nvidia-cuda-nvrtc-cu12", "12.9.86"),
]
UA = {"User-Agent": "acha-local-gpu-pack"}


def cuda_dir() -> Path:
    return app_dir() / "cuda"


def has_nvidia() -> bool:
    """NVIDIA 드라이버가 깔려 있나(nvidia-smi 가 도나)."""
    try:
        out = subprocess.run(["nvidia-smi", "-L"], capture_output=True, text=True, timeout=5,
                             creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        return out.returncode == 0 and "GPU" in out.stdout
    except Exception:  # noqa: BLE001
        return False


def installed() -> bool:
    d = cuda_dir()
    return (d / "cublas64_12.dll").is_file() and (d / "cudnn64_9.dll").is_file()


def _wheel_url(name: str, version: str) -> tuple[str, int]:
    with urllib.request.urlopen(urllib.request.Request(f"https://pypi.org/pypi/{name}/{version}/json", headers=UA),
                                timeout=30) as r:
        info = json.load(r)
    for u in info["urls"]:
        if u["filename"].endswith("win_amd64.whl"):
            return u["url"], int(u["size"])
    raise RuntimeError(f"{name} {version} 의 Windows 파일을 찾지 못했습니다.")


def install(progress: Callable[[int, int, str], None] | None = None) -> Path:
    plan = [(n, v, *_wheel_url(n, v)) for n, v in PACKAGES]
    total = sum(p[3] for p in plan)
    done = 0
    target = cuda_dir()
    staging = Path(tempfile.mkdtemp(prefix="acha-gpu-"))
    try:
        out_dir = staging / "cuda"
        out_dir.mkdir()
        for name, version, url, _size in plan:
            whl = staging / f"{name}.whl"
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r, open(whl, "wb") as f:
                while True:
                    chunk = r.read(1 << 20)
                    if not chunk:
                        break
                    f.write(chunk)
                    done += len(chunk)
                    if progress:
                        progress(done, total, name)
            with zipfile.ZipFile(whl) as z:
                for m in z.namelist():
                    p = Path(m)
                    if p.suffix.lower() == ".dll" and "bin" in p.parts and p.parts[0] == "nvidia":
                        with z.open(m) as src, open(out_dir / p.name, "wb") as dst:
                            shutil.copyfileobj(src, dst)
            whl.unlink()
        if target.exists():
            shutil.rmtree(target)
        shutil.move(str(out_dir), target)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    if progress:
        progress(total, total, "끝")
    return target

#!/usr/bin/env python3
"""콜노트(가칭) PC 프로그램 — 받아쓰기 일꾼 + 녹음 폴더 감시.

AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) · 한결(총괄·서버) 작업방 · 2026-11-11
출발점: 대표님 프로토타입 call-order-card 의 받아쓰기 부분(faster-whisper large-v3 · GPU · 낱말 사전 힌트).
서버 API: src/app/docs/worker-api.md v1 (태림 방이 주인).

모드
  worker  서버에서 받아쓰기 일감을 가져와 PC 의 Whisper 로 받아쓰고 결과를 돌려준다.
  watch   지정 폴더에 새 녹음이 생기면 서버 /api/ingest 로 올린다(재시도 · 중복 방지).
  run     worker + watch 를 한 프로세스에서.
  send    녹음 파일 하나를 바로 올린다(시험용).
  check   설정 · 서버 연결을 확인한다(토큰 값은 찍지 않는다).

안전 약속
  - 일꾼은 서버가 16kHz mono WAV 로 바꿔 둔 것만 받는다. ffmpeg 로 열지 않고 파이썬 wave 로 형식을 확인한 뒤 읽는다.
    (인터넷에서 누가 올렸는지 모르는 파일을 이 PC 의 디코더로 열지 않으려는 것)
  - 토큰은 SERVER_URL 과 같은 주소(origin)로만 보낸다. 다른 주소로 가라는 일감은 거절한다. 리다이렉트도 따라가지 않는다.
  - 받아쓴 글 · 토큰 · 파일 경로는 로그에 찍지 않는다(길이 · 시간만).
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import importlib.util
import io
import json
import os
import platform
import random
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import wave
from dataclasses import dataclass
from pathlib import Path

VERSION = "0.1.0"
USER_AGENT = f"callnote-pc-agent/{VERSION}"
SECRETS_DIR = Path(os.environ.get("CALLNOTE_SECRETS_DIR", str(Path.home() / ".t07-secrets")))
STATE_DIR = Path(os.environ.get("CALLNOTE_AGENT_HOME",
                                str(Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "callnote-agent")))
AUDIO_EXT = {".wav", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".amr", ".3gp", ".flac", ".webm"}
MIME = {".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac",
        ".ogg": "audio/ogg", ".opus": "audio/ogg", ".amr": "audio/amr", ".3gp": "audio/3gpp",
        ".flac": "audio/flac", ".webm": "audio/webm"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024        # 서버 ingest 제한과 같게(10MB)
MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024      # 5분 16k mono WAV ≈ 9.6MB, 넉넉히
HEARTBEAT_SEC = 20
KST = dt.timezone(dt.timedelta(hours=9))

# Whisper 가 소리 없는 꼬리에서 지어내는 문장(통째로 이 모양이면 버린다)
HALLUCINATION_PATTERNS = [
    re.compile(r"^\W*(한글\s*)?자막.*(제공|제작|by|BY).*$"),
    re.compile(r"^.*시청해\s*주셔서\s*감사합니다.*$"),
    re.compile(r"^.*구독과\s*좋아요.*$"),
    re.compile(r"^\W*(MBC|KBS|SBS|YTN|JTBC)\s*뉴스.*$"),
    re.compile(r"^\W*다음\s*영상에서\s*만나요.*$"),
]


# ───────────────────────── 로그 ─────────────────────────

_log_lock = threading.Lock()
_log_file: Path | None = None


def log(msg: str, tag: str = "") -> None:
    line = f"{dt.datetime.now(KST).strftime('%m-%d %H:%M:%S')} {('[' + tag + '] ') if tag else ''}{msg}"
    with _log_lock:
        print(line, flush=True)
        if _log_file:
            try:
                with _log_file.open("a", encoding="utf-8") as f:
                    f.write(line + "\n")
            except OSError:
                pass


# ───────────────────────── 설정 ─────────────────────────

def read_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip("\"'")
    except FileNotFoundError:
        pass
    return out


@dataclass
class Config:
    server_url: str
    worker_token: str
    ingest_token: str


def load_config(server: str | None = None, env_file: str | None = None) -> Config:
    merged: dict[str, str] = {}
    for name in ("ingest.env", "worker.env"):
        merged.update(read_env_file(SECRETS_DIR / name))
    if env_file:
        merged.update(read_env_file(Path(env_file)))
    for k in ("SERVER_URL", "WORKER_TOKEN", "INGEST_TOKEN"):
        if os.environ.get(k):
            merged[k] = os.environ[k]
    url = (server or merged.get("SERVER_URL", "")).rstrip("/")
    return Config(url, merged.get("WORKER_TOKEN", ""), merged.get("INGEST_TOKEN", ""))


# ───────────────────────── HTTP ─────────────────────────

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D401
        return None  # 리다이렉트는 따라가지 않는다(토큰이 다른 곳으로 새지 않게)


_opener = urllib.request.build_opener(_NoRedirect)


class Response:
    def __init__(self, status: int, body: bytes, headers: dict[str, str]):
        self.status, self.body, self.headers = status, body, headers

    def json(self):
        try:
            return json.loads(self.body.decode("utf-8")) if self.body else {}
        except (ValueError, UnicodeDecodeError):
            return {}


class Api:
    def __init__(self, base_url: str, timeout: float = 30):
        if not base_url.startswith(("https://", "http://")):
            raise ValueError("SERVER_URL 이 http(s):// 로 시작해야 한다")
        self.base = base_url.rstrip("/")
        self.origin = self._origin(self.base)
        self.timeout = timeout

    @staticmethod
    def _origin(url: str) -> tuple[str, str, int]:
        u = urllib.parse.urlsplit(url)
        port = u.port or (443 if u.scheme == "https" else 80)
        return (u.scheme, (u.hostname or "").lower(), port)

    def same_origin(self, url: str) -> bool:
        return self._origin(url) == self.origin

    def url(self, path_or_url: str) -> str:
        return path_or_url if path_or_url.startswith(("http://", "https://")) else self.base + path_or_url

    def request(self, method: str, path_or_url: str, token: str = "", *, body: bytes | None = None,
                content_type: str | None = None, timeout: float | None = None,
                max_bytes: int = 2 * 1024 * 1024) -> Response:
        url = self.url(path_or_url)
        if not self.same_origin(url):
            raise PermissionError("서버 주소와 다른 곳으로는 요청하지 않는다")
        req = urllib.request.Request(url, data=body, method=method)
        req.add_header("User-Agent", USER_AGENT)
        if content_type:
            req.add_header("Content-Type", content_type)
        if token:
            req.add_unredirected_header("Authorization", f"Bearer {token}")
        try:
            with _opener.open(req, timeout=timeout or self.timeout) as r:
                data = r.read(max_bytes + 1)
                if len(data) > max_bytes:
                    raise ValueError("응답이 너무 크다")
                return Response(r.status, data, {k.lower(): v for k, v in r.headers.items()})
        except urllib.error.HTTPError as e:
            try:
                data = e.read(64 * 1024) if e.fp else b""
            finally:
                e.close()
            return Response(e.code, data, {k.lower(): v for k, v in (e.headers or {}).items()})

    def post_json(self, path: str, token: str, payload: dict, timeout: float | None = None) -> Response:
        return self.request("POST", path, token, body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                            content_type="application/json; charset=utf-8", timeout=timeout)


def encode_multipart(fields: dict[str, str], file_field: str, filename: str, file_type: str,
                     data: bytes) -> tuple[bytes, str]:
    boundary = "----callnote" + uuid.uuid4().hex
    out = io.BytesIO()
    for k, v in fields.items():
        out.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n".encode())
        out.write(str(v).encode("utf-8") + b"\r\n")
    safe_name = filename.replace('"', "").replace("\r", "").replace("\n", "")
    out.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; "
              f"filename=\"{safe_name}\"\r\nContent-Type: {file_type}\r\n\r\n".encode("utf-8"))
    out.write(data)
    out.write(f"\r\n--{boundary}--\r\n".encode())
    return out.getvalue(), f"multipart/form-data; boundary={boundary}"


# ───────────────────────── 오디오 ─────────────────────────

class BadAudio(Exception):
    """서버가 약속한 16kHz mono 16bit WAV 가 아니다(다시 해도 같으므로 retryable=False)."""


def read_wav_16k_mono(data: bytes):
    import numpy as np

    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            ch, width, rate, comp = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getcomptype()
            if (ch, width, rate, comp) != (1, 2, 16000, "NONE"):
                raise BadAudio(f"약속과 다른 WAV(채널 {ch} · {width * 8}bit · {rate}Hz · {comp})")
            frames = w.readframes(w.getnframes())
    except (wave.Error, EOFError) as e:
        raise BadAudio(f"WAV 를 읽지 못함: {type(e).__name__}") from e
    return np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0


def clean_segments(raw: list[dict], audio_sec: float) -> list[dict]:
    """녹음 끝(무음 꼬리)에서 시작하는 구간과, 통째로 환각 문장인 구간을 버린다."""
    end_limit = audio_sec - 0.3
    out = []
    for s in raw:
        text = (s.get("text") or "").strip()
        if not text or s["start"] >= end_limit:
            continue
        if any(p.match(text) for p in HALLUCINATION_PATTERNS):
            continue
        out.append({"start": round(float(s["start"]), 1), "end": round(float(s["end"]), 1), "text": text[:1000]})
    return out[:2000]


# ───────────────────────── 받아쓰기(Whisper) ─────────────────────────

def _add_cuda_dlls() -> None:
    """pip 로 깐 NVIDIA 라이브러리(cuBLAS·cuDNN)를 윈도우가 찾을 수 있게 한다(프로토타입과 같음)."""
    for pkg in ("nvidia.cublas", "nvidia.cudnn", "nvidia.cuda_nvrtc"):
        try:
            spec = importlib.util.find_spec(pkg)
        except ModuleNotFoundError:
            continue
        if spec and spec.submodule_search_locations:
            bin_dir = Path(list(spec.submodule_search_locations)[0]) / "bin"
            if bin_dir.is_dir():
                if hasattr(os, "add_dll_directory"):
                    os.add_dll_directory(str(bin_dir))
                os.environ["PATH"] = str(bin_dir) + os.pathsep + os.environ["PATH"]


def gpu_name() -> str:
    if shutil.which("nvidia-smi"):
        try:
            out = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
                                 capture_output=True, text=True, timeout=10).stdout.strip().splitlines()
            if out:
                name, mem = (out[0].split(",") + [""])[:2]
                gb = re.search(r"(\d+)", mem)
                return f"{name.strip().replace('NVIDIA GeForce ', '')}" + (f" {round(int(gb.group(1)) / 1024)}GB" if gb else "")
        except (OSError, subprocess.SubprocessError):
            pass
    return "CPU"


class WhisperTranscriber:
    def __init__(self, model_name: str = "large-v3", device: str = "auto", beam_size: int = 5):
        import numpy as np
        from faster_whisper import WhisperModel

        _add_cuda_dlls()
        self.model_name, self.beam_size = model_name, beam_size
        self.device, self.compute = "cpu", "int8"
        model = None
        if device in ("auto", "cuda"):
            try:
                model = WhisperModel(model_name, device="cuda", compute_type="float16")
                segs, _ = model.transcribe(np.zeros(16000, dtype=np.float32), language="ko")
                list(segs)  # 실제로 한 번 돌려 봐야 GPU 가 되는지 안다
                self.device, self.compute = "cuda", "float16"
            except Exception as e:  # noqa: BLE001
                if device == "cuda":
                    raise
                log(f"그래픽카드를 못 써서 CPU 로 돌린다({type(e).__name__})", "일꾼")
                model = None
        if model is None:
            model = WhisperModel(model_name, device="cpu", compute_type="int8")
        self.model = model
        self.engine = f"faster-whisper {model_name} ({self.device}, {self.compute})"
        self.gpu = gpu_name() if self.device == "cuda" else "CPU"

    def transcribe(self, audio, initial_prompt: str | None, language: str = "ko") -> dict:
        audio_sec = len(audio) / 16000
        started = time.time()
        segments, info = self.model.transcribe(
            audio, language=language or "ko", beam_size=self.beam_size, vad_filter=True,
            initial_prompt=(initial_prompt or None), condition_on_previous_text=False,
        )
        raw = [{"start": s.start, "end": s.end, "text": s.text} for s in segments]
        segs = clean_segments(raw, audio_sec)
        return {
            "text": " ".join(s["text"] for s in segs)[:20000],
            "segments": segs,
            "durationSec": round(info.duration or audio_sec, 1),
            "elapsedSec": round(time.time() - started, 1),
            "language": language or "ko",
        }


# ───────────────────────── 일꾼 ─────────────────────────

class Worker:
    def __init__(self, api: Api, token: str, name: str, transcriber_factory, stop: threading.Event,
                 idle_sec: float = 4.0):
        if not token:
            raise SystemExit("WORKER_TOKEN 이 없다(저장소 밖 비밀 폴더의 worker.env 를 확인)")
        self.api, self.token, self.name = api, token, name
        self.factory, self.stop, self.idle_sec = transcriber_factory, stop, idle_sec
        self.tr = None
        self.current_job: str | None = None
        self.done = 0
        self._last_hb_state = None

    # 살아 있음 알리기 — 받아쓰는 동안에도 20초마다 따로 보낸다
    def _heartbeat_loop(self):
        while not self.stop.is_set():
            self.heartbeat()
            self.stop.wait(HEARTBEAT_SEC)

    def heartbeat(self):
        try:
            r = self.api.post_json("/api/worker/heartbeat", self.token, {
                "worker": self.name, "engine": self.tr.engine if self.tr else "loading",
                "gpu": self.tr.gpu if self.tr else "", "version": VERSION}, timeout=15)
            state = "ok" if r.status == 200 else f"HTTP {r.status}"
        except Exception as e:  # noqa: BLE001
            state = f"연결 안 됨({type(e).__name__})"
        if state != self._last_hb_state:
            log(f"서버 신호: {state}", "일꾼")
            self._last_hb_state = state

    def run(self):
        log(f"모델을 올리는 중… (처음이면 내려받기에 몇 분 걸린다)", "일꾼")
        self.tr = self.factory()
        log(f"준비 끝: {self.tr.engine} · {self.tr.gpu} · 이름 {self.name}", "일꾼")
        threading.Thread(target=self._heartbeat_loop, name="heartbeat", daemon=True).start()
        backoff = 5.0
        while not self.stop.is_set():
            try:
                r = self.api.post_json("/api/worker/claim", self.token, {"worker": self.name}, timeout=30)
            except Exception as e:  # noqa: BLE001
                log(f"서버에 닿지 않음({type(e).__name__}) · {int(backoff)}초 뒤 다시", "일꾼")
                self.stop.wait(backoff)
                backoff = min(backoff * 2, 60)
                continue
            backoff = 5.0
            if r.status == 204:
                self.stop.wait(self.idle_sec)
                continue
            if r.status == 200:
                self.process(r.json())
                continue
            if r.status == 401:
                log("토큰이 맞지 않는다(401) · 60초 뒤 다시", "일꾼")
                self.stop.wait(60)
            elif r.status in (404, 503):
                log(f"서버에 일꾼 API 가 아직 없거나 꺼져 있다({r.status}) · 30초 뒤 다시", "일꾼")
                self.stop.wait(30)
            else:
                log(f"claim 응답 {r.status} · 15초 뒤 다시", "일꾼")
                self.stop.wait(15)

    def _fail(self, job_id: str, error: str, retryable: bool):
        try:
            r = self.api.post_json(f"/api/worker/jobs/{urllib.parse.quote(job_id)}/fail", self.token,
                                   {"worker": self.name, "error": error[:300], "retryable": retryable})
            log(f"실패 알림 {job_id} → {r.status} ({'다시 줄 세움' if retryable else '끝'})", "일꾼")
        except Exception as e:  # noqa: BLE001
            log(f"실패 알림도 못 보냄({type(e).__name__}) — 임대 시간이 지나면 서버가 다시 줄 세운다", "일꾼")

    def process(self, job: dict):
        job_id = str(job.get("jobId") or "")
        if not re.fullmatch(r"[A-Za-z0-9_\-]{1,80}", job_id):
            log("일감 번호 형식이 이상해서 건너뛴다", "일꾼")
            return
        self.current_job = job_id
        t0 = time.time()
        try:
            audio_url = str(job.get("audioUrl") or f"/api/worker/jobs/{job_id}/audio")
            if not self.api.same_origin(self.api.url(audio_url)):
                self._fail(job_id, "audioUrl 이 서버 주소와 다르다(일꾼이 거절)", False)
                return
            r = self.api.request("GET", audio_url, self.token, timeout=120, max_bytes=MAX_DOWNLOAD_BYTES)
            if r.status != 200:
                self._fail(job_id, f"오디오 받기 실패 HTTP {r.status}", r.status not in (404, 409))
                return
            want = str(job.get("audioSha256") or "").lower()
            if want and hashlib.sha256(r.body).hexdigest() != want:
                self._fail(job_id, "오디오 SHA-256 이 맞지 않는다(전송 중 깨짐)", True)
                return
            audio = read_wav_16k_mono(r.body)
            t_dl = time.time() - t0
            out = self.tr.transcribe(audio, job.get("initialPrompt"), job.get("language") or "ko")
            payload = {"worker": self.name, "engine": self.tr.engine, **out}
            rr = self.api.post_json(f"/api/worker/jobs/{urllib.parse.quote(job_id)}/result", self.token, payload,
                                    timeout=60)
            self.done += 1
            log(f"받아씀 {job_id}: 녹음 {out['durationSec']}초 · 받기 {t_dl:.1f}초 · 받아쓰기 {out['elapsedSec']}초 · "
                f"{len(out['segments'])}구간 {len(out['text'])}자 → 결과 {rr.status}", "일꾼")
        except BadAudio as e:
            self._fail(job_id, str(e), False)
        except Exception as e:  # noqa: BLE001
            self._fail(job_id, f"{type(e).__name__}: {str(e)[:200]}", True)
        finally:
            self.current_job = None

    def release_current(self):
        if self.current_job:
            self._fail(self.current_job, "일꾼을 멈춤(다시 줄 세움)", True)


# ───────────────────────── 녹음 폴더 감시 → 올리기 ─────────────────────────

def _iso_local(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, KST).isoformat(timespec="seconds")


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


class Uploader:
    """녹음 파일 하나를 /api/ingest 로 올린다. 결과: sent | duplicate | rejected | retry."""

    def __init__(self, api: Api, token: str, device_name: str, fake: bool = True, keep_filename: bool = False):
        if not token:
            raise SystemExit("INGEST_TOKEN 이 없다(저장소 밖 비밀 폴더의 ingest.env 를 확인)")
        self.api, self.token, self.device = api, token, device_name[:40]
        self.fake, self.keep_filename = fake, keep_filename

    def upload(self, path: Path, sha: str) -> tuple[str, dict]:
        size = path.stat().st_size
        if size > MAX_UPLOAD_BYTES:
            return "rejected", {"error": f"too_large({size} bytes)"}
        ext = path.suffix.lower()
        data = path.read_bytes()
        # 실제 통화 녹음 파일 이름에는 이름 · 전화번호가 들어가곤 한다 → 기본은 중립 이름으로 보낸다
        name = path.name if self.keep_filename else f"rec-{sha[:12]}{ext}"
        fields = {"recordedAt": _iso_local(path.stat().st_mtime), "deviceName": self.device}
        if self.fake:
            fields["fake"] = "true"
        body, ctype = encode_multipart(fields, "file", name, MIME.get(ext, "application/octet-stream"), data)
        try:
            r = self.api.request("POST", "/api/ingest", self.token, body=body, content_type=ctype, timeout=120)
        except Exception as e:  # noqa: BLE001
            return "retry", {"error": f"{type(e).__name__}"}
        info = r.json() if isinstance(r.json(), dict) else {}
        if r.status == 201:
            return "sent", {"callId": info.get("callId"), "jobId": info.get("jobId")}
        if r.status == 200 and info.get("status") == "duplicate":
            return "duplicate", {"callId": info.get("callId")}
        if r.status in (400, 413, 415, 422):
            return "rejected", {"error": f"HTTP {r.status} {info.get('error', '')}".strip()}
        return "retry", {"error": f"HTTP {r.status} {info.get('error', '')}".strip()}


class Watcher:
    DONE = {"sent", "duplicate", "rejected", "skipped"}

    def __init__(self, uploader: Uploader, folder: Path, state_path: Path, *, recursive: bool = False,
                 interval: float = 5.0, settle_sec: float = 3.0, skip_existing: bool = False,
                 max_attempts: int = 20, clock=time.time):
        self.up, self.folder, self.state_path = uploader, folder, state_path
        self.recursive, self.interval, self.settle = recursive, interval, settle_sec
        self.skip_existing, self.max_attempts, self.clock = skip_existing, max_attempts, clock
        self.state = self._load()
        self._last_seen: dict[str, tuple[int, int]] = {}
        self._first_scan = True

    def _load(self) -> dict:
        try:
            return json.loads(self.state_path.read_text(encoding="utf-8"))
        except (FileNotFoundError, ValueError):
            return {"files": {}, "seen": {}}

    def _save(self):
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.state_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.state, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, self.state_path)

    def _files(self):
        it = self.folder.rglob("*") if self.recursive else self.folder.glob("*")
        for p in it:
            if p.is_file() and p.suffix.lower() in AUDIO_EXT and not p.name.startswith((".", "~")):
                yield p

    def scan_once(self) -> dict[str, int]:
        counts = {"sent": 0, "duplicate": 0, "rejected": 0, "retry": 0, "skipped": 0}
        now = self.clock()
        for p in sorted(self._files()):
            try:
                st = p.stat()
            except OSError:
                continue
            key = f"{p.resolve()}|{st.st_size}|{st.st_mtime_ns}"
            known = self.state["seen"].get(key)
            if known and self.state["files"].get(known, {}).get("status") in self.DONE:
                continue
            if self._first_scan and self.skip_existing and not known:
                sha = _sha256_file(p)
                self.state["files"].setdefault(sha, {"status": "skipped", "at": _iso_local(now)})
                self.state["seen"][key] = sha
                counts["skipped"] += 1
                continue
            # 아직 쓰는 중인 파일은 건너뛴다: 크기 · 수정 시각이 한 번 더 같고, 마지막 수정에서 settle 초 지나야 올린다
            sig = (st.st_size, st.st_mtime_ns)
            prev = self._last_seen.get(str(p))
            self._last_seen[str(p)] = sig
            if st.st_size == 0 or prev != sig or now - st.st_mtime < self.settle:
                continue
            sha = known or _sha256_file(p)
            self.state["seen"][key] = sha
            rec = self.state["files"].setdefault(sha, {"status": "pending", "attempts": 0})
            if rec.get("status") in self.DONE:
                continue
            if rec.get("nextTryAt", 0) > now:
                continue
            status, info = self.up.upload(p, sha)
            rec["attempts"] = rec.get("attempts", 0) + 1
            rec["lastTryAt"] = _iso_local(now)
            if status == "retry":
                if rec["attempts"] >= self.max_attempts:
                    rec["status"] = "rejected"
                    rec["error"] = f"{info.get('error')} · {self.max_attempts}번 실패해서 그만둠"
                else:
                    wait = min(30 * (2 ** (rec["attempts"] - 1)), 1800) * (0.8 + 0.4 * random.random())
                    rec["status"], rec["nextTryAt"], rec["error"] = "pending", now + wait, info.get("error")
                    log(f"올리기 실패({info.get('error')}) · {int(wait)}초 뒤 다시 · {sha[:10]}", "감시")
            else:
                rec["status"] = status
                rec.update({k: v for k, v in info.items() if v})
                rec.pop("nextTryAt", None)
                label = {"sent": "올림", "duplicate": "이미 있음", "rejected": "거절됨"}[status]
                log(f"{label} {sha[:10]} ({st.st_size // 1024}KB) "
                    f"{info.get('callId') or info.get('error') or ''}", "감시")
            counts[status] += 1
            self._save()
        if self._first_scan:
            self._first_scan = False
            self._save()
        return counts

    def run(self, stop: threading.Event):
        log(f"폴더 감시 시작 · {self.interval:g}초마다 · {'하위 폴더 포함' if self.recursive else '이 폴더만'}", "감시")
        while not stop.is_set():
            try:
                self.scan_once()
            except Exception as e:  # noqa: BLE001
                log(f"감시 중 오류({type(e).__name__}: {str(e)[:120]})", "감시")
            stop.wait(self.interval)


# ───────────────────────── 실행 ─────────────────────────

def default_name() -> str:
    return re.sub(r"[^A-Za-z0-9_\-]", "-", f"pc-{socket.gethostname()}")[:40]


def cmd_check(cfg: Config) -> int:
    print(f"서버: {cfg.server_url or '(없음)'}")
    print(f"WORKER_TOKEN: {'있음' if cfg.worker_token else '없음'} · INGEST_TOKEN: {'있음' if cfg.ingest_token else '없음'}")
    if not cfg.server_url:
        return 1
    api = Api(cfg.server_url)
    for path in ("/healthz", "/api/worker/status"):
        try:
            r = api.request("GET", path)
            print(f"GET {path} → {r.status} {r.body[:160].decode('utf-8', 'replace')}")
        except Exception as e:  # noqa: BLE001
            print(f"GET {path} → 연결 실패({type(e).__name__})")
    print(f"ffmpeg(이 PC): {'있음' if shutil.which('ffmpeg') else '없음(일꾼에는 필요 없음)'} · GPU: {gpu_name()}")
    return 0


def main(argv=None) -> int:
    global _log_file
    ap = argparse.ArgumentParser(description="콜노트 PC 프로그램 — 받아쓰기 일꾼 · 녹음 폴더 감시")
    ap.add_argument("mode", choices=["worker", "watch", "run", "send", "check"])
    ap.add_argument("target", nargs="?", help="watch/run: 감시할 폴더 · send: 올릴 파일")
    ap.add_argument("--server", help="서버 주소(기본: 비밀 폴더의 SERVER_URL)")
    ap.add_argument("--env-file", help="토큰 파일(기본: 저장소 밖 비밀 폴더의 worker.env · ingest.env)")
    ap.add_argument("--name", default=default_name(), help="일꾼 · 보낸 PC 이름(영문 · 숫자 · - · _)")
    ap.add_argument("--model", default="large-v3", help="Whisper 모델(기본 large-v3)")
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    ap.add_argument("--recursive", action="store_true", help="하위 폴더까지 감시")
    ap.add_argument("--interval", type=float, default=5.0, help="폴더 확인 간격(초)")
    ap.add_argument("--skip-existing", action="store_true", help="처음 볼 때 이미 있던 파일은 올리지 않는다")
    ap.add_argument("--keep-filename", action="store_true", help="원래 파일 이름으로 보낸다(기본은 중립 이름)")
    ap.add_argument("--not-fake", action="store_true",
                    help="가짜 표시 없이 보낸다(공개 데모 서버는 거절한다 — 실제 녹음은 동의 · 가림 절차 뒤에만)")
    ap.add_argument("--state", help="감시 기록 파일(기본: %%LOCALAPPDATA%%\\callnote-agent\\watch-<폴더>.json)")
    args = ap.parse_args(argv)

    cfg = load_config(args.server, args.env_file)
    if args.mode == "check":
        return cmd_check(cfg)
    if not cfg.server_url:
        raise SystemExit("SERVER_URL 이 없다(--server 또는 비밀 폴더의 worker.env)")
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    _log_file = STATE_DIR / "agent.log"
    api = Api(cfg.server_url)
    stop = threading.Event()
    log(f"콜노트 PC 프로그램 {VERSION} · {args.mode} · 서버 {cfg.server_url} · {platform.node()}")

    if args.mode == "send":
        if not args.target:
            raise SystemExit("올릴 파일을 적어 주세요")
        p = Path(args.target)
        up = Uploader(api, cfg.ingest_token, args.name, fake=not args.not_fake, keep_filename=args.keep_filename)
        sha = _sha256_file(p)
        t0 = time.time()
        status, info = up.upload(p, sha)
        log(f"{status} {json.dumps(info, ensure_ascii=False)} ({time.time() - t0:.1f}초)", "보내기")
        return 0 if status in ("sent", "duplicate") else 1

    threads = []
    if args.mode in ("watch", "run"):
        if not args.target or not Path(args.target).is_dir():
            raise SystemExit("감시할 폴더를 적어 주세요(있는 폴더여야 한다)")
        folder = Path(args.target).resolve()
        state = Path(args.state) if args.state else STATE_DIR / f"watch-{hashlib.sha1(str(folder).encode()).hexdigest()[:10]}.json"
        log("공개 데모 서버에는 가짜(연습) 녹음만 보낸다. 실제 통화 녹음 폴더를 지정하지 않는다.", "감시")
        up = Uploader(api, cfg.ingest_token, args.name, fake=not args.not_fake, keep_filename=args.keep_filename)
        w = Watcher(up, folder, state, recursive=args.recursive, interval=args.interval,
                    skip_existing=args.skip_existing)
        t = threading.Thread(target=w.run, args=(stop,), name="watch", daemon=True)
        threads.append(t)
        t.start()

    worker = None
    try:
        if args.mode in ("worker", "run"):
            worker = Worker(api, cfg.worker_token, args.name,
                            lambda: WhisperTranscriber(args.model, args.device), stop)
            worker.run()
        else:
            while not stop.is_set():
                stop.wait(1)
    except KeyboardInterrupt:
        log("멈춤 요청을 받았다")
    finally:
        stop.set()
        if worker:
            worker.release_current()
    return 0


if __name__ == "__main__":
    sys.exit(main())

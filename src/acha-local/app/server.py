"""단어장 받아쓰기 — PC 안에서만 도는 작은 서버와 화면.

이 컴퓨터(127.0.0.1)에서만 열리고, 실행할 때마다 바뀌는 비밀 표(token)가 있어야 API 를 쓸 수 있다.
녹음 · 단어장 · 받아쓴 글은 모두 %LOCALAPPDATA%\\AchaLocal 에만 저장한다. 인터넷은 모델을 받을 때만 쓴다.
"""
from __future__ import annotations

import json
import logging
import mimetypes
import os
import queue
import re
import secrets
import shutil
import sys
import threading
import time
import traceback
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

from glossary_stt import __version__
from glossary_stt import engine as eng
from glossary_stt import evaluate, gpu, pipeline
from glossary_stt.correct import Corrector, pieces_text, to_pieces
from glossary_stt.glossary import Entry, Glossary

DATA = eng.app_dir()
GLOSS_DIR = DATA / "glossaries"
NOTES_DIR = DATA / "notes"
UPLOAD_DIR = DATA / "uploads"
SETTINGS = DATA / "settings.json"
WEB = eng.bundle_dir() / "app" / "web"
EXAMPLES = eng.bundle_dir() / "glossary_stt" / "examples"
SAMPLES = eng.bundle_dir() / "samples"
MAX_UPLOAD = 4 * 1024 ** 3
_NAME_RE = re.compile(r'[\\/:*?"<>|\x00-\x1f]')

log = logging.getLogger("glossary-stt")


def safe_name(name: str) -> str:
    name = _NAME_RE.sub("", (name or "").strip())[:60].strip(" .")
    if not name:
        raise ValueError("이름이 비어 있습니다.")
    return name


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
class App:
    def __init__(self):
        for d in (GLOSS_DIR, NOTES_DIR, UPLOAD_DIR):
            d.mkdir(parents=True, exist_ok=True)
        if not any(GLOSS_DIR.glob("*.csv")) and EXAMPLES.is_dir():
            for f in EXAMPLES.glob("*.csv"):
                shutil.copy(f, GLOSS_DIR / f.name)
        self.settings = {"model": "large-v3-turbo", "device": "auto", "language": "ko", "glossary": "", "context": ""}
        try:
            self.settings.update(json.loads(SETTINGS.read_text(encoding="utf-8")))
        except Exception:  # noqa: BLE001
            pass
        self.token = secrets.token_urlsafe(24)
        self.engine: eng.Engine | None = None
        self.engine_state = {"state": "none", "message": "", "model": ""}
        self.download = {"state": "idle", "model": "", "done": 0, "total": 0, "message": ""}
        self.jobs: dict[str, dict] = {}
        self.queue: queue.Queue = queue.Queue()
        self.cancels: dict[str, threading.Event] = {}
        self.last_ping = time.time()
        self.gloss_lock = threading.Lock()
        self.gpu = {"nvidia": gpu.has_nvidia(), "state": "idle", "done": 0, "total": 0, "message": ""}
        threading.Thread(target=self._worker, daemon=True).start()
        if eng.local_model_path(self.settings["model"]):
            threading.Thread(target=self.load_model, args=(self.settings["model"],), daemon=True).start()

    # ---- 설정 · 모델 ----
    def save_settings(self):
        SETTINGS.write_text(json.dumps(self.settings, ensure_ascii=False, indent=1), encoding="utf-8")

    def load_model(self, name: str):
        self.engine_state = {"state": "loading", "message": f"{name} 모델을 여는 중", "model": name}
        try:
            self.engine = eng.load_engine(name, self.settings.get("device", "auto"))
            self.engine_state = {"state": "ready", "message": self.engine.label, "model": name}
        except Exception as e:  # noqa: BLE001
            log.exception("모델 열기 실패")
            self.engine = None
            self.engine_state = {"state": "error", "message": str(e), "model": name}

    def start_download(self, name: str):
        if name not in eng.MODELS:
            raise ValueError("모르는 모델")
        if self.download["state"] == "running":
            raise ValueError("이미 받는 중입니다.")
        self.download = {"state": "running", "model": name, "done": 0, "total": eng.MODELS[name]["sizeMB"] << 20, "message": ""}

        def run():
            try:
                eng.download_model(name, lambda d, t: self.download.update(done=d, total=t))
                self.download.update(state="done")
                if self.engine is None or self.settings["model"] == name:
                    self.settings["model"] = name
                    self.save_settings()
                    self.load_model(name)
            except Exception as e:  # noqa: BLE001
                log.exception("모델 받기 실패")
                self.download.update(state="error", message=f"받지 못했습니다: {e}")

        threading.Thread(target=run, daemon=True).start()

    def start_gpu_install(self):
        if self.gpu["state"] == "running":
            raise ValueError("이미 받는 중입니다.")
        self.gpu.update(state="running", done=0, total=0, message="")

        def run():
            try:
                gpu.install(lambda d, t, _n: self.gpu.update(done=d, total=t))
                # 한 번 CPU 로 연 프로그램 안에서 그래픽카드로 다시 열면 멈추는 일이 있었다(설치본 시험).
                # 그래서 여기서 다시 열지 않고, 새로 켜게 한다. 새로 켜면 바로 그래픽카드로 연다.
                self.gpu.update(state="done", message="다 받았어요. 프로그램을 닫았다가 다시 열면 그래픽카드로 받아써요.")
            except Exception as e:  # noqa: BLE001
                log.exception("GPU 가속 받기 실패")
                self.gpu.update(state="error", message=f"받지 못했습니다: {e}")

        threading.Thread(target=run, daemon=True).start()

    def state(self) -> dict:
        models = []
        for key, info in eng.MODELS.items():
            models.append({"id": key, **info, "installed": eng.local_model_path(key) is not None})
        custom = self.settings.get("model")
        if custom and custom not in eng.MODELS:
            models.append({"id": custom, "label": "직접 지정한 폴더", "sizeMB": 0, "repo": "", "installed": os.path.isdir(custom)})
        return {
            "version": __version__, "engine": self.engine_state, "download": self.download, "settings": self.settings,
            "models": models, "dataDir": str(DATA), "cudaDirs": eng.add_cuda_dlls() if sys.platform == "win32" else [],
            "gpu": {**self.gpu, "packInstalled": gpu.installed()},
            "busy": sum(1 for j in self.jobs.values() if j["state"] in ("queued", "running")),
            "samples": [p.name for p in SAMPLES.iterdir() if (p / "reference.txt").is_file()] if SAMPLES.is_dir() else [],
        }

    # ---- 단어장 ----
    def glossary_path(self, name: str) -> Path:
        return GLOSS_DIR / f"{safe_name(name)}.csv"

    def glossary(self, name: str) -> Glossary | None:
        if not name:
            return None
        p = self.glossary_path(name)
        return Glossary.load(p) if p.is_file() else None

    def glossaries(self) -> list[dict]:
        out = []
        for p in sorted(GLOSS_DIR.glob("*.csv"), key=lambda x: x.stem):
            try:
                n = len(Glossary.load(p).entries)
            except Exception:  # noqa: BLE001
                n = 0
            out.append({"name": p.stem, "count": n})
        return out

    def plan(self, g: Glossary | None, context: str) -> dict:
        return pipeline.plan_for(g, context, self.engine).to_dict()

    def bump_hits(self, name: str, hits: dict[str, int]):
        if not name or not hits:
            return
        with self.gloss_lock:
            g = self.glossary(name)
            if g is None:
                return
            for e in g.entries:
                if e.term in hits:
                    e.hits += hits[e.term]
            g.save(self.glossary_path(name))

    # ---- 일 ----
    def submit(self, kind: str, params: dict) -> str:
        jid = uuid.uuid4().hex[:12]
        self.jobs[jid] = {"id": jid, "kind": kind, "state": "queued", "stage": "기다리는 중", "progress": 0.0,
                          "result": None, "error": None, "created": time.time(), "title": params.get("title", "")}
        self.cancels[jid] = threading.Event()
        self.queue.put((jid, kind, params))
        return jid

    def _worker(self):
        while True:
            jid, kind, params = self.queue.get()
            job = self.jobs[jid]
            if self.cancels[jid].is_set():
                job["state"] = "cancelled"
                continue
            job["state"] = "running"
            try:
                self._ensure_engine(job)

                def prog(stage, x):
                    job["stage"], job["progress"] = stage, round(x, 3)

                if kind == "transcribe":
                    job["result"] = self._transcribe(params, prog, self.cancels[jid])
                elif kind == "eval":
                    job["result"] = self._eval(params, prog, self.cancels[jid])
                job["state"] = "done"
            except InterruptedError:
                job["state"] = "cancelled"
            except Exception as e:  # noqa: BLE001
                log.error("일 실패: %s", traceback.format_exc())
                job["state"], job["error"] = "error", str(e)

    def _ensure_engine(self, job):
        if self.engine is not None:
            return
        name = self.settings["model"]
        if not eng.local_model_path(name):
            raise RuntimeError("받아쓰기 모델이 아직 없습니다. 설정에서 모델을 먼저 받아 주세요.")
        job["stage"] = "모델을 여는 중"
        self.load_model(name)
        if self.engine is None:
            raise RuntimeError(self.engine_state["message"])

    def _transcribe(self, p: dict, prog, cancel) -> dict:
        audio_path = Path(p["audio"])
        prog("소리를 푸는 중", 0.0)
        audio = eng.load_audio(str(audio_path))
        g = self.glossary(p.get("glossary", ""))
        res = pipeline.run(self.engine, audio, g, p.get("context", ""), p.get("language") or None,
                           progress=prog, cancel=cancel)
        nid = p.get("noteId") or (datetime.now().strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:4])
        note_audio = NOTES_DIR / f"{nid}{audio_path.suffix.lower() or '.bin'}"
        if audio_path != note_audio:
            shutil.move(str(audio_path), note_audio)
        note = {
            "id": nid, "title": p.get("title") or audio_path.stem, "created": now_iso(),
            "glossary": p.get("glossary", ""), "context": p.get("context", ""), "language": p.get("language", ""),
            "audio": note_audio.name, **res,
        }
        (NOTES_DIR / f"{nid}.json").write_text(json.dumps(note, ensure_ascii=False), encoding="utf-8")
        self.bump_hits(note["glossary"], res.get("hits", {}))
        return {"noteId": nid}

    def _eval(self, p: dict, prog, cancel) -> dict:
        audio = eng.load_audio(p["audio"])
        g = self.glossary(p.get("glossary", "")) or Glossary("빈 단어장")
        res = evaluate.compare(self.engine, audio, p["reference"], g, p.get("context", ""),
                               p.get("language") or None, progress=prog, cancel=cancel)
        res["engine"] = self.engine.label
        res["glossary"] = p.get("glossary", "")
        if p.get("cleanup"):
            Path(p["audio"]).unlink(missing_ok=True)
        return res

    # ---- 기록 ----
    def note_path(self, nid: str) -> Path:
        if not re.fullmatch(r"[0-9A-Za-z\-]{6,40}", nid):
            raise ValueError("잘못된 기록 번호")
        return NOTES_DIR / f"{nid}.json"

    def notes(self) -> list[dict]:
        out = []
        for p in sorted(NOTES_DIR.glob("*.json"), reverse=True):
            try:
                n = json.loads(p.read_text(encoding="utf-8"))
                out.append({"id": n["id"], "title": n.get("title", ""), "created": n.get("created", ""),
                            "duration": n.get("meta", {}).get("duration"), "glossary": n.get("glossary", ""),
                            "preview": " ".join(pieces_text(s["pieces"]) for s in n.get("segments", [])[:3])[:120]})
            except Exception:  # noqa: BLE001
                continue
        return out


# ---------------------------------------------------------------------------
def fmt_time(sec: float, srt: bool = False) -> str:
    sec = max(0.0, float(sec))
    h, rem = divmod(int(sec), 3600)
    m, s = divmod(rem, 60)
    if srt:
        return f"{h:02d}:{m:02d}:{s:02d},{int((sec % 1) * 1000):03d}"
    return f"{h:d}:{m:02d}:{s:02d}" if h else f"{m:d}:{s:02d}"


def export_note(note: dict, fmt: str) -> tuple[str, str]:
    segs = [(s["start"], s["end"], s.get("edited") or pieces_text(s["pieces"])) for s in note["segments"]]
    if fmt == "srt":
        body = "\n".join(f"{i}\n{fmt_time(a, True)} --> {fmt_time(b, True)}\n{t}\n" for i, (a, b, t) in enumerate(segs, 1))
        return body, "application/x-subrip"
    if fmt == "md":
        lines = [f"# {note.get('title', '')}", "", f"- 날짜: {note.get('created', '')}",
                 f"- 단어장: {note.get('glossary') or '없음'}", ""]
        lines += [f"**[{fmt_time(a)}]** {t}  " for a, _b, t in segs]
        return "\n".join(lines) + "\n", "text/markdown"
    return "\n".join(f"[{fmt_time(a)}] {t}" for a, _b, t in segs) + "\n", "text/plain"


class Handler(BaseHTTPRequestHandler):
    app: App = None  # type: ignore
    server_version = "AchaLocal"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # noqa: A003
        log.debug("%s - %s", self.address_string(), fmt % args)

    # ---- 응답 ----
    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, text: str, ctype: str, filename: str | None = None, status=200):
        body = text.encode("utf-8-sig" if ctype == "text/csv" else "utf-8")
        self.send_response(status)
        self.send_header("Content-Type", f"{ctype}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if filename:
            self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{quote(filename)}")
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path: Path, ctype: str | None = None):
        size = path.stat().st_size
        ctype = ctype or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        status = 200
        m = re.match(r"bytes=(\d*)-(\d*)", rng or "")
        if m and size:
            if m.group(1):
                start = int(m.group(1))
                end = int(m.group(2)) if m.group(2) else size - 1
            elif m.group(2):
                start = max(0, size - int(m.group(2)))
            end = min(end, size - 1)
            status = 206
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = f.read(min(1 << 20, left))
                if not chunk:
                    break
                self.wfile.write(chunk)
                left -= len(chunk)

    def fail(self, status, msg):
        self.send_json({"error": msg}, status)

    # ---- 확인 ----
    def host_ok(self) -> bool:
        port = self.server.server_address[1]
        return self.headers.get("Host", "") in (f"127.0.0.1:{port}", f"localhost:{port}")

    def token_ok(self, qs) -> bool:
        tok = self.headers.get("X-Token") or (qs.get("t") or [""])[0]
        return secrets.compare_digest(tok, self.app.token)

    def body(self, limit=20 << 20) -> bytes:
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            raise ValueError("너무 큽니다.")
        return self.rfile.read(n) if n else b""

    def json_body(self) -> dict:
        raw = self.body()
        return json.loads(raw.decode("utf-8")) if raw else {}

    # ---- 길 ----
    def do_GET(self):  # noqa: N802
        self.route("GET")

    def do_POST(self):  # noqa: N802
        self.route("POST")

    def do_PUT(self):  # noqa: N802
        self.route("PUT")

    def do_DELETE(self):  # noqa: N802
        self.route("DELETE")

    def route(self, method: str):
        if not self.host_ok():
            return self.fail(403, "이 컴퓨터에서만 열 수 있습니다.")
        u = urlparse(self.path)
        qs = parse_qs(u.query)
        path = u.path
        try:
            if method == "GET" and (path == "/" or path.startswith("/web/")):
                return self.static(path)
            if not path.startswith("/api/"):
                return self.fail(404, "없는 주소")
            if not self.token_ok(qs):
                return self.fail(401, "프로그램을 다시 열어 주세요.")
            return self.api(method, path[5:], qs)
        except (ValueError, KeyError, FileNotFoundError) as e:
            return self.fail(400, str(e))
        except Exception as e:  # noqa: BLE001
            log.error("요청 실패: %s", traceback.format_exc())
            return self.fail(500, f"문제가 생겼습니다: {e}")

    def static(self, path: str):
        rel = "index.html" if path == "/" else path[len("/web/"):]
        f = (WEB / rel).resolve()
        if WEB.resolve() not in f.parents or not f.is_file():
            return self.fail(404, "없는 파일")
        ctype = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        if f.suffix in (".js", ".css", ".html"):
            ctype += "; charset=utf-8"
        data = f.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def api(self, method: str, path: str, qs: dict):  # noqa: C901
        a = self.app
        q = lambda k, d="": (qs.get(k) or [d])[0]  # noqa: E731
        a.last_ping = time.time()

        if path == "state" and method == "GET":
            return self.send_json(a.state())
        if path == "ping":
            return self.send_json({"ok": True})
        if path == "settings" and method == "POST":
            body = self.json_body()
            for k in ("model", "device", "language", "glossary", "context"):
                if k in body:
                    a.settings[k] = str(body[k])
            a.save_settings()
            if "model" in body or "device" in body:
                a.engine = None
                if eng.local_model_path(a.settings["model"]):
                    threading.Thread(target=a.load_model, args=(a.settings["model"],), daemon=True).start()
                else:
                    a.engine_state = {"state": "none", "message": "", "model": a.settings["model"]}
            return self.send_json(a.state())
        if path == "model/download" and method == "POST":
            a.start_download(self.json_body()["model"])
            return self.send_json(a.state())
        if path == "gpu/install" and method == "POST":
            a.start_gpu_install()
            return self.send_json(a.state())
        if path == "open-data" and method == "POST":
            if sys.platform == "win32":
                os.startfile(str(DATA))  # noqa: S606
            return self.send_json({"ok": True})

        # 단어장
        if path == "glossaries" and method == "GET":
            return self.send_json(a.glossaries())
        if path == "glossary":
            name = q("name")
            if method == "GET":
                g = a.glossary(name)
                if g is None:
                    return self.fail(404, "없는 단어장")
                return self.send_json({"name": g.name, "entries": [e.to_dict() for e in g.entries],
                                       "plan": a.plan(g, q("context"))})
            if method == "PUT":
                body = self.json_body()
                g = Glossary(safe_name(name), [Entry.from_dict(x) for x in body.get("entries", [])]).clean()
                with a.gloss_lock:
                    g.save(a.glossary_path(name))
                return self.send_json({"ok": True, "count": len(g.entries), "plan": a.plan(g, body.get("context", ""))})
            if method == "DELETE":
                p = a.glossary_path(name)
                if p.is_file():
                    p.unlink()
                return self.send_json({"ok": True})
        if path == "glossary/plan" and method == "POST":
            body = self.json_body()
            g = Glossary("미리보기", [Entry.from_dict(x) for x in body.get("entries", [])]).clean()
            return self.send_json(a.plan(g, body.get("context", "")))
        if path == "glossary/create" and method == "POST":
            body = self.json_body()
            name = safe_name(body["name"])
            p = a.glossary_path(name)
            if p.exists():
                raise ValueError("같은 이름의 단어장이 있습니다.")
            src = a.glossary(body.get("copyFrom", "")) if body.get("copyFrom") else None
            Glossary(name, list(src.entries) if src else []).save(p)
            return self.send_json({"ok": True, "name": name})
        if path == "glossary/rename" and method == "POST":
            body = self.json_body()
            old, new = a.glossary_path(body["name"]), a.glossary_path(body["newName"])
            if new.exists():
                raise ValueError("같은 이름의 단어장이 있습니다.")
            old.rename(new)
            if a.settings.get("glossary") == body["name"]:
                a.settings["glossary"] = new.stem
                a.save_settings()
            return self.send_json({"ok": True, "name": new.stem})
        if path == "glossary/import" and method == "POST":
            name = safe_name(q("name"))
            text = self.body().decode("utf-8-sig", errors="replace")
            looks_csv = "," in text.splitlines()[0] if text.strip() else False
            incoming = Glossary.from_csv(name, text) if looks_csv else Glossary.from_text_lines(name, text)
            with a.gloss_lock:
                cur = a.glossary(name) if q("mode") == "merge" else None
                g = Glossary(name, (cur.entries if cur else []) + incoming.entries).clean()
                g.save(a.glossary_path(name))
            return self.send_json({"ok": True, "name": name, "count": len(g.entries), "added": len(incoming.entries)})
        if path == "glossary/export" and method == "GET":
            g = a.glossary(q("name"))
            if g is None:
                return self.fail(404, "없는 단어장")
            return self.send_text(g.to_csv(), "text/csv", f"{g.name}.csv")
        if path == "glossary/learn" and method == "POST":
            body = self.json_body()
            name = safe_name(body["name"])
            with a.gloss_lock:
                g = a.glossary(name) or Glossary(name)
                e = g.learn(body["term"], body.get("alias"))
                g.clean().save(a.glossary_path(name))
            return self.send_json({"ok": True, "entry": e.to_dict()})

        # 받아쓰기 · 효과 재기
        if path == "upload" and method == "POST":
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > MAX_UPLOAD:
                raise ValueError("파일 크기가 맞지 않습니다.")
            ext = Path(q("name", "audio.bin")).suffix.lower()[:8] or ".bin"
            if not re.fullmatch(r"\.[0-9a-z]{1,7}", ext):
                ext = ".bin"
            uid = uuid.uuid4().hex
            dest = UPLOAD_DIR / f"{uid}{ext}"
            with open(dest, "wb") as f:
                left = n
                while left > 0:
                    chunk = self.rfile.read(min(1 << 20, left))
                    if not chunk:
                        break
                    f.write(chunk)
                    left -= len(chunk)
            return self.send_json({"uploadId": dest.name})
        if path in ("transcribe", "eval") and method == "POST":
            body = self.json_body()
            if body.get("sample"):
                sdir = SAMPLES / safe_name(body["sample"])
                src = next(p for p in sdir.iterdir() if p.stem == "audio")
                dest = UPLOAD_DIR / f"{uuid.uuid4().hex}{src.suffix}"
                shutil.copy(src, dest)
                body.setdefault("reference", (sdir / "reference.txt").read_text(encoding="utf-8"))
                body.setdefault("title", body["sample"])
            elif body.get("noteId"):
                note = json.loads(a.note_path(body["noteId"]).read_text(encoding="utf-8"))
                src = NOTES_DIR / note["audio"]
                dest = UPLOAD_DIR / f"{uuid.uuid4().hex}{src.suffix}"
                shutil.copy(src, dest)
                body.setdefault("title", note.get("title"))
            else:
                up = body.get("uploadId", "")
                if not re.fullmatch(r"[0-9a-f]{32}\.[0-9a-z]{1,7}", up):
                    raise ValueError("올린 파일을 찾지 못했습니다.")
                dest = UPLOAD_DIR / up
                if not dest.is_file():
                    raise ValueError("올린 파일을 찾지 못했습니다.")
            params = {"audio": str(dest), "glossary": body.get("glossary", ""), "context": body.get("context", ""),
                      "language": body.get("language", "ko"), "title": body.get("title", "")}
            if path == "eval":
                if not str(body.get("reference", "")).strip():
                    raise ValueError("정답 글이 비어 있습니다.")
                params.update(reference=body["reference"], cleanup=True)
            elif body.get("noteId") and body.get("replace"):
                params["noteId"] = body["noteId"]
            return self.send_json({"jobId": a.submit(path, params)})
        m = re.fullmatch(r"jobs/([0-9a-f]{12})(/cancel)?", path)
        if m:
            job = a.jobs.get(m.group(1))
            if job is None:
                return self.fail(404, "없는 일")
            if m.group(2) and method == "POST":
                a.cancels[job["id"]].set()
            return self.send_json(job)
        if path == "jobs" and method == "GET":
            return self.send_json(sorted(a.jobs.values(), key=lambda j: -j["created"])[:20])

        # 기록
        if path == "notes" and method == "GET":
            return self.send_json(a.notes())
        m = re.fullmatch(r"notes/([0-9A-Za-z\-]{6,40})(/audio|/export)?", path)
        if m:
            p = a.note_path(m.group(1))
            if not p.is_file():
                return self.fail(404, "없는 기록")
            note = json.loads(p.read_text(encoding="utf-8"))
            if m.group(2) == "/audio":
                return self.send_file(NOTES_DIR / note["audio"])
            if m.group(2) == "/export":
                fmt = q("fmt", "txt")
                text, ctype = export_note(note, fmt)
                return self.send_text(text, ctype, f"{note.get('title', 'note')}.{fmt}")
            if method == "GET":
                return self.send_json(note)
            if method == "PUT":
                body = self.json_body()
                if "title" in body:
                    note["title"] = str(body["title"])[:200]
                if "segments" in body:
                    old = note["segments"]
                    new = body["segments"]
                    if len(new) != len(old):
                        raise ValueError("문단 수가 다릅니다.")
                    for o, n in zip(old, new):
                        o["pieces"] = n["pieces"]
                        if n.get("edited") is not None:
                            o["edited"] = str(n["edited"])
                        else:
                            o.pop("edited", None)
                p.write_text(json.dumps(note, ensure_ascii=False), encoding="utf-8")
                return self.send_json({"ok": True})
            if method == "DELETE":
                (NOTES_DIR / note["audio"]).unlink(missing_ok=True)
                p.unlink()
                return self.send_json({"ok": True})
        m = re.fullmatch(r"notes/([0-9A-Za-z\-]{6,40})/recorrect", path)
        if m and method == "POST":
            # 단어장을 고친 뒤, 다시 듣지 않고 고치기만 새로 한다.
            p = a.note_path(m.group(1))
            note = json.loads(p.read_text(encoding="utf-8"))
            g = a.glossary(note.get("glossary", ""))
            c = Corrector(g) if g else None
            for s in note["segments"]:
                s["pieces"] = to_pieces(s["raw"], c.find(s["raw"]) if c else [])
                s.pop("edited", None)
            p.write_text(json.dumps(note, ensure_ascii=False), encoding="utf-8")
            return self.send_json(note)
        if path == "quit" and method == "POST":
            self.send_json({"ok": True})
            threading.Thread(target=lambda: (time.sleep(0.3), os._exit(0)), daemon=True).start()
            return None
        return self.fail(404, "없는 기능")


def serve(port: int = 0) -> tuple[ThreadingHTTPServer, App]:
    app = App()
    Handler.app = app
    httpd = None
    for p in ([port] if port else [5711, 5712, 5713, 0]):
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", p), Handler)
            break
        except OSError:
            continue
    if httpd is None:
        raise RuntimeError("열 수 있는 포트가 없습니다.")
    httpd.daemon_threads = True
    return httpd, app

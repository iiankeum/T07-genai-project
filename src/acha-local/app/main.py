"""프로그램 시작점: 서버를 켜고 창을 띄운다.

창은 Windows 에 늘 깔려 있는 Edge 를 「앱 모드」(주소창 없는 창)로 연다. Edge 가 없으면 기본 브라우저로 연다.
창을 닫으면(또는 2분 동안 화면이 응답하지 않고 하는 일이 없으면) 프로그램도 끝난다.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from glossary_stt.engine import app_dir  # noqa: E402

RUN_FILE = app_dir() / "run.json"


def setup_logging() -> None:
    logs = app_dir() / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(filename=str(logs / "app.log"), level=logging.INFO, encoding="utf-8",
                        format="%(asctime)s %(levelname)s %(message)s")


def find_edge() -> str | None:
    for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles"), os.environ.get("LOCALAPPDATA")):
        if base:
            p = Path(base) / "Microsoft" / "Edge" / "Application" / "msedge.exe"
            if p.is_file():
                return str(p)
    return None


def open_window(url: str) -> subprocess.Popen | None:
    edge = find_edge()
    if edge:
        profile = app_dir() / "window"
        args = [edge, f"--app={url}", f"--user-data-dir={profile}", "--no-first-run", "--no-default-browser-check",
                "--disable-features=Translate", "--window-size=1280,880"]
        try:
            return subprocess.Popen(args, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        except OSError:
            pass
    webbrowser.open(url)
    return None


def already_running() -> str | None:
    """이미 켜져 있으면 그 주소를 돌려준다(창만 하나 더 연다)."""
    try:
        info = json.loads(RUN_FILE.read_text(encoding="utf-8"))
        url = f"http://127.0.0.1:{info['port']}/api/ping?t={info['token']}"
        with urllib.request.urlopen(url, timeout=1.5) as r:
            if r.status == 200:
                return f"http://127.0.0.1:{info['port']}/?t={info['token']}"
    except Exception:  # noqa: BLE001
        pass
    return None


def main() -> None:
    setup_logging()
    no_window = "--no-window" in sys.argv
    port = next((int(a.split("=", 1)[1]) for a in sys.argv if a.startswith("--port=")), 0)
    if not no_window:
        url = already_running()
        if url:
            open_window(url)
            return

    from app.server import serve
    httpd, app = serve(port)
    port = httpd.server_address[1]
    RUN_FILE.write_text(json.dumps({"port": port, "token": app.token, "pid": os.getpid()}), encoding="utf-8")
    url = f"http://127.0.0.1:{port}/?t={app.token}"
    logging.info("시작: %s", url.split("?")[0])
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    if no_window:
        if sys.stdout is not None:  # 창 없는 설치본(exe)에는 표준 출력이 없다
            print(url, flush=True)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            return

    proc = open_window(url)
    try:
        while True:
            time.sleep(2)
            busy = any(j["state"] in ("queued", "running") for j in app.jobs.values())
            if proc is not None and proc.poll() is not None and not busy:
                # Edge 창이 닫혔다. 같은 프로필 창이 다른 프로세스로 넘어갔을 수 있으니 응답이 끊겼는지도 본다.
                if time.time() - app.last_ping > 15:
                    break
            if proc is None and time.time() - app.last_ping > 120 and not busy:
                break
    finally:
        RUN_FILE.unlink(missing_ok=True)
        httpd.shutdown()


if __name__ == "__main__":
    main()

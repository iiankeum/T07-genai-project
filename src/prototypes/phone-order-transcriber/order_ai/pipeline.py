"""녹음(또는 받아쓴 글) 파일 하나를 주문 카드로 만드는 전체 흐름."""
from __future__ import annotations

import time
from datetime import datetime
from pathlib import Path
from typing import Callable

from .config import Settings, load_settings
from .extract import extract
from .glossary import Glossary
from .store import Store
from .stt import AUDIO_EXTS, TEXT_EXTS, transcribe

MAX_ATTEMPTS = 5  # 폴더 감시에서 같은 파일을 다시 시도하는 최대 횟수


class Pipeline:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or load_settings()
        self.store = Store(self.settings.db_path)
        self.glossary = Glossary.load(self.settings.glossary_path)

    def process_file(self, path: Path, source_name: str | None = None, call_at: datetime | None = None) -> int:
        path = Path(path)
        raw = transcribe(path, self.settings, self.glossary)
        result = extract(raw, self.settings, self.glossary)
        if call_at is None:  # 통화 시각을 모르면 파일 수정 시각을 쓴다
            call_at = datetime.fromtimestamp(path.stat().st_mtime)
        return self.store.add(
            call_at=call_at,
            source_name=source_name or path.name,
            audio_path=str(path) if path.suffix.lower() in AUDIO_EXTS else None,
            transcript_raw=raw,
            transcript=result.transcript,
            card=result.card,
            extractor=result.extractor,
            warnings=result.warnings,
            ai_transcript=result.ai_transcript,
        )

    def scan_folder(self, folder: Path, on_event: Callable[[str], None] = print) -> list[int]:
        """폴더에서 새로 생겼거나 바뀐 녹음·글 파일을 처리한다.

        성공한 파일만 '처리 완료'로 기록한다. 실패한 파일은 원인과 횟수를 남기고
        다음 확인 때 다시 시도한다 (같은 파일 기준 최대 MAX_ATTEMPTS회, 파일이 바뀌면 처음부터).
        """
        ids: list[int] = []
        exts = AUDIO_EXTS | TEXT_EXTS
        for p in sorted(Path(folder).iterdir()):
            if not p.is_file() or p.suffix.lower() not in exts or p.name.startswith("."):
                continue
            key, mtime = str(p.resolve()), p.stat().st_mtime
            if time.time() - mtime < 2:  # 아직 저장 중일 수 있음
                continue
            state = self.store.file_state(key)
            same_file = state is not None and abs(state["mtime"] - mtime) < 1e-6
            if same_file and (state["status"] == "done" or state["attempts"] >= MAX_ATTEMPTS):
                continue
            attempts = (state["attempts"] if same_file else 0) + 1
            try:
                cid = self.process_file(p)
            except Exception as e:  # 한 파일이 실패해도 감시는 계속
                self.store.mark_failed(key, mtime, f"{type(e).__name__}: {e}", attempts)
                more = "다시 시도함" if attempts < MAX_ATTEMPTS else "더 시도하지 않음, 파일을 확인해 주세요"
                on_event(f"[실패 {attempts}/{MAX_ATTEMPTS}] {p.name}: {e} — {more}")
                continue
            self.store.mark_done(key, mtime, cid)
            ids.append(cid)
            on_event(f"[처리] {p.name} → 카드 #{cid}")
        return ids

    def watch(self, folder: Path, interval: float = 5.0, on_event: Callable[[str], None] = print) -> None:
        on_event(f"폴더 감시 시작: {folder} ({interval:.0f}초마다 확인, 멈추려면 Ctrl+C)")
        while True:
            self.scan_folder(folder, on_event)
            time.sleep(interval)

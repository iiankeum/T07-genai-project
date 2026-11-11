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
        )

    def scan_folder(self, folder: Path, on_event: Callable[[str], None] = print) -> list[int]:
        """폴더에서 새로 생긴 녹음·글 파일만 처리한다."""
        ids: list[int] = []
        exts = AUDIO_EXTS | TEXT_EXTS
        for p in sorted(Path(folder).iterdir()):
            if not p.is_file() or p.suffix.lower() not in exts or p.name.startswith("."):
                continue
            mtime = p.stat().st_mtime
            if self.store.is_processed(str(p.resolve()), mtime):
                continue
            if time.time() - mtime < 2:  # 아직 저장 중일 수 있음
                continue
            try:
                cid = self.process_file(p)
                ids.append(cid)
                on_event(f"[처리] {p.name} → 카드 #{cid}")
            except Exception as e:  # 한 파일이 실패해도 감시는 계속
                cid = None
                on_event(f"[실패] {p.name}: {e}")
            self.store.mark_processed(str(p.resolve()), mtime, cid)
        return ids

    def watch(self, folder: Path, interval: float = 5.0, on_event: Callable[[str], None] = print) -> None:
        on_event(f"폴더 감시 시작: {folder} ({interval:.0f}초마다 확인, 멈추려면 Ctrl+C)")
        while True:
            self.scan_folder(folder, on_event)
            time.sleep(interval)

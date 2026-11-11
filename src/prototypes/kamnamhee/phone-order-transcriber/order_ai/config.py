"""설정값. 모두 환경변수(.env)로 바꿀 수 있다."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

try:  # python-dotenv가 있으면 .env를 읽는다 (없어도 동작)
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / ".env")
except ImportError:  # pragma: no cover
    pass


@dataclass
class Settings:
    data_dir: Path
    # 음성 인식: none | faster-whisper | openai
    stt_backend: str
    whisper_model: str
    openai_stt_model: str
    # 주문 추출: rule | anthropic | openai | ollama
    llm_provider: str
    anthropic_model: str
    openai_model: str
    ollama_model: str
    ollama_url: str
    glossary_path: Path
    llm_timeout: float | None = None   # AI 응답 대기(초). 비우면 120, Ollama는 300

    @property
    def db_path(self) -> Path:
        return self.data_dir / "orders.db"

    @property
    def upload_dir(self) -> Path:
        return self.data_dir / "uploads"


def load_settings() -> Settings:
    data_dir = Path(os.getenv("ORDER_AI_DATA_DIR", BASE_DIR / "var"))
    return Settings(
        data_dir=data_dir,
        stt_backend=os.getenv("STT_BACKEND", "none").strip().lower(),
        whisper_model=os.getenv("WHISPER_MODEL", "small"),
        openai_stt_model=os.getenv("OPENAI_STT_MODEL", "whisper-1"),
        llm_provider=os.getenv("LLM_PROVIDER", "rule").strip().lower(),
        anthropic_model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        ollama_model=os.getenv("OLLAMA_MODEL", "qwen2.5:7b"),
        ollama_url=os.getenv("OLLAMA_URL", "http://localhost:11434"),
        glossary_path=Path(os.getenv("GLOSSARY_PATH", BASE_DIR / "glossary.csv")),
        llm_timeout=float(os.environ["LLM_TIMEOUT"]) if os.getenv("LLM_TIMEOUT") else None,
    )

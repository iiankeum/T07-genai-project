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
    data_dir: Path          # 모임·투표 DB 위치
    restaurant_dir: Path    # 식당 데이터(restaurants.csv, menus.csv) 위치
    # 의견 → 조건 정리: rule | anthropic | openai | ollama
    llm_provider: str
    anthropic_model: str
    openai_model: str
    ollama_model: str
    ollama_url: str

    @property
    def db_path(self) -> Path:
        return self.data_dir / "dining.db"


def load_settings() -> Settings:
    return Settings(
        data_dir=Path(os.getenv("DINING_DATA_DIR", BASE_DIR / "var")),
        restaurant_dir=Path(os.getenv("RESTAURANT_DIR", BASE_DIR / "data")),
        llm_provider=os.getenv("LLM_PROVIDER", "rule").strip().lower(),
        anthropic_model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        ollama_model=os.getenv("OLLAMA_MODEL", "qwen2.5:7b"),
        ollama_url=os.getenv("OLLAMA_URL", "http://localhost:11434"),
    )

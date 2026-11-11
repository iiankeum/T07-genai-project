import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dining_ai.config import BASE_DIR  # noqa: E402

SCENARIO = [
    {"author": "담당자", "text": "목요일 저녁 강남역 근처 8명, 인당 4만 원 이하, 한 명은 회를 못 먹고 룸이면 좋겠어"},
    {"author": "민수", "text": "저 회는 진짜 못 먹어요 ㅠㅠ"},
    {"author": "지영", "text": "역에서 가까우면 좋겠어요"},
    {"author": "현우", "text": "8명이 한 테이블에 앉을 수 있나요?"},
    {"author": "수빈", "text": "고기 먹고 싶어요!"},
]
CHANGE = {"author": "지영", "text": "룸이 없어도 걸어서 갈 수 있는 곳이 좋아요"}


@pytest.fixture
def restaurants():
    from dining_ai.data import load_restaurants

    return load_restaurants(BASE_DIR / "data")


@pytest.fixture
def stations(restaurants):
    return sorted({r.station for r in restaurants})


@pytest.fixture
def settings(tmp_path, monkeypatch):
    monkeypatch.setenv("DINING_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("LLM_PROVIDER", "rule")
    from dining_ai.config import load_settings

    return load_settings()

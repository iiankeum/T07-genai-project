import json
from datetime import datetime

import pytest

from order_ai import extract as extract_mod
from order_ai.config import BASE_DIR, load_settings
from order_ai.glossary import Glossary
from order_ai.llm import LLMError, parse_json
from order_ai.pipeline import Pipeline
from order_ai.summary import summarize


@pytest.fixture
def settings(tmp_path, monkeypatch):
    monkeypatch.setenv("ORDER_AI_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("LLM_PROVIDER", "rule")
    return load_settings()


def test_parse_json_with_fence():
    assert parse_json('설명\n```json\n{"a": 1}\n```') == {"a": 1}
    with pytest.raises(LLMError):
        parse_json("JSON 없음")


def test_llm_output_never_keeps_part_number(settings, monkeypatch):
    settings.llm_provider = "anthropic"
    fake = {"corrected_transcript": "정비소: 아반떼 앞범퍼 하나", "customer": "한빛공업사",
            "vehicle_model": "아반떼", "items": [{"part": "앞범퍼", "quantity": 1, "part_number": "86511-AA000"}],
            "urgent": True, "follow_ups": []}
    monkeypatch.setattr(extract_mod, "chat", lambda *a, **k: json.dumps(fake, ensure_ascii=False))
    r = extract_mod.extract("아반떼 앞범퍼 하나", settings, Glossary.load(settings.glossary_path))
    assert r.extractor == "anthropic"
    assert r.card.items[0].part_number == ""          # AI가 지어낸 품번은 지운다
    assert any("연식" in f for f in r.card.follow_ups)  # 빠진 정보 점검은 AI 결과에도 적용


def test_llm_failure_falls_back_to_rules(settings, monkeypatch):
    settings.llm_provider = "openai"

    def boom(*a, **k):
        raise LLMError("키 없음")

    monkeypatch.setattr(extract_mod, "chat", boom)
    r = extract_mod.extract("한빛공업사 아반떼 앞범퍼 하나", settings, Glossary.load(settings.glossary_path))
    assert r.extractor == "rule" and r.card.items
    assert any("규칙 기반" in w for w in r.warnings)


def test_folder_watch_processes_once(settings, tmp_path):
    inbox = tmp_path / "inbox"
    inbox.mkdir()
    src = BASE_DIR / "samples" / "01_급한_앞범퍼.txt"
    f = inbox / "call.txt"
    f.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    import os
    os.utime(f, (f.stat().st_atime - 10, f.stat().st_mtime - 10))
    pipe = Pipeline(settings)
    assert len(pipe.scan_folder(inbox, on_event=lambda m: None)) == 1
    assert pipe.scan_folder(inbox, on_event=lambda m: None) == []


def test_web_flow(settings):
    from app import create_app

    pipe = Pipeline(settings)
    app = create_app(pipe)
    client = app.test_client()
    assert client.post("/samples").status_code == 302
    today = datetime.now().strftime("%Y-%m-%d")
    page = client.get(f"/?date={today}").get_data(as_text=True)
    assert "한빛공업사" in page and "급함" in page

    rec = next(r for r in pipe.store.list(date=today) if r.card.customer == "한빛공업사" and r.card.urgent)
    assert "앞범퍼" in client.get(f"/cards/{rec.id}").get_data(as_text=True)

    form = {"customer": "한빛공업사", "vehicle_model": "아반떼", "vehicle_year": "19년식", "plate": "12가3456",
            "items-0-part": "앞범퍼", "items-0-quantity": "1", "items-0-position": "", "items-0-part_number": "",
            "items-0-evidence": "", "urgent": "on", "due": "오늘 오후", "delivery": "퀵", "follow_ups": "", "memo": ""}
    # 품번 없이 확정하면 막힌다
    client.post(f"/cards/{rec.id}", data={**form, "action": "confirm"})
    assert pipe.store.get(rec.id).status == "draft"
    client.post(f"/cards/{rec.id}", data={**form, "items-0-part_number": "TEST-0001", "action": "confirm"})
    after = pipe.store.get(rec.id)
    assert after.status == "confirmed" and after.edited
    assert after.ai_card.items[0].part_number == ""  # AI 초안은 그대로 남는다

    s = summarize(today, pipe.store.list(date=today))
    assert s.total == 6 and len(s.pending) == 5
    assert "다시 전화할 곳" in client.get(f"/summary?date={today}").get_data(as_text=True)

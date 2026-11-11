"""코드 리뷰(2026-11-11)에서 지적된 동작의 회귀 테스트."""
import json
import os
import urllib.request

import pytest

from order_ai import extract as extract_mod
from order_ai import llm as llm_mod
from order_ai.config import BASE_DIR, load_settings
from order_ai.glossary import Glossary
from order_ai.pipeline import Pipeline


@pytest.fixture
def settings(tmp_path, monkeypatch):
    monkeypatch.setenv("ORDER_AI_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("LLM_PROVIDER", "rule")
    monkeypatch.setenv("STT_BACKEND", "none")
    return load_settings()


@pytest.fixture
def client(settings):
    from app import create_app

    pipe = Pipeline(settings)
    app = create_app(pipe)
    return app.test_client(), pipe


def _form(**over):
    base = {"customer": "한빛공업사", "vehicle_model": "아반떼", "vehicle_year": "19년식", "plate": "12가3456",
            "items-0-part": "앞범퍼", "items-0-quantity": "1", "items-0-position": "", "items-0-part_number": "P-1",
            "items-0-evidence": "", "due": "", "delivery": "", "follow_ups": "", "memo": ""}
    base.update(over)
    return base


def _new_card(pipe):
    p = BASE_DIR / "samples" / "01_급한_앞범퍼.txt"
    return pipe.process_file(p)


# ── 1. 확정·출고 조건 ─────────────────────────────────────
def test_confirm_requires_quantity(client):
    c, pipe = client
    cid = _new_card(pipe)
    c.post(f"/cards/{cid}", data=_form(**{"items-0-quantity": "", "action": "confirm"}))
    assert pipe.store.get(cid).status == "draft"


def test_confirm_rejects_empty_order(client):
    c, pipe = client
    cid = _new_card(pipe)
    c.post(f"/cards/{cid}", data=_form(**{"items-0-delete": "on", "action": "confirm"}))
    assert pipe.store.get(cid).status == "draft"


def test_confirm_requires_open_questions_resolved(client):
    c, pipe = client
    cid = _new_card(pipe)
    c.post(f"/cards/{cid}", data=_form(follow_ups="좌/우 확인", action="confirm"))
    assert pipe.store.get(cid).status == "draft"
    c.post(f"/cards/{cid}", data=_form(action="confirm"))
    assert pipe.store.get(cid).status == "confirmed"


def test_ship_only_after_confirm(client):
    c, pipe = client
    cid = _new_card(pipe)
    c.post(f"/cards/{cid}", data={"action": "ship"})            # 확인 필요 상태에서 바로 출고 → 거부
    assert pipe.store.get(cid).status == "draft"
    c.post(f"/cards/{cid}", data=_form(action="confirm"))
    c.post(f"/cards/{cid}", data={"action": "ship"})
    assert pipe.store.get(cid).status == "shipped"


def test_confirmed_card_is_locked(client):
    c, pipe = client
    cid = _new_card(pipe)
    c.post(f"/cards/{cid}", data=_form(action="confirm"))
    c.post(f"/cards/{cid}", data=_form(**{"items-0-quantity": "5", "action": "save"}))
    assert pipe.store.get(cid).card.items[0].quantity == 1     # 확정 뒤에는 '다시 열기' 전까지 못 고침


def test_callbacks_keep_confirmed_cards_with_questions():
    from order_ai.models import OrderCard
    from order_ai.store import CardRecord
    from order_ai.summary import summarize

    card = OrderCard(customer="우리모터스", follow_ups=["연식 확인"])
    rec = CardRecord(id=1, call_date="2026-11-11", call_time="10:00", status="confirmed", source_name="x",
                     audio_path=None, transcript_raw="", transcript="", ai_transcript="", ai_card=card, card=card,
                     extractor="rule", warnings=[], created_at="", updated_at="")
    assert "우리모터스 (#1 10:00)" in summarize("2026-11-11", [rec]).callbacks


# ── 2. AI 추출값을 원문과 대조 ─────────────────────────────
def test_ai_values_not_in_transcript_are_flagged(settings, monkeypatch):
    settings.llm_provider = "anthropic"
    fake = {"corrected_transcript": "정비소: 쏘나타 앞범퍼 99개요", "customer": "", "vehicle_model": "쏘나타",
            "plate": "34나5678", "items": [{"part": "앞범퍼", "quantity": 99, "part_number": "86511-AA000",
                                             "evidence": "쏘나타 앞범퍼 아흔아홉 개 빨리요"}], "follow_ups": []}
    monkeypatch.setattr(extract_mod, "chat", lambda *a, **k: json.dumps(fake, ensure_ascii=False))
    r = extract_mod.extract("아반떼 앞범퍼 한 개 주세요", settings, Glossary.load(settings.glossary_path))
    card = r.card
    assert card.items[0].part_number == ""
    assert {"vehicle_model", "plate"} <= set(card.unverified)
    assert {"quantity", "evidence"} <= set(card.items[0].unverified)
    asks = " ".join(card.follow_ups)
    assert "쏘나타" in asks and "34나5678" in asks and "99개" in asks
    assert r.transcript == "아반떼 앞범퍼 한 개 주세요"        # 원문(사전 교정)과 AI 교정문을 따로 보관
    assert r.ai_transcript == "정비소: 쏘나타 앞범퍼 99개요"


def test_ai_values_supported_by_transcript_pass(settings, monkeypatch):
    settings.llm_provider = "anthropic"
    fake = {"customer": "한빛공업사", "vehicle_model": "아반떼", "vehicle_year": "19년식", "plate": "12가3456",
            "items": [{"part": "앞범퍼", "quantity": 1, "evidence": "그 아반떼 앞범퍼 하나, 급해요."}]}
    monkeypatch.setattr(extract_mod, "chat", lambda *a, **k: json.dumps(fake, ensure_ascii=False))
    text = (BASE_DIR / "samples" / "01_급한_앞범퍼.txt").read_text(encoding="utf-8")
    card = extract_mod.extract(text, settings, Glossary.load(settings.glossary_path)).card
    assert card.unverified == [] and card.items[0].unverified == []


# ── 3. 폴더 감시: 실패한 파일은 다시 시도 ─────────────────────
def test_failed_file_is_retried(settings, tmp_path, monkeypatch):
    inbox = tmp_path / "inbox"
    inbox.mkdir()
    f = inbox / "call.txt"
    f.write_text("한빛공업사 아반떼 앞범퍼 하나", encoding="utf-8")
    os.utime(f, (f.stat().st_atime - 10, f.stat().st_mtime - 10))
    pipe = Pipeline(settings)
    real = pipe.process_file
    monkeypatch.setattr(pipe, "process_file", lambda *a, **k: (_ for _ in ()).throw(PermissionError("잠김")))
    assert pipe.scan_folder(inbox, on_event=lambda m: None) == []
    assert pipe.store.failed_files()[0]["error"].endswith("잠김")
    monkeypatch.setattr(pipe, "process_file", real)              # 파일이 다시 읽히면
    assert len(pipe.scan_folder(inbox, on_event=lambda m: None)) == 1
    assert pipe.store.failed_files() == []
    assert pipe.scan_folder(inbox, on_event=lambda m: None) == []  # 성공한 파일은 한 번만


# ── 4. AI 호출 시간 초과·이상한 응답 → 규칙 기반 대체 (웹 요청 단위) ─
def _upload(c):
    import io

    return c.post("/upload", data={"files": (io.BytesIO("한빛공업사 아반떼 앞범퍼 하나".encode()), "call.txt")},
                  content_type="multipart/form-data")


def test_timeout_falls_back_on_upload(client, monkeypatch):
    c, pipe = client
    pipe.settings.llm_provider = "anthropic"
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")

    def slow(*a, **k):
        raise TimeoutError("The read operation timed out")

    monkeypatch.setattr(urllib.request, "urlopen", slow)
    _upload(c)
    recs = pipe.store.list()
    assert len(recs) == 1 and recs[0].extractor == "rule"
    assert any("TimeoutError" in w or "시간" in w for w in recs[0].warnings)


def test_malformed_response_falls_back(client, monkeypatch):
    c, pipe = client
    pipe.settings.llm_provider = "openai"
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    monkeypatch.setattr(llm_mod, "_post", lambda *a, **k: {"unexpected": True})
    _upload(c)
    recs = pipe.store.list()
    assert len(recs) == 1 and recs[0].extractor == "rule"


# ── 5. 안내문은 실제 추출 방식대로 ──────────────────────────
def test_card_notice_matches_extractor(client):
    c, pipe = client
    cid = _new_card(pipe)
    page = c.get(f"/cards/{cid}").get_data(as_text=True)
    assert "규칙 기반" in page and "AI가 만든 초안" not in page

"""코드 리뷰(2026-11-11)에서 지적된 동작의 회귀 테스트."""
import urllib.request

import pytest

from dining_ai import llm as llm_mod
from dining_ai.engine import rank
from dining_ai.parse_rules import parse_opinions
from dining_ai.service import Service

SAMPLE = "/samples/01_팀회식_강남역.json"


@pytest.fixture
def app_and_svc(settings):
    from app import create_app

    svc = Service(settings)
    app = create_app(svc)
    return app, svc


# ── 1. 담당자 권한: 투표 링크만 가진 사람은 관리 작업을 못 함 ─────────
def test_other_browser_cannot_manage(app_and_svc):
    app, svc = app_and_svc
    owner, stranger = app.test_client(), app.test_client()
    owner.post(SAMPLE)
    m = svc.store.meeting(1)
    cid = svc.store.latest_round(1)["data"]["ranking"]["candidates"][0]["id"]
    oid = svc.store.opinions(1)[0]["id"]

    assert stranger.get("/m/1").status_code == 403
    assert stranger.post("/m/1/decide", data={"rid": cid}).status_code == 403
    assert stranger.post("/m/1/opinions", data={"text": "룸 꼭"}).status_code == 403
    assert stranger.post(f"/m/1/opinions/{oid}/delete").status_code == 403
    assert stranger.post("/m/1/conditions", data={"key": "room", "value": "off"}).status_code == 403
    assert stranger.post("/m/1/delete").status_code == 403
    assert svc.store.meeting(1)["status"] == "planning" and len(svc.store.opinions(1)) == 5
    assert stranger.get(f"/v/{m['token']}").status_code == 200            # 투표는 그대로 가능
    assert 'href="/m/1"' not in stranger.get("/").get_data(as_text=True)  # 남의 모임 목록도 안 보임
    assert 'href="/m/1"' in owner.get("/").get_data(as_text=True)

    assert owner.get("/m/1").status_code == 200
    # 담당자 링크(k=관리 토큰)로 다른 기기에서도 열 수 있음
    other_device = app.test_client()
    assert other_device.get(f"/m/1?k={m['admin_token']}").status_code in (200, 302)
    assert other_device.get("/m/1").status_code == 200


def test_debug_is_off_by_default(monkeypatch):
    import app as app_module

    monkeypatch.delenv("FLASK_DEBUG", raising=False)
    assert app_module.debug_enabled() is False


# ── 2. 비건은 육류 제외와 다르다 ─────────────────────────────
def test_vegan_is_not_just_meat_free(restaurants, stations):
    ops = [{"author": "담당자", "text": "역삼역에서 4명 점심. 저는 비건이에요. 일식이면 좋겠습니다"}]
    conds = parse_opinions(ops, stations).conditions
    assert any(c.type == "diet" and c.value == "비건" for c in conds)
    rk = rank(restaurants, conds)
    names = [c["name"] for c in rk["candidates"]]
    assert "소담 일식" not in names                                  # 초밥·사케동은 비건 메뉴가 아님
    ex = {x["name"]: " ".join(x["reasons"]) for x in rk["excluded"]}
    assert "소담 일식" in ex
    for c in rk["candidates"]:                                        # 메뉴 정보만으로는 확정 못 함
        assert any("매장 확인" in x for x in c["checks"])


def test_vegetarian_excludes_seafood_and_meat_only_is_different(stations):
    c = {x.key: x for x in parse_opinions([{"author": "a", "text": "저 채식해요"}], stations).conditions}
    assert "diet:채식" in c
    c = {x.key: x for x in parse_opinions([{"author": "a", "text": "저는 고기를 안 먹어요"}], stations).conditions}
    assert "diet:고기" in c


# ── 3. 투표는 사람(브라우저)별로 구분 ────────────────────────
def test_votes_are_per_browser_not_per_name(app_and_svc):
    app, svc = app_and_svc
    owner = app.test_client()
    owner.post(SAMPLE)
    token = svc.store.meeting(1)["token"]
    cands = [c["id"] for c in svc.store.latest_round(1)["data"]["ranking"]["candidates"]]
    a, b = app.test_client(), app.test_client()
    a.post(f"/v/{token}", data={"voter": "민수", "rid": cands[0]})
    b.post(f"/v/{token}", data={"voter": "민수", "rid": cands[1]})   # 동명이인
    assert svc.tally(1, cands)["total"] == 2
    a.post(f"/v/{token}", data={"voter": "민수", "rid": cands[2]})   # 본인 재투표 → 바뀜
    t = svc.tally(1, cands)
    assert t["total"] == 2 and t["by"][cands[2]] == ["민수"] and t["by"][cands[0]] == []


# ── 4. AI 시간 초과·이상한 응답 → 규칙 기반 대체 (웹 요청 단위) ─────
def test_timeout_falls_back_when_creating_meeting(app_and_svc, monkeypatch):
    app, svc = app_and_svc
    svc.settings.llm_provider = "anthropic"
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")

    def slow(*a, **k):
        raise TimeoutError("The read operation timed out")

    monkeypatch.setattr(urllib.request, "urlopen", slow)
    r = app.test_client().post(SAMPLE)
    assert r.status_code == 302
    data = svc.store.latest_round(1)["data"]
    assert data["parser"] == "rule" and data["ranking"]["candidates"]
    assert any("시간 초과" in w or "Timeout" in w for w in data["warnings"])


def test_malformed_response_falls_back(app_and_svc, monkeypatch):
    app, svc = app_and_svc
    svc.settings.llm_provider = "openai"
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    monkeypatch.setattr(llm_mod, "_post", lambda *a, **k: {"choices": []})
    assert app.test_client().post(SAMPLE).status_code == 302
    assert svc.store.latest_round(1)["data"]["parser"] == "rule"

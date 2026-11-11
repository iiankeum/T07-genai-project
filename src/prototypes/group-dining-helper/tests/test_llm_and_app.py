import json

from conftest import SCENARIO

from dining_ai import parse as parse_mod
from dining_ai.llm import LLMError
from dining_ai.service import Service, split_opinions


def test_llm_output_is_validated(settings, stations, monkeypatch):
    settings.llm_provider = "anthropic"
    fake = {"conditions": [
        {"type": "area", "value": ["강남역", "판교역"], "kind": "must"},     # 데이터에 없는 역은 버림
        {"type": "budget", "value": "40,000", "kind": "must"},
        {"type": "diet", "value": "채식", "kind": "must", "count": 1},       # 채식 → 고기
        {"type": "like", "value": "랍스터 전문점", "kind": "prefer"},        # 없는 업종은 버림
        {"type": "restaurant", "value": "지어낸 식당"},                      # 없는 type은 버림
        {"type": "room", "value": True, "kind": "prefer", "weight": 9},     # 중요도는 1~3으로
    ], "unmatched": [{"author": "하은", "text": "케이크 가져가도 되나요?"}]}
    monkeypatch.setattr(parse_mod, "chat", lambda *a, **k: "```json\n" + json.dumps(fake, ensure_ascii=False) + "\n```")
    out = parse_mod.parse(SCENARIO, settings, stations, ["고기구이", "중식"])
    c = {x.key: x for x in out.conditions}
    assert out.parser == "anthropic"
    assert c["area"].value == ["강남역"] and c["budget"].value == 40000
    assert "diet:고기" in c and c["room"].weight == 3
    assert not any(k.startswith("like:") for k in c) and "drinks" in c
    assert out.unmatched[0]["text"] == "케이크 가져가도 되나요?"


def test_llm_failure_falls_back(settings, stations, monkeypatch):
    settings.llm_provider = "openai"

    def boom(*a, **k):
        raise LLMError("키 없음")

    monkeypatch.setattr(parse_mod, "chat", boom)
    out = parse_mod.parse(SCENARIO, settings, stations, [])
    assert out.parser == "rule" and any("규칙 기반" in w for w in out.warnings)


def test_split_kakao_formats():
    text = ("--------------- 2026년 11월 10일 화요일 ---------------\n"
            "[민수] [오후 3:12] 저 회는 못 먹어요\n"
            "2026. 11. 10. 오후 3:13, 지영 : 역에서 가까우면 좋겠어요\n"
            "현우: 8명이 한 테이블에 앉을 수 있나요?\n"
            "목요일 저녁 강남역")
    assert split_opinions(text, "담당자") == [("민수", "저 회는 못 먹어요"), ("지영", "역에서 가까우면 좋겠어요"),
                                            ("현우", "8명이 한 테이블에 앉을 수 있나요?"), ("담당자", "목요일 저녁 강남역")]


def test_web_flow(settings):
    from app import create_app

    svc = Service(settings)
    app = create_app(svc)
    c = app.test_client()
    assert c.post("/samples/01_팀회식_강남역.json").status_code == 302
    page = c.get("/m/1").get_data(as_text=True)
    assert "숯결 화로구이" in page and "확인 필요" in page and "필수" in page

    c.post("/m/1/opinions", data={"text": "지영: 룸이 없어도 걸어서 갈 수 있는 곳이 좋아요"})
    page = c.get("/m/1").get_data(as_text=True)
    assert "1위가 숯결 화로구이 → 모퉁이 삼겹으로 바뀌었습니다." in page

    # 담당자가 조건을 직접 바꿈: 룸을 다시 필수로
    c.post("/m/1/conditions", data={"key": "room", "value": "must"})
    cands = svc.store.latest_round(1)["data"]["ranking"]["candidates"]
    assert all("룸" in " ".join(x["reasons"]) for x in cands)

    token = svc.store.meeting(1)["token"]
    rid = cands[0]["id"]
    c.post(f"/v/{token}", data={"voter": "민수", "rid": rid, "comment": "매운 건 못 먹어요"})
    c.post(f"/v/{token}", data={"voter": "민수", "rid": rid, "comment": "매운 건 못 먹어요"})  # 다시 투표해도 한 표
    t = svc.tally(1, [x["id"] for x in cands])
    assert t["by"][rid] == ["민수"] and t["total"] == 1

    vid = svc.store.votes(1)[0]["id"]
    c.post(f"/m/1/votes/{vid}/adopt")                     # 투표 의견을 조건으로
    keys = [x["type"] + ":" + str(x["value"]) for x in svc.store.latest_round(1)["data"]["conditions"]]
    assert "diet:매운맛" in keys

    c.post("/m/1/decide", data={"rid": rid})
    page = c.get("/m/1").get_data(as_text=True)
    assert "예약하기" in page and "단체방 공지 문구" in page
    b = svc.booking(1)
    assert b["metrics"]["votes"] == 1 and any("룸 예약" in x for x in b["checks"])
    assert "장소가 정해졌어요" in c.get(f"/v/{token}").get_data(as_text=True)

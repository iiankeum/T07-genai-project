from conftest import CHANGE, SCENARIO

from dining_ai.changes import explain
from dining_ai.engine import rank
from dining_ai.models import Condition
from dining_ai.parse_rules import parse_opinions


def ranked(restaurants, stations, ops):
    cs = parse_opinions(ops, stations).conditions
    return cs, rank(restaurants, cs)


def names(rk):
    return [c["name"] for c in rk["candidates"]]


def test_round1_top3_and_must_filters(restaurants, stations):
    _, rk = ranked(restaurants, stations, SCENARIO)
    assert names(rk) == ["숯결 화로구이", "샤브정원", "청운각"]
    ex = {x["name"]: x["reasons"] for x in rk["excluded"]}
    assert ex["곱창 연구소"] == ["목요일 휴무"]
    assert ex["작은 부엌"] == ["단체 최대 6명 — 8명 불가"]
    assert "회 없이 먹을 메인 메뉴가 없음" in ex["스시 하루"]
    assert ex["국밥 한그릇"] == ["저녁 영업 안 함"]
    assert "달빛 이자카야" in [n["name"] for n in rk["near_misses"]]  # 예산 2천 원 초과


def test_candidate_details(restaurants, stations):
    _, rk = ranked(restaurants, stations, SCENARIO)
    top = rk["candidates"][0]
    assert top["per_person"] == 40000 and top["total"] == 320000   # 기준 메뉴 인당 × 8명
    assert "8인 룸 있음" in top["reasons"]
    assert any("빈 룸" in x for x in top["checks"])                # 8인 룸은 확인 필요
    assert any("예산에 여유가 없음" in x for x in top["checks"])


def test_change_explanation(restaurants, stations):
    c1, r1 = ranked(restaurants, stations, SCENARIO)
    c2, r2 = ranked(restaurants, stations, SCENARIO + [CHANGE])
    assert names(r2) == ["모퉁이 삼겹", "숯결 화로구이", "샤브정원"]
    ex = explain(c1, r1, c2, r2)
    assert ex["headline"] == "1위가 숯결 화로구이 → 모퉁이 삼겹으로 바뀌었습니다."
    text = "\n".join(ex["conditions"] + ex["ranking"])
    assert "룸(독립된 방): 조건에서 뺌 — 지영" in text
    assert "중요도 보통 → 높음" in text
    assert "청운각 후보에서 빠짐" in text and "도보 2분" in text


def test_drinks_toggle_changes_budget(restaurants, stations):
    cs = parse_opinions(SCENARIO + [{"author": "도윤", "text": "이번엔 술 없이 밥만 먹어요"}], stations).conditions
    rk = rank(restaurants, cs)
    assert "트라토리아 노을" in [rk["names"][i] for i in rk["order"]]  # 와인 빼면 인당 3.4만 원


def test_no_candidates_message(restaurants, stations):
    cs = [Condition(type="area", value=["강남역"], kind="must"), Condition(type="budget", value=10000, kind="must")]
    rk = rank(restaurants, cs)
    assert rk["candidates"] == []
    assert explain(None, None, cs, rk)["headline"] == "조건에 맞는 식당이 없습니다."

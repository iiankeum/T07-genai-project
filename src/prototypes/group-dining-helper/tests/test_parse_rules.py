from datetime import date

from conftest import CHANGE, SCENARIO

from dining_ai.parse_rules import parse_opinions


def conds(ops, stations, **kw):
    r = parse_opinions(ops, stations, **kw)
    return {c.key: c for c in r.conditions}, r.unmatched


def test_idea_example_splits_must_and_prefer(stations):
    c, _ = conds(SCENARIO[:1], stations)
    must = {k: v.value for k, v in c.items() if v.kind == "must"}
    assert must == {"area": ["강남역"], "day": "목", "slot": "저녁", "headcount": 8, "budget": 40000, "diet:회": "회"}
    assert c["diet:회"].count == 1             # "한 명은" → 인원 8명과 섞이지 않음
    assert c["room"].kind == "prefer"          # 룸은 선호
    assert c["drinks"].value is True           # 저녁 모임 → 주류 포함 계산


def test_group_chat_opinions(stations):
    c, _ = conds(SCENARIO, stations)
    assert c["diet:회"].count == 1             # 민수 본인 이야기 = 담당자가 말한 그 한 명
    assert (c["walk"].value, c["walk"].weight, c["walk"].author) == (5, 2, "지영")
    assert (c["one_table"].kind, c["one_table"].weight) == ("prefer", 1)  # 질문은 가볍게
    assert c["like:고기구이"].weight == 1


def test_changed_opinion_turns_room_off_and_raises_walk(stations):
    c, _ = conds(SCENARIO + [CHANGE], stations)
    assert c["room"].kind == "off" and c["room"].author == "지영"
    assert (c["walk"].value, c["walk"].weight) == (5, 3)  # 더 짧은 기준 유지, 중요도 ↑


def test_misc_sentences(stations):
    today = date(2026, 11, 11)
    c, _ = conds([{"author": "a", "text": "총 30만 원으로 6명, 중식은 별로예요"}], stations, today=today)
    assert c["budget"].value == 50000 and c["avoid:중식"].kind == "prefer"
    c, _ = conds([{"author": "a", "text": "11월 20일 저녁, 술은 안 마셔요"}], stations, today=today)
    assert (c["day"].value, c["day"].detail, c["drinks"].value) == ("금", "11월 20일", False)
    c, _ = conds([{"author": "a", "text": "매운 거 못 먹는 사람 두 명 있어요"}], stations)
    assert c["diet:매운맛"].count == 2 and "headcount" not in c
    c, _ = conds([{"author": "a", "text": "룸은 꼭 있어야 해요"}], stations)
    assert c["room"].kind == "must"
    c, _ = conds([{"author": "a", "text": "강남역 근처요"}, {"author": "b", "text": "역삼역도 괜찮아요"}], stations)
    assert c["area"].value == ["강남역", "역삼역"]


def test_self_reports_add_up(stations):
    ops = [{"author": "민수", "text": "저 회 못 먹어요"}, {"author": "지영", "text": "저도 회 못 먹어요"},
           {"author": "민수", "text": "저 회 진짜 못 먹어요"}]
    c, _ = conds(ops, stations)
    assert c["diet:회"].count == 2


def test_unmatched_questions_are_kept(stations):
    _, un = conds([{"author": "하은", "text": "케이크 가져가도 되나요?"}, {"author": "도윤", "text": "저는 다 좋아요"}], stations)
    assert un == [{"author": "하은", "text": "케이크 가져가도 되나요?"}]

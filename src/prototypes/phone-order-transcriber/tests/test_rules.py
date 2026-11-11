from order_ai.config import BASE_DIR, load_settings
from order_ai.extract import extract
from order_ai.glossary import Glossary

SAMPLES = BASE_DIR / "samples"


def run(name, monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "rule")
    s = load_settings()
    return extract((SAMPLES / name).read_text(encoding="utf-8"), s, Glossary.load(s.glossary_path))


def items(card):
    return {(i.position, i.part): i.quantity for i in card.items}


def test_urgent_bumper(monkeypatch):
    c = run("01_급한_앞범퍼.txt", monkeypatch).card
    assert (c.customer, c.vehicle_model, c.vehicle_year, c.plate) == ("한빛공업사", "아반떼", "19년식", "12가3456")
    assert items(c) == {("", "앞범퍼"): 1}
    assert c.urgent and c.due == "오늘 오후" and c.delivery == "퀵"
    assert c.follow_ups == []


def test_quantity_correction_last_wins(monkeypatch):
    c = run("02_여러부품_정정.txt", monkeypatch).card
    assert items(c) == {("앞", "브레이크 패드"): 1, ("", "오일필터"): 2, ("", "에어필터"): 1}
    oil = next(i for i in c.items if i.part == "오일필터")
    assert "두 개만" in oil.evidence  # 다툼 확인용 근거가 남는다
    assert not c.memo  # '브레이크' 안의 '레이'를 차종으로 잡지 않는다


def test_missing_info_becomes_follow_ups(monkeypatch):
    c = run("03_정보부족.txt", monkeypatch).card
    assert items(c) == {("", "사이드미러"): 1}  # "몇 개요?" → "하나요."
    joined = " ".join(c.follow_ups)
    assert "연식" in joined and "좌/우" in joined


def test_glossary_fixes_stt_and_slang(monkeypatch):
    r = run("04_받아쓰기_원문_한줄.txt", monkeypatch)
    assert "휀다" not in r.transcript and "펜더" in r.transcript
    assert items(r.card) == {("조수석", "펜더"): 1, ("앞", "쇼크업소버"): 2}
    assert r.card.vehicle_model == "아반떼" and r.card.urgent


def test_two_vehicles_noted_and_year_not_mixed(monkeypatch):
    c = run("05_두차량_한통화.txt", monkeypatch).card
    assert c.vehicle_model == "그랜저" and c.vehicle_year == ""  # 20년식은 포터 것
    assert "포터 20년식" in c.memo
    assert ("좌", "헤드램프") in items(c)


def test_mounts_and_pickup(monkeypatch):
    c = run("06_직접수령_엔진마운트.txt", monkeypatch).card
    assert items(c) == {("", "엔진마운트"): 1, ("", "미션마운트"): 1}
    assert c.delivery == "직접 수령"

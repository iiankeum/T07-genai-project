"""엔진 없이 도는 검사: 자모 비교 · 단어장 읽기 · 힌트 고르기 · 받아쓴 뒤 고치기.

    .venv\\Scripts\\python -m unittest discover -s tests
"""
import unittest

from glossary_stt import jamo
from glossary_stt.correct import Corrector, apply, to_pieces, pieces_text
from glossary_stt.glossary import Glossary, Entry
from glossary_stt.hints import plan_hints


def g(*rows):
    return Glossary("t", [Entry(term=r[0], aliases=list(r[1:])) for r in rows]).clean()


class Jamo(unittest.TestCase):
    def test_same_is_zero(self):
        self.assertEqual(jamo.distance("임베딩", "임베딩"), 0)

    def test_similar_sound_is_cheap(self):
        # ㄷ/ㅌ 는 비슷한 소리라 절반만 다르다
        self.assertLess(jamo.distance("임베딩", "임베팅"), jamo.distance("임베딩", "임베징"))

    def test_squash(self):
        self.assertEqual(jamo.squash("라지 에다, "), "라지에다")


class Csv(unittest.TestCase):
    def test_roundtrip_korean_headers(self):
        src = Glossary("x", [Entry("라디에이터", ["라지에다", "라지에타"], "냉각", True, 3)])
        back = Glossary.from_csv("x", src.to_csv())
        self.assertEqual(back.entries[0].term, "라디에이터")
        self.assertEqual(back.entries[0].aliases, ["라지에다", "라지에타"])
        self.assertTrue(back.entries[0].pinned)
        self.assertEqual(back.entries[0].hits, 3)

    def test_english_headers_and_dupes(self):
        text = "term,aliases\n펜더,휀다\n펜더,휀더\n\n#메모줄,무시\n"
        back = Glossary.from_csv("x", text)
        self.assertEqual(len(back.entries), 1)
        self.assertEqual(back.entries[0].aliases, ["휀다", "휀더"])

    def test_plain_list(self):
        self.assertEqual([e.term for e in Glossary.from_text_lines("x", "a, b\nc").entries], ["a", "b", "c"])


class Hints(unittest.TestCase):
    def test_budget_and_pinned_first(self):
        gl = Glossary("t", [Entry(f"낱말{i:03d}") for i in range(100)] + [Entry("고정낱말", pinned=True)])
        plan = plan_hints(gl, "회의 녹음입니다.")
        self.assertEqual(plan.included[0], "고정낱말")
        self.assertLessEqual(plan.tokens, plan.budget)
        self.assertTrue(plan.excluded)
        self.assertTrue(plan.hotwords.startswith("회의 녹음입니다."))

    def test_boost_goes_before_hits(self):
        gl = Glossary("t", [Entry("가나다", hits=9), Entry("라마바")])
        plan = plan_hints(gl, boost=["라마바"])
        self.assertEqual(plan.included[:2], ["라마바", "가나다"])


class Correct(unittest.TestCase):
    def test_alias_replaced(self):
        c = Corrector(g(("라디에이터", "라지에다")))
        text = "라지에다 하나 주세요"
        fixes = c.find(text)
        self.assertEqual(apply(text, fixes), "라디에이터 하나 주세요")

    def test_alias_with_spacing_error(self):
        c = Corrector(g(("라디에이터", "라지에다")))
        self.assertEqual(apply("라지 에다요", c.find("라지 에다요")), "라디에이터요")

    def test_spacing_of_term(self):
        c = Corrector(g(("타이밍벨트",)))
        self.assertEqual(apply("타이밍 벨트 교체", c.find("타이밍 벨트 교체")), "타이밍벨트 교체")

    def test_short_alias_needs_particle(self):
        c = Corrector(g(("엔진마운트", "미미")))
        self.assertEqual(apply("미미 두 개요", c.find("미미 두 개요")), "엔진마운트 두 개요")
        self.assertEqual(apply("미미하다", c.find("미미하다")), "미미하다")  # 다른 낱말이면 안 바꾼다

    def test_longer_match_first(self):
        c = Corrector(g(("엔진마운트", "엔진미미", "미미")))
        self.assertEqual(apply("엔진미미를", c.find("엔진미미를")), "엔진마운트를")

    def test_sound_auto_for_long_close_term(self):
        c = Corrector(g(("타이로드엔드",)))
        fixes = c.find("타이로드앤드 하나")
        self.assertEqual(len(fixes), 1)
        self.assertEqual(fixes[0].kind, "sound")
        self.assertTrue(fixes[0].auto)
        self.assertEqual(apply("타이로드앤드 하나", fixes), "타이로드엔드 하나")

    def test_sound_suggestion_not_auto_for_short(self):
        c = Corrector(g(("어텐션",)))
        fixes = c.find("어탠션을 봅시다")
        self.assertEqual([f.after for f in fixes], ["어텐션"])

    def test_unrelated_text_untouched(self):
        c = Corrector(g(("트랜스포머",), ("임베딩",), ("토크나이저",)))
        text = "오늘은 날씨가 좋아서 산책을 했습니다"
        self.assertEqual(c.find(text), [])

    def test_already_correct(self):
        c = Corrector(g(("임베딩", "임배딩")))
        self.assertEqual(c.find("임베딩 차원"), [])

    def test_english_alias_not_inside_word(self):
        c = Corrector(g(("GPT", "gbt")))
        self.assertEqual(apply("gbt를", c.find("gbt를")), "GPT를")
        self.assertEqual(apply("gbts", c.find("gbts")), "gbts")

    def test_merged_after_known_term(self):
        c = Corrector(g(("쏘렌토",), ("라디에이터", "라지에다")))
        self.assertEqual(apply("쏘렌토라지에다 하나", c.find("쏘렌토라지에다 하나")), "쏘렌토 라디에이터 하나")

    def test_pieces(self):
        c = Corrector(g(("라디에이터", "라지에다")))
        text = "앞 라지에다 주세요"
        pieces = to_pieces(text, c.find(text))
        self.assertEqual(pieces_text(pieces), "앞 라디에이터 주세요")
        self.assertEqual("".join(p["t"] for p in pieces), text)


if __name__ == "__main__":
    unittest.main()

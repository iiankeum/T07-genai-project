"""가림 · 검사 · 되돌리기 · 보내기 길 시험 — 네트워크 없이 돈다. 문장은 모두 지어낸 가짜다.

실행: python -m unittest discover -s src/pc-agent/tests -v
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import masking as mk  # noqa: E402

CUSTOMERS = ["새한카센터", "세한모터스", "우리공업사", "한빛카", "한일카", "한일카센터", "대한카센터", "제일카서비스"]


def masked(text, customers=CUSTOMERS, names=None, extra=None):
    m = mk.Masker(customers, names, extra)
    t = mk.AliasTable()
    out = m.mask_lines(text.split("\n"), t)
    return "\n".join(out), t, m


class TestMask(unittest.TestCase):
    def test_kinds_are_masked_and_order_info_kept(self):
        text = ("예, 세안 카센터 김 사장인데요. 차번호 48고, 7531. 전화는 010-1234-5678.\n"
                "앞범퍼 2개, 58101-D4A25 품번, 2026-11-12 까지, 3만 5천 원. 계좌는 농협 352-1234-5678-91.\n"
                "주소는 경기 오산시 원동 123-4번지. 메일 abc@test.co.kr")
        out, t, m = masked(text)
        for leak in ("세안", "김 사장", "48고", "7531", "010-1234-5678", "352-1234", "오산시", "abc@test"):
            self.assertNotIn(leak, out)
        for keep in ("앞범퍼 2개", "58101-D4A25", "2026-11-12", "3만 5천 원"):
            self.assertIn(keep, out)
        self.assertEqual(mk.find_leaks(out, t, m), [])
        cust = [e for e in t.entries.values() if e["kind"] == "거래처"][0]
        self.assertEqual(cust["canonical"], "새한카센터")       # 받아쓰기 오류를 목록 표기로 맞춤

    def test_tricky_forms(self):
        out, t, m = masked("부품 대리점입니다. 이 대리점은 그대로 2개, 퀵으로 3개.\n"
                           "산빛모터스조 기사인데요.\n차번호요? 119 다음에\n러. 러시아 할 때러. 4040.\n"
                           "펠리세이드 차번호 34R7788 이요. 다른 카센터는 몰라요.")
        self.assertIn("대리점입니다", out)                    # 「대리점」은 사람이 아님
        self.assertIn("그대로 2개", out)                      # 흔한 말 + 수량은 주소가 아님
        self.assertNotIn("조 기사", out)                      # 상호에 붙여 쓴 사람
        self.assertNotIn("4040", out)                         # 나눠 부른 차번호 뒷자리
        self.assertNotIn("34R7788", out)                      # 한글을 영문으로 받아쓴 차번호
        self.assertIn("다른 카센터", out)                     # 이름이 아닌 말
        self.assertEqual(mk.find_leaks(out, t, m), [])

    def test_ambiguous_customer_is_not_guessed(self):
        out, t, m = masked("한빛 카센터예요. 한일 카센터 말고요.")
        ents = [e for e in t.entries.values() if e["kind"] == "거래처"]
        self.assertTrue(all(e.get("canonical") in (None, "한일카센터") for e in ents))
        self.assertNotIn("한빛", out)

    def test_lists_names_and_extra_words(self):
        out, t, m = masked("철수야, 가짜상사 물건이야. 홍길동 씨한테 전해 줘.", names=["홍길동", "철수"], extra=["가짜상사"])
        for leak in ("홍길동", "철수", "가짜상사"):
            self.assertNotIn(leak, out)
        self.assertEqual(mk.find_leaks(out, t, m), [])

    def test_find_leaks_catches_what_was_not_masked(self):
        m = mk.Masker(CUSTOMERS)
        t = mk.AliasTable()
        self.assertTrue(mk.find_leaks("새한카센터 박 부장 010-1234-5678 48고7531", t, m))
        tag = t.alias("사람", "홍길동")
        self.assertTrue(mk.find_leaks(f"{tag} 홍길동", t, m))   # 대응표의 원래 값이 남아도 걸린다

    def test_unmask_card(self):
        out, t, m = masked("세안 카센터 김 사장. 차번호 48고 7531")
        tags = mk.ALIAS_RX.findall(out)
        cust = next(f"〔{a}{b}〕" for a, b in tags if a == "거래처")
        plate = next(f"〔{a}{b}〕" for a, b in tags if a == "차번호")
        card = {"customer": cust, "plate": plate.strip("〔〕"), "items": [{"quote": f"{cust} 앞범퍼"}]}
        back = mk.unmask_obj(card, t)
        self.assertEqual(back["customer"], "새한카센터")
        self.assertEqual(back["plate"], "48고 7531")          # 괄호 없이 적어도 되돌린다
        self.assertEqual(back["items"][0]["quote"], "새한카센터 앞범퍼")

    def test_similarity(self):
        self.assertGreater(mk.similarity("세안", "새한"), 0.8)
        self.assertLess(mk.similarity("한빛", "한일"), 0.8)
        self.assertEqual(mk.similarity("제1카서비스", "제일카서비스"), 1.0)   # 숫자로 받아쓴 상호

    def test_stem_only_self_intro(self):
        out, t, m = masked("네, 부품입니다. 박 부장입니다.\n어, 박 부장. 나 세안이야.\n부장님, 중앙이요.")
        self.assertNotIn("세안", out)
        self.assertNotIn("중앙", out)
        notes = [e.get("note") for e in t.entries.values() if e["kind"] == "거래처"]
        self.assertTrue(any(n and "둘 다" in n for n in notes))      # 새한 · 세한 둘 다와 비슷하면 고르지 않는다
        self.assertEqual(mk.find_leaks(out, t, m), [])


class TestSendGuard(unittest.TestCase):
    def test_only_masked_call_that_passed_check_is_sent(self):
        import real_mode as rm

        class FakeSender(rm.Sender):
            def __init__(self, masker):              # 네트워크 클라이언트를 만들지 않는다
                self.masker, self.dictionary, self.sent = masker, "", []

        m = mk.Masker(CUSTOMERS)
        s = FakeSender(m)
        with self.assertRaises(TypeError):
            s.send_masked("새한카센터 김 사장 앞범퍼 하나")  # 그냥 글은 못 보낸다
        bad = rm.MaskedCall("x", ["새한카센터 김 사장"], mk.AliasTable(), [])
        with self.assertRaises(PermissionError):
            s.send_masked(bad)                            # 검사 결과를 비워 와도 보내기 직전에 다시 검사해 막는다
        tr = {"segments": [{"text": "세안 카센터 김 사장인데요. 앞범퍼 하나."}]}
        good = rm.mask_transcript("y", tr, m)
        self.assertTrue(good.ok)
        self.assertNotIn("김 사장", good.text)


if __name__ == "__main__":
    unittest.main()

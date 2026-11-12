"""받아쓴 통화 글에서 개인정보를 가리고(가명으로 바꾸고), 카드에서 다시 되돌린다 — PC 안에서만 돈다.

AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) · 한결(총괄·서버) 작업방 · 2026-11-12

가리는 것: 전화번호 · 차번호 · 사람 이름(성 + 직함, 이름 목록) · 거래처 상호(거래처 목록 + 상호 꼴) · 주소 · 계좌 · 메일 · 따로 적은 말.
남기는 것: 부품 · 수량 · 차종 · 연식 · 품번 · 금액 · 날짜 · 시각(주문 정보).

가명은 〔거래처A〕 〔사람1〕 〔차번호1〕 〔전화1〕 〔주소1〕 〔계좌1〕 〔메일1〕 〔가림1〕 꼴이다.
대응표(가명 → 원래 값)는 통화마다 파일로 PC 안에만 둔다. 이 모듈은 네트워크를 쓰지 않는다.

한계(README 에도 적음): 패턴으로 찾는 방식이라 성 없이 부른 이름(「철수야」), 상호 꼴이 아닌 거래처 이름,
받아쓰기가 크게 틀린 이름은 놓칠 수 있다. 그래서 (1) 거래처 · 이름 목록을 주면 더 잘 가리고,
(2) 첫 실제 녹음은 「미리 보기」로 사람이 눈으로 확인한 뒤 보낸다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# ───────────────────────── 한글 도우미 ─────────────────────────

_CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
_JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
_JONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"


def jamo(s: str) -> str:
    out = []
    for ch in s:
        c = ord(ch) - 0xAC00
        if 0 <= c < 11172:
            out.append(_CHO[c // 588])
            out.append(_JUNG[(c % 588) // 28])
            if c % 28:
                out.append(_JONG[c % 28])
        else:
            out.append(ch)
    return "".join(out)


# 소리가 비슷해 받아쓰기가 자주 헷갈리는 자모 쌍은 싸게 센다(세안 ↔ 새한)
_NEAR = {frozenset(p): w for p, w in (
    (("ㅐ", "ㅔ"), 0.2), (("ㅒ", "ㅖ"), 0.2), (("ㅙ", "ㅞ"), 0.2), (("ㅚ", "ㅙ"), 0.3), (("ㅚ", "ㅞ"), 0.3),
    (("ㅇ", "ㅎ"), 0.4), (("ㅂ", "ㅍ"), 0.5), (("ㄷ", "ㅌ"), 0.5), (("ㄱ", "ㅋ"), 0.5), (("ㅈ", "ㅊ"), 0.5),
    (("ㅅ", "ㅆ"), 0.4), (("ㄱ", "ㄲ"), 0.4), (("ㄷ", "ㄸ"), 0.4), (("ㅂ", "ㅃ"), 0.4), (("ㅈ", "ㅉ"), 0.4),
    (("ㅗ", "ㅓ"), 0.6), (("ㅜ", "ㅡ"), 0.6), (("ㄴ", "ㅇ"), 0.6), (("ㄹ", "ㄴ"), 0.6),
)}


def _edit(a: str, b: str) -> float:
    prev = [float(i) for i in range(len(b) + 1)]
    for i, ca in enumerate(a, 1):
        cur = [float(i)]
        for j, cb in enumerate(b, 1):
            sub = 0.0 if ca == cb else _NEAR.get(frozenset((ca, cb)), 1.0)
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + sub))
        prev = cur
    return prev[-1]


def similarity(a: str, b: str) -> float:
    """자모 단위 편집 거리로 잰 비슷함(0~1). 소리가 비슷한 자모는 싸게 쳐서
    「세안」과 「새한」은 비슷하게(0.9), 「한빛」과 「한일」은 다르게(0.67) 본다."""
    ja, jb = jamo(_read_digits(norm(a))), jamo(_read_digits(norm(b)))
    if not ja or not jb:
        return 0.0
    return 1 - _edit(ja, jb) / max(len(ja), len(jb))


def _read_digits(s: str) -> str:
    """받아쓰기가 숫자로 적은 상호(제1카서비스)를 소리대로 읽는다(제일카서비스)."""
    return s.translate(str.maketrans("0123456789", "공일이삼사오육칠팔구"))


def split_suffix(name: str) -> tuple[str, str]:
    n = norm(name)
    for suf in sorted(CUSTOMER_SUFFIX + WEAK_SUFFIX, key=len, reverse=True):
        if n.endswith(suf) and len(n) > len(suf):
            return n[: -len(suf)], suf
    return n, ""


def norm(s: str) -> str:
    """띄어쓰기 · 문장부호를 뺀 비교용 글자."""
    return re.sub(r"[\s\W_]+", "", s or "").lower()


def _spaced(word: str) -> str:
    """글자 사이에 띄어쓰기가 있어도 맞게 하는 정규식(「새한 카센터」)."""
    chars = [re.escape(c) for c in norm(word)]
    return r"\s?".join(chars)


# ───────────────────────── 찾는 규칙 ─────────────────────────

SURNAMES = ("김 이 박 최 정 강 조 윤 장 임 한 오 서 신 권 황 안 송 류 유 전 홍 고 문 양 손 배 백 허 남 심 노 하 곽 성 차 "
            "주 우 구 민 진 나 지 엄 채 원 천 방 공 현 함 변 염 여 추 도 소 석 선 설 마 길 연 위 표 명 기 반 왕 금 옥 육 "
            "인 맹 제 모 탁 국 어 은 편 용 예 경 봉 사 부 가 복 태 목 형 피 두 감 호 제갈 남궁 황보 선우 독고").split()
TITLES = ("사장 실장 부장 과장 대리 팀장 주임 기사 공장장 대표 이사 차장 상무 전무 소장 반장 계장 원장 선생 "
          "부사장 본부장 지점장 점장 매니저 형님 사모 여사").split()
# 차번호 가운데 글자(자가용 · 영업용 · 렌터카 · 택배)
PLATE_CH = "가나다라마거너더러머버서어저고노도로모보소오조구누두루무부수우주아바사자배하허호"
REGIONS = "서울 부산 대구 인천 광주 대전 울산 세종 경기 강원 충북 충남 전북 전남 경북 경남 제주".split()
CUSTOMER_SUFFIX = ("자동차공업사 자동차정비 카공업사 카서비스 카센터 카센타 공업사 모터스 정비소 정비공장 "
                   "오토서비스 카클리닉 오토모티브 자동차").split()
# 흔한 말에도 붙는 꼬리말 — 거래처 목록의 이름과 소리가 비슷할 때만 상호로 본다(「산성정비」 ≈ 한성정비)
WEAK_SUFFIX = "정비 모터 상사 오토 카 타이어 서비스 공업 자동차".split()
HANGUL_DIGITS = "공영일이삼사오육칠팔구"
HANGUL_NUM = "일이삼사오육칠팔구십백"
# 「…로 12」 주소처럼 보이지만 흔한 말인 것
NOT_ROAD = set("그대로 따로 새로 바로 서로 별로 주로 대로 실제로 앞으로 뒤로 위로 아래로 옆으로 처음으로 "
               "퀵으로 택배로 배송으로 화물로 차로 기사로 오른쪽으로 왼쪽으로 정도로 대신으로 이대로 저대로 "
               "제대로 멋대로 마음대로 맘대로 순서대로 그걸로 이걸로 저걸로 그거로 이거로 저거로 걸로 거로".split())

_SUR = "|".join(sorted(SURNAMES, key=len, reverse=True))
_TIT = "|".join(sorted(TITLES, key=len, reverse=True))
_SUF = "|".join(sorted(CUSTOMER_SUFFIX, key=len, reverse=True))
_REG = "|".join(REGIONS)

RX = {
    "메일": re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"),
    "전화": re.compile(
        r"(?<!\d)(?:0\d{1,2}[\s.)-]{0,2}\d{3,4}[\s.-]?\d{4}|1[5-9]\d{2}[\s.-]?\d{4})(?!\d)"
        rf"|(?<![{HANGUL_DIGITS}])(?:[공영][{HANGUL_DIGITS}](?:[\s.-]?[{HANGUL_DIGITS}]){{7,10}})(?![{HANGUL_DIGITS}])"),
    "계좌": re.compile(
        r"(?<![\w-])\d{2,6}-\d{2,6}-\d{2,8}(?:-\d{1,3})?(?![\w-])"
        r"|(?:은행|농협|국민|신한|우리은행|하나|기업|카카오뱅크|새마을|우체국|수협|씨티|케이뱅크|토스)[^\d\n]{0,8}\d[\d\s-]{8,}\d"),
    "차번호": re.compile(
        rf"(?<!\d)(?:(?:{_REG})\s?)?\d{{2,3}}\s?[{PLATE_CH}][\s,.·]{{0,3}}\d{{4}}(?!\d)"   # 48고 7531 · 48고, 7531
        rf"|(?<!\d)\d{{2,3}}[{PLATE_CH}](?![가-힣\d])"                                         # 앞부분만(48고,) — 붙여 쓴 것만
        r"|(?<![\dA-Za-z-])\d{2,3}\s?[A-Z]\s?\d{4}(?![\dA-Za-z])"                            # 받아쓰기가 한글을 영문으로(34R7788)
        rf"|(?<![\w{HANGUL_NUM}])[{HANGUL_NUM}]{{1,5}}\s?[{PLATE_CH}]\s?[{HANGUL_DIGITS}](?:\s?[{HANGUL_DIGITS}]){{3}}(?![{HANGUL_DIGITS}])"
        r"|(?<![\d.-])\d{2,3}[-.]\d{4}(?![\d-])"),   # 받아쓰기가 가운데 한글을 빠뜨린 꼴(67-8901)
    "주소": re.compile(
        rf"(?:{_REG})(?:특별시|광역시|특별자치시|특별자치도|도)?\s?[가-힣]{{1,5}}(?:시|군|구)"
        r"(?:\s?[가-힣0-9]{1,8}(?:구|동|읍|면|리|로|길))*(?:\s?\d{1,5}(?:-\d{1,4})?(?:번지|번길)?)?"
        r"|[가-힣0-9]{1,6}동\s?\d{1,5}(?:-\d{1,4})?\s?번지"),
    "도로": re.compile(r"(?<![가-힣])([가-힣0-9]{2,10}(?:로|길))\s?(\d{1,5}(?:번길)?(?:-\d{1,4})?)(?!\s?(?:개|대|세트|짝|박스|통|병|장|미리|cc|키로|번째|분|시|년|원|만|천))"),
    "상호": re.compile(rf"(?<![가-힣A-Za-z0-9])([가-힣A-Za-z0-9]{{1,6}})\s?({_SUF})"),
    "약한상호": re.compile(r"(?<![가-힣A-Za-z0-9])([가-힣A-Za-z0-9]{1,5})\s?(" + "|".join(sorted(WEAK_SUFFIX, key=len, reverse=True))
                       + r")(?=[^가-힣]|[이에은는을를의도요랑하과와인입예서]|$)"),
    "사람": re.compile(rf"(?<![가-힣])(?:{_SUR})(?:\s?[가-힣]{{1,2}})?\s?(?:{_TIT})(?:님)?(?!점|번호|직|급|실|하[다고는면]|해)"),
}

# 상호 꼴 앞에 와도 이름이 아닌 말(「그 카센터」 「저희 공업사」)
NOT_NAME = set("거래처 그 저 이 그쪽 저쪽 이쪽 저희 우리집 어디 다른 아는 근처 옆 앞 동네 큰 작은 새 그런 어느 무슨 여러".split())


# 상호 앞부분만으로 쓰기엔 너무 흔한 말(이 말들은 「자기 소개」 꼴에서만 가린다)
COMMON_STEMS = set("우리 미래 중앙 대한 제일 한일 태양 동네 서울 한국 국제 현대 대성 삼성 신신 새로".split())
# 첫머리 자기 소개 「나 세안이야」 「부장님, 중앙이요」 「〔사람1〕, 태안이야」 — 상호 앞부분만 댄 것
SELF_ID_RX = re.compile(r"(?:(?:^|[\s,])(?:나|여기|저|저희)\s?,?\s?|(?:님|〕)\s?,\s?)([가-힣]{2,4}?)"
                        r"(?=\s?(?:이야|이요|인데요|인데|이에요|예요|입니다|이고요|이고|요\b|요[.,]|〔사람))")
NOT_SELF = set("그거 이거 저거 여기 거기 저기 지금 아까 오늘 내일 어제 그래 그럼 잠깐 사장 부장 실장 대리 기사 "
               "그냥 혹시 근데 그런데 다름 다른 접니다 저예요 나예요 맞아 맞아요 아니 아니요 네네 예예 감사 수고 "
               "부품 주문 배송 반품 교환 문의 확인 전화 손님 정비 공장".split())
STEM_RX = re.compile(r"(?<![가-힣])([가-힣]{2,3}?)(이야|이요|인데요|인데|이에요|예요|입니다|이고|에서|이랑|하고|요|\s|,|\.|$)")
# 차번호 근처 줄에 따로 남은 네 자리(뒷자리) — 값 · 수량 · 연도 · 시각처럼 단위가 붙은 것은 빼고
PLATE_TAIL_RX = re.compile(r"(?<![\d-])(?<!\d[.,])\d{4}(?!\d|[.,]\d|-|\s?(?:원|개|년|년식|cc|번째|미리|키로|만|천|시|분|대|세트|장|박스))")


def _is_account(s: str) -> bool:
    """숫자가 10개 이상일 때만 계좌로 본다(2026-11-12 같은 날짜는 남긴다)."""
    return sum(ch.isdigit() for ch in s) >= 10


ALIAS_RX = re.compile(r"〔(거래처|사람|전화|차번호|주소|계좌|메일|가림)([A-Z]{1,2}|\d{1,3})〕")
LOOSE_ALIAS_RX = re.compile(r"〔?(거래처|사람|전화|차번호|주소|계좌|메일|가림)([A-Z]{1,2}|\d{1,3})〕?")


def _letters(n: int) -> str:
    s = ""
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


# ───────────────────────── 대응표 ─────────────────────────

@dataclass
class AliasTable:
    """가명 ↔ 원래 값. 통화 하나에 하나. PC 안에만 저장한다."""
    entries: dict = field(default_factory=dict)   # 가명 → {"kind", "original", "canonical"?, "note"?}
    _by_key: dict = field(default_factory=dict)   # (종류, 비교용 글자) → 가명
    _count: dict = field(default_factory=dict)

    def alias(self, kind: str, original: str, canonical: str | None = None, note: str | None = None) -> str:
        key = (kind, norm(canonical or original))
        if key in self._by_key:
            return self._by_key[key]
        n = self._count.get(kind, 0)
        self._count[kind] = n + 1
        tag = f"〔{kind}{_letters(n) if kind == '거래처' else n + 1}〕"
        ent = {"kind": kind, "original": original.strip()}
        if canonical:
            ent["canonical"] = canonical
        if note:
            ent["note"] = note
        self.entries[tag] = ent
        self._by_key[key] = tag
        return tag

    def value(self, tag: str) -> str | None:
        e = self.entries.get(tag)
        if not e:
            return None
        return e.get("canonical") or e["original"]

    def to_json(self) -> dict:
        return {"entries": self.entries}

    @classmethod
    def from_json(cls, d: dict) -> "AliasTable":
        t = cls()
        for tag, e in (d.get("entries") or {}).items():
            t.entries[tag] = e
            t._by_key[(e["kind"], norm(e.get("canonical") or e["original"]))] = tag
            t._count[e["kind"]] = t._count.get(e["kind"], 0) + 1
        return t


# ───────────────────────── 가리기 ─────────────────────────

class Masker:
    def __init__(self, customers: list[str] | None = None, names: list[str] | None = None,
                 extra: list[str] | None = None, customer_threshold: float = 0.8):
        self.customers = [c.strip() for c in (customers or []) if c.strip()]
        self.names = [n.strip() for n in (names or []) if len(norm(n)) >= 2]
        self.extra = [w.strip() for w in (extra or []) if len(norm(w)) >= 2]
        self.th = customer_threshold
        # 목록에 있는 이름은 띄어쓰기가 섞여도 찾는다. 긴 것부터.
        # 「한빛카」가 「한빛 카센터」의 앞부분만 잡지 않게, 상호 꼬리말이 이어지면 건너뛴다
        self._cust_rx = [(c, re.compile(_spaced(c) + r"(?!\s?(?:센터|센타|공업|모터|서비스|정비|클리닉))"))
                         for c in sorted(self.customers, key=lambda x: -len(norm(x)))]
        self._name_rx = [(n, re.compile(_spaced(n))) for n in sorted(self.names, key=lambda x: -len(norm(x)))]
        self._extra_rx = [(w, re.compile(_spaced(w), re.I)) for w in sorted(self.extra, key=lambda x: -len(norm(x)))]

    # 거래처 목록에서 가장 비슷한 곳(같은 꼬리말 · 비슷함 기준 이상 · 1등이 뚜렷할 때만)
    def match_customer(self, heard: str) -> tuple[str | None, str | None]:
        if not self.customers:
            return None, None
        stem, suf = split_suffix(heard)
        # 꼬리말(카센터 · 공업사 …)이 같은 곳끼리, 이름 부분만 견준다
        pool = [(split_suffix(c)[0], c) for c in self.customers if suf and split_suffix(c)[1] == suf]
        th = self.th
        if not pool:                      # 꼬리말이 같은 곳이 없으면 전체 이름과 더 엄격하게 견준다
            pool, stem, th = [(norm(c), c) for c in self.customers], norm(heard), max(self.th, 0.88)
        scored = sorted(((similarity(stem, s), c) for s, c in pool), reverse=True)
        best, name = scored[0]
        if best < th:
            return None, None
        if len(scored) > 1 and scored[1][0] >= best - 0.02 and norm(scored[1][1]) != norm(name):
            return None, f"목록의 {name} · {scored[1][1]} 둘 다와 비슷함"
        return name, None

    def mask_lines(self, lines: list[str], table: AliasTable) -> list[str]:
        """통화 한 건(대목 여러 줄)을 가린다. 줄마다 가린 뒤, 차번호를 나눠 불러 준 뒷자리(「러, 4040」)를 앞뒤 줄까지 본다."""
        out = [self.mask(l, table) for l in lines]
        # 첫머리(앞 네 줄) 자기 소개에서 상호 앞부분만 댄 것
        for i in range(min(4, len(out))):
            out[i] = SELF_ID_RX.sub(lambda m: m.group(0) if m.group(1) in NOT_SELF else
                                    m.group(0)[: m.start(1) - m.start(0)] + self._stem_alias(m.group(1), table), out[i])
        near = set()
        for i, l in enumerate(out):
            if "차번호" in l or "〔차번호" in l or "번호" in l:
                near.update(range(max(0, i - 1), min(len(out), i + 3)))
        for i in sorted(near):
            out[i] = PLATE_TAIL_RX.sub(lambda m: table.alias("차번호", m.group(0)), out[i])
        return out

    def _stem_match(self, word: str) -> tuple[str | None, str | None]:
        """상호 앞부분만 들린 말(세안)을 목록의 앞부분(새한)과 견준다."""
        if not self.customers:
            return None, None
        scored = sorted(((similarity(word, split_suffix(c)[0]), c) for c in self.customers
                         if len(split_suffix(c)[0]) >= 2), reverse=True)
        if not scored or scored[0][0] < 0.85:
            return None, None
        best, name = scored[0]
        rivals = [c for s, c in scored[1:] if s >= best - 0.05 and split_suffix(c)[0] != split_suffix(name)[0]]
        if rivals:
            return None, f"목록의 {name} · {rivals[0]} 둘 다와 비슷함"
        same_stem = [c for s, c in scored if split_suffix(c)[0] == split_suffix(name)[0]]
        if len(same_stem) > 1:   # 새한카센터 · 새한자동차공업사처럼 앞부분이 같은 곳이 여럿이면 고르지 않는다
            return None, f"목록에 「{split_suffix(name)[0]}」로 시작하는 곳이 여럿"
        return name, None

    def _stem_alias(self, word: str, table: AliasTable) -> str:
        canon, note = self._stem_match(word)
        return table.alias("거래처", word, canonical=canon, note=note)

    def mask(self, text: str, table: AliasTable) -> str:
        # 받아쓰기가 상호와 사람을 붙여 쓴 것(「…모터스조 기사」)을 떼어 놓는다
        t = re.sub(rf"({_SUF})(?=(?:{_SUR})\s?(?:{_TIT}))", r"\1 ", text)
        # 1) 목록 — 거래처 · 사람 이름 · 따로 적은 말(정확히 · 띄어쓰기 무시)
        for c, rx in self._cust_rx:
            t = rx.sub(lambda m, c=c: table.alias("거래처", m.group(0), canonical=c), t)
        for n, rx in self._name_rx:
            t = rx.sub(lambda m: table.alias("사람", m.group(0)), t)
        for w, rx in self._extra_rx:
            t = rx.sub(lambda m: table.alias("가림", m.group(0)), t)
        # 2) 꼴 — 메일 · 전화 · 계좌 · 차번호 · 주소
        for kind in ("메일", "전화", "계좌", "차번호", "주소"):
            t = RX[kind].sub(lambda m, k=kind: m.group(0) if k == "계좌" and not _is_account(m.group(0))
                             else table.alias(k, m.group(0)), t)
        t = RX["도로"].sub(lambda m: m.group(0) if m.group(1) in NOT_ROAD or m.group(1).endswith("으로")
                         else table.alias("주소", m.group(0)), t)
        # 3) 상호 꼴(…카센터 · …공업사) — 목록과 비슷하면 목록 이름으로 맞춘다
        def _cust(m):
            heard = m.group(1) + m.group(2)
            if m.group(1) in NOT_NAME:
                return m.group(0)
            canon, note = self.match_customer(heard)
            return table.alias("거래처", m.group(0), canonical=canon, note=note)
        t = RX["상호"].sub(_cust, t)
        # 3-2) 흔한 꼬리말(…정비 · …카 · …모터) — 거래처 목록과 비슷할 때만
        def _weak(m):
            if m.group(1) in NOT_NAME:
                return m.group(0)
            canon, note = self.match_customer(m.group(1) + m.group(2))
            if canon or note:
                return table.alias("거래처", m.group(0), canonical=canon, note=note)
            return m.group(0)
        t = RX["약한상호"].sub(_weak, t)
        # 3-3) 상호 앞부분만(「세안인데요」 「한빛에서」) — 흔한 말이 아닌 앞부분이 목록과 소리가 비슷할 때
        def _stem(m):
            w = m.group(1)
            if w in COMMON_STEMS or w in NOT_SELF:
                return m.group(0)
            canon, note = self._stem_match(w)
            return table.alias("거래처", w, canonical=canon, note=note) + m.group(2) if (canon or note) else m.group(0)
        t = STEM_RX.sub(_stem, t)
        # 4) 사람 — 성 + (이름) + 직함
        t = RX["사람"].sub(lambda m: table.alias("사람", m.group(0)), t)
        return t


# ───────────────────────── 검사 ─────────────────────────

def find_leaks(masked: str, table: AliasTable, masker: Masker) -> list[str]:
    """보내기 직전 검사. 하나라도 나오면 보내지 않는다."""
    problems = []
    plain = ALIAS_RX.sub(" ", masked)
    mlines, plines = masked.split("\n"), plain.split("\n")
    for kind in ("메일", "전화", "계좌", "차번호", "주소", "상호", "사람"):
        for m in RX[kind].finditer(plain):
            if kind == "상호" and m.group(1) in NOT_NAME:
                continue
            if kind == "계좌" and not _is_account(m.group(0)):
                continue
            problems.append(f"{kind} 꼴이 남음")
    for m in RX["약한상호"].finditer(plain):
        if m.group(1) not in NOT_NAME and any(masker.match_customer(m.group(1) + m.group(2))):
            problems.append("거래처 목록과 비슷한 상호가 남음")
    for i, l in enumerate(plines[:4]):
        for m in SELF_ID_RX.finditer(l):
            if m.group(1) not in NOT_SELF:
                problems.append("첫머리 자기 소개에 상호로 보이는 말이 남음")
    for m in STEM_RX.finditer(plain):
        w = m.group(1)
        if w not in COMMON_STEMS and w not in NOT_SELF and any(masker._stem_match(w)):
            problems.append("거래처 목록의 앞부분과 비슷한 말이 남음")
    for m in RX["도로"].finditer(plain):
        if not (m.group(1) in NOT_ROAD or m.group(1).endswith("으로")):
            problems.append("주소 꼴이 남음")
    pn = norm(plain)
    for tag, e in table.entries.items():
        for v in (e["original"], e.get("canonical")):
            if v and len(norm(v)) >= 2 and norm(v) in pn:
                problems.append(f"{e['kind']} 원래 값이 남음")
    for lst, kind in ((masker.customers, "거래처"), (masker.names, "사람"), (masker.extra, "가림")):
        for v in lst:
            if len(norm(v)) >= 2 and norm(v) in pn:
                problems.append(f"{kind} 목록의 말이 남음")
    for j, l in enumerate(plines):
        ctx = " ".join(mlines[max(0, j - 2): j + 2])      # mask_lines 가 보는 범위와 같게
        if ("번호" in ctx or "〔차번호" in ctx) and PLATE_TAIL_RX.search(l):
            problems.append("차번호 뒷자리로 보이는 네 자리가 남음")
    if re.search(rf"[{HANGUL_DIGITS}](?:\s?[{HANGUL_DIGITS}]){{8,}}", plain):
        problems.append("숫자를 한글로 읽은 긴 줄이 남음(전화번호일 수 있음)")
    # 문제 내용에는 원래 값을 넣지 않는다(로그 · 화면에 새지 않게)
    return sorted(set(problems))


# ───────────────────────── 되돌리기 ─────────────────────────

def unmask_obj(obj, table: AliasTable):
    """카드(JSON) 안의 가명을 원래 값으로 되돌린다. 거래처는 목록과 맞춘 이름이 있으면 그 이름으로."""
    def fix(s: str) -> str:
        def rep(m):
            tag = f"〔{m.group(1)}{m.group(2)}〕"
            v = table.value(tag)
            return v if v is not None else m.group(0)
        return LOOSE_ALIAS_RX.sub(rep, s)
    if isinstance(obj, str):
        return fix(obj)
    if isinstance(obj, list):
        return [unmask_obj(x, table) for x in obj]
    if isinstance(obj, dict):
        return {k: unmask_obj(v, table) for k, v in obj.items()}
    return obj

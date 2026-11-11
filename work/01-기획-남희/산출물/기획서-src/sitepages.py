# 「사이트에서 확인」 쪽: 개발 방 구현-대조표 요약 + 실제 사이트 화면 (v1.1~)
# 대조표: 저장소 main 의 work/03-개발-태림/산출물/구현-대조표.md (개발 방이 쓴다)
# 화면: ../../자료/그림/사이트/*.png (shots.py 로 찍음)
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SHOT_DIR = HERE.parent.parent / "자료" / "그림" / "사이트"
TABLE = HERE.parent.parent.parent / "03-개발-태림" / "산출물" / "구현-대조표.md"
SITE = "t07.3-39-67-126.sslip.io"

CAPS = {
    "F10-today": "F10 오늘 브리핑 — 숫자 타일 · 종류별 한 줄 · AI 한 단락 · 먼저 할 일 · 마감 요약 복사",
    "F08-calls": "F08 통화 찾기 — 「앞범퍼」 검색, 상태 · 날짜 · 거래처 거르기, 맞은 문장 굵게",
    "F02-F05-call": "F02 · F04 · F05 통화 상세 — 녹음 재생 · 문장별 시각 · 주문 카드(AI 초안 표시) · 칸 옆 ▶ 근거",
    "F06-board": "F06 주문 카드 보드 — 확인 필요 → 확정 → 출고 완료",
    "F03-live": "F03 실시간 받아쓰기 — 마이크 · 예시 문장 · 카드 미리보기 · 소리가 가는 곳 안내",
    "F01-upload": "F01 녹음 올리기 — 가짜 녹음만 · 확인 체크 · 예시 파일",
    "F09-ask": "F09 지난 통화에 묻기 — 예시 질문 · 근거 없으면 「찾지 못했어요」",
    "F07-glossary": "F07 낱말 사전 — 현장 말 · 거래처 · 차종",
    "F13-customer": "F13 거래처별 모아 보기 — 통화 · 카드 날짜순",
    "F14-shipping": "F14 출고 목록 — 거래처별 · 인쇄 · CSV",
    "M-today": "휴대폰 — 오늘 브리핑",
    "M-call": "휴대폰 — 통화 상세",
}
ORDER = ["F10-today", "F02-F05-call", "F08-calls", "F06-board", "F03-live", "F01-upload", "F09-ask", "F07-glossary", "F13-customer", "F14-shipping"]


def parse_table():
    """구현-대조표.md 에서 'F01' 로 시작하는 표 줄을 (ID, 칸들) 로 읽는다. 없으면 빈 목록."""
    if not TABLE.exists():
        return [], None
    rows, head = [], None
    for line in TABLE.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if head is None and any("ID" in c or "기능" in c for c in cells):
            head = cells
            continue
        if cells and re.match(r"^\**F\d\d", cells[0]):
            rows.append(cells)
    return rows, head


def _img(name):
    return f"img/site-{name}.jpg"


def pages(page):
    out = []
    rows, head = parse_table()
    if rows and head:
        th = "".join(f"<th>{h}</th>" for h in head[:6])
        tr = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r[:6]) + "</tr>" for r in rows)
        table = f"<table class='tight'>{th}{tr}</table>"
    else:
        table = "<div class='box yellow'>개발 방 구현-대조표가 아직 없다. 들어오면 이 자리에 기능별 「동작 / 일부 / 안 됨」이 붙는다.</div>"
    out.append(page(f"""
<div class="kicker">사이트에서 확인</div><h2 class="sec">기획서 기능 ↔ 데모 사이트 1:1 대조</h2>
<p class="lead">데모 주소 <b>{SITE}</b> — 휴대폰 · 태블릿 · PC 어디서나, 로그인 없이. 아래 표는 개발 방이 기획서 완료 기준을 하나씩 눌러 보고 적은 구현-대조표를 옮긴 것이다.</p>
{table}
<p class="src">원본: work/03-개발-태림/산출물/구현-대조표.md · 완료 기준 체크리스트: work/03-개발-태림/받은자료/기획서-v1-완료기준.md</p>
""", foot="사이트에서 확인"))
    big = [n for n in ["F10-today", "F02-F05-call", "F08-calls", "F06-board", "F03-live", "F09-ask"] if (SHOT_DIR / f"{n}.png").exists()]
    small = [n for n in ["F01-upload", "F07-glossary", "F13-customer", "F14-shipping"] if (SHOT_DIR / f"{n}.png").exists()]
    k = 0
    for i in range(0, len(big), 2):
        k += 1
        cells = "".join(f"<figure><img src='{_img(n)}' alt='' style='height:112mm;object-fit:cover;object-position:top;border:.3mm solid #E6E9EC'><figcaption>{CAPS[n]}</figcaption></figure>" for n in big[i:i + 2])
        out.append(page(f"""
<div class="kicker">사이트에서 확인</div><h2 class="sec">실제 사이트 화면 ({k})</h2>
{cells}
""", foot="사이트 화면"))
    if small:
        k += 1
        cells = "".join(f"<figure><img src='{_img(n)}' alt='' style='height:100mm;object-fit:cover;object-position:top left;border:.3mm solid #E6E9EC'><figcaption>{CAPS[n]}</figcaption></figure>" for n in small)
        out.append(page(f"""
<div class="kicker">사이트에서 확인</div><h2 class="sec">실제 사이트 화면 ({k})</h2>
<div class="grid2">{cells}</div>
<p class="src">Edge 헤드리스로 찍은 데모 사이트 화면(가로 1280, 왼쪽 메뉴는 잘라 냄). 화면의 거래처 · 번호 · 차번호 · 품번은 모두 지어낸 가짜 데이터다.</p>
""", foot="사이트 화면"))
    if all((SHOT_DIR / f"{m}.png").exists() for m in ["M-today", "M-call"]):
        out.append(page(f"""
<div class="kicker">사이트에서 확인</div><h2 class="sec">휴대폰에서</h2>
<div class="grid2" style="grid-template-columns:1fr 1fr;align-items:start">
<figure><img src='{_img("M-today")}' alt='' style='border:.3mm solid #E6E9EC;max-height:200mm;object-fit:contain'><figcaption>{CAPS["M-today"]}</figcaption></figure>
<figure><img src='{_img("M-call")}' alt='' style='border:.3mm solid #E6E9EC;max-height:200mm;object-fit:contain;object-position:top'><figcaption>{CAPS["M-call"]}</figcaption></figure>
</div>
<p class="src">가로 390 화면. 글씨 크게(F15)는 모든 화면 위 막대의 「글씨 크게」로 켠다.</p>
""", foot="사이트 화면"))
    return out

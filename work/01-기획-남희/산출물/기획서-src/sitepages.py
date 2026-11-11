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
    "F10-today": "F10 오늘 브리핑 — 숫자 타일 · 종류별 한 줄 · AI 한 단락 · 먼저 할 일 · 마감 요약 복사 (11/11 23:35 화면)",
    "F08-calls": "F08 통화 찾기 — 「앞범퍼」 검색, 상태 · 날짜 · 거래처 거르기, 맞은 문장 굵게",
    "F02-F05-call": "F02 · F04 통화 상세 — 문장별 시각 · 색 표시(부품 · 차 · 거래처) · 주문 카드(「AI 초안」 · 「번호로 확인」) · 칸 옆 ▶ 근거",
    "F05-listen": "F05 들어 보기 — 차번호를 고쳐 말한 대목에 노란 「들어 보기 0:02」와 이유, 칸마다 ▶ 근거 재생",
    "F06-board": "F06 주문 카드 보드 — 확인 필요 → 확정 → 출고 완료",
    "F03-live": "F03 실시간 받아쓰기 — 마이크 · 예시 문장 · 카드 미리보기 · 소리가 가는 곳 안내",
    "F01-upload": "F01 녹음 올리기 — 가짜 녹음만 · 확인 체크 · 예시 파일",
    "F09-ask": "F09 지난 통화에 묻기 — 예시 질문 · 근거 없으면 「찾지 못했어요」",
    "F07-glossary": "F07 낱말 사전 — 현장 말 · 거래처 · 차종",
    "F13-customer": "F13 거래처별 모아 보기 — 통화 · 카드 날짜순",
    "F14-shipping": "F14 출고 목록 — 거래처별 · 인쇄 · CSV",
    "M-today": "휴대폰 — 오늘 브리핑 (11/11 23:35 화면)",
    "M-call": "휴대폰 — 통화 상세",
}
ORDER = ["F10-today", "F02-F05-call", "F08-calls", "F06-board", "F03-live", "F01-upload", "F09-ask", "F07-glossary", "F13-customer", "F14-shipping"]


DEV_REF = "origin/dev:work/03-개발-태림/산출물/구현-대조표.md"


def table_text():
    """대조표는 개발 방이 dev 가지에 둔다. 굽는 순간의 dev 판을 git 으로 읽는다(없으면 작업 폴더 사본)."""
    import subprocess
    try:
        r = subprocess.run(["git", "-c", "core.quotepath=false", "show", DEV_REF], cwd=HERE, capture_output=True, timeout=30)
        if r.returncode == 0 and r.stdout:
            rev = subprocess.run(["git", "log", "-1", "--format=%h", "origin/dev"], cwd=HERE, capture_output=True, text=True).stdout.strip()
            return r.stdout.decode("utf-8"), rev
    except Exception:
        pass
    return (TABLE.read_text(encoding="utf-8"), "") if TABLE.exists() else ("", "")


def parse_table(text, section="## 한눈에"):
    """대조표의 한 절에서 표 줄을 읽는다."""
    if not text:
        return [], None
    rows, head, on = [], None, False
    for line in text.splitlines():
        if line.startswith("## "):
            on = line.startswith(section)
            continue
        if not on:
            continue
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if head is None:
            head = cells
            continue
        if set("".join(cells)) <= set("-: "):
            continue
        rows.append(cells)
    return rows, head


def md(c):
    c = re.sub(r"`([^`]*)`", lambda m: "<code>" + m.group(1) + "</code>", c)
    return re.sub(r"[*][*]([^*]*)[*][*]", lambda m: "<b>" + m.group(1) + "</b>", c)


def _img(name):
    return f"img/site-{name}.jpg"


def pages(page):
    out = []
    text, rev = table_text()
    rows, head = parse_table(text, "## 한눈에")
    crow, chead = parse_table(text, "## 모든 화면 공통")
    if rows and head:
        def chip(st):
            cls = "ok" if st.startswith("동작") else ("guess" if st.startswith("일부") else "gray")
            return f"<span class='chip {cls}'>{md(st)}</span>"
        tr = "".join(f"<tr><td><b>{r[0]}</b></td><td>{md(r[1])}</td><td>{chip(r[2])}</td><td class='small'>{md(r[3])}</td></tr>" for r in rows)
        table = f"<table class='tight daejo'><tr><th style='width:6%'>ID</th><th style='width:17%'>기능</th><th style='width:15%'>상태</th><th>확인하는 법(사이트에서 누를 것)</th></tr>{tr}</table>"
        common = ""
        if crow:
            tr2 = "".join(f"<tr><td>{md(r[0])}</td><td>{chip(r[1])}</td><td class='small'>{md(r[2])}</td></tr>" for r in crow)
            common = f"<h3>모든 화면 공통 — 대조표</h3><table class='tight daejo'><tr><th style='width:30%'>항목</th><th style='width:10%'>상태</th><th>확인하는 법</th></tr>{tr2}</table>"
        table += f"<p class='src'>개발 방 구현-대조표(dev 가지 {rev}) 를 그대로 옮겼다 — 「동작」은 개발 방이 완료 기준을 사이트에서 실제로 확인했다는 뜻이다. 기획 방이 같은 주소로 화면을 다시 찍어 다음 쪽들에 붙였다.</p>"
    else:
        common = ""
        table = "<div class='box yellow'>개발 방 구현-대조표가 아직 없다. 들어오면 이 자리에 기능별 「동작 / 일부 / 안 됨」이 붙는다.</div>"
    out.append(page(f"""
<div class="kicker">사이트에서 확인</div><h2 class="sec">기획서 기능 ↔ 데모 사이트 1:1 대조</h2>
<p class="lead">데모 주소 <b>{SITE}</b> — 휴대폰 · 태블릿 · PC 어디서나, 로그인 없이. 기획서 기능 15개가 모두 「동작」이다. 아침에 사람이 눌러 볼 순서도 함께 적었다.</p>
{table}
""", foot="사이트에서 확인"))
    out.append(page(LIMITS.replace("@@COMMON@@", common), foot="사이트에서 확인"))
    big = [n for n in ["F10-today", "F02-F05-call", "F05-listen", "F08-calls", "F06-board", "F03-live", "F09-ask", "F01-upload"] if (SHOT_DIR / f"{n}.png").exists()]
    small = [n for n in ["F07-glossary", "F13-customer", "F14-shipping"] if (SHOT_DIR / f"{n}.png").exists()]
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


LIMITS = """
<div class="kicker">사이트에서 확인</div><h2 class="sec">데모 범위와 한계 — 기획서와 맞춘 것</h2>
<table><tr><th style="width:22%">무엇</th><th>데모에서는</th></tr>
<tr><td><b>받아쓰기 일꾼</b> (F02 · F12)</td><td>대표님 PC GPU 의 Whisper large-v3 가 켜져 있을 때만 새 녹음이 받아써진다. 꺼져 있으면 「받아쓰기 일꾼 대기 중」으로 줄을 서고, 미리 넣은 가짜 통화 54건(합성 음성)으로 나머지 기능은 늘 체험된다. 실측: 48.9초 녹음이 올리기부터 카드까지 약 19초(총괄 · 서버 방).</td></tr>
<tr><td><b>실시간 받아쓰기</b> (F03)</td><td>브라우저 음성 인식이라 크롬 · 엣지 · 안드로이드 크롬에서만 마이크가 된다. 음성은 브라우저 회사 서버에서 글로 바뀐다(화면에 안내). 아이폰 사파리 · 파이어폭스는 「샘플 대화 재생」.</td></tr>
<tr><td><b>AI(Claude)</b> (F04 · F09 · F10)</td><td>카드 정리 · 브리핑 · 묻기는 서버에서 Claude 를 부른다 — 가짜 통화 글이 해외로 간다. 누구나 쓰는 데모라 IP 당 · 하루 전체 횟수를 막아 두었다.</td></tr>
<tr><td><b>카드 정확도</b> (F04 · F05)</td><td>어려운 가짜 통화 4건을 정답과 비교해 34칸 중 32칸 일치. 놓친 품번 숫자 하나는 「자릿수가 보통과 다릅니다 — 들어 보세요」로 잡혔다(해결사 방 비교). 합성 음성이라 실제 통화보다 쉽다는 점을 감안해야 한다.</td></tr>
<tr><td><b>품번</b> (공통)</td><td>서버가 한 번 더 검사한다 — 통화에 품번을 불러 준 말이 없으면 AI 가 쓴 품번을 지우고 「들어 보기」로 돌린다.</td></tr>
<tr><td><b>폴더 보내기</b> (F12)</td><td>PC 에서 도는 작은 Node 프로그램이 폴더를 지켜보다가 새 녹음을 보낸다. 같은 파일은 다시 안 들어간다. 공개 데모는 가짜 녹음만 받는다.</td></tr>
<tr><td><b>날짜</b></td><td>미리 넣은 통화는 서버가 날마다 「오늘」로 다시 잡는다. 새벽에 열면 오늘 통화가 이른 시각으로 보인다.</td></tr>
<tr><td><b>기능 밖 화면</b></td><td>소개 페이지(/intro/) · 무료 체험 신청 · 관리자(암호) — 사용자 기능이 아니라 기능 번호가 없다.</td></tr>
</table>
<p class="src">출처: 개발 방 구현-대조표 「데모 범위 · 한계」 절. 이 쪽의 숫자는 데모 환경에서 잰 것이고 실제 대리점 통화로 잰 값이 아니다.</p>
@@COMMON@@
"""

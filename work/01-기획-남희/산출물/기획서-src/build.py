# 기획서 HTML → PDF 굽기
# 쓰는 법: python build.py v1      → ../기획서-v1.pdf  (+ _build/preview/*.png 로 쪽 그림)
# 필요: Python 3 · Pillow · PyMuPDF · Microsoft Edge(또는 Chrome)
import html, os, shutil, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
IMG_SRC = HERE.parent.parent / "자료" / "그림"
# 한글 경로를 Edge 가 못 다뤄서 임시 폴더(영문 경로)에서 굽는다
BUILD = Path(tempfile.gettempdir()) / "t07-plan-build"
sys.path.insert(0, str(HERE))
from features import FEATURES, P1, SEEN  # noqa: E402
import sections  # noqa: E402

VERSION = sys.argv[1] if len(sys.argv) > 1 else "v1"
DATE = sections.DATE


def esc(s):
    return html.escape(s, quote=False)


def img(name):
    return f"img/{name}.jpg"


def run_header():
    return f'<div class="run"><span><b>AI 초안</b> · 돌린 사람: 배*결 · 검토 전</span><span>AI 전화 주문 받아쓰기 기획서 {VERSION} · 제품명: 투표로 정함</span></div>'


def page(body, cls="", foot=""):
    return f'<section class="page {cls}">{run_header()}{body}<div class="foot"><span>{esc(foot)}</span></div></section>'


def feature_page(f):
    why = "".join(f"<li>{esc(w)}</li>" for w in f["why"])
    flow = "".join(f"<li>{esc(s)}</li>" for s in f["flow"])
    done = "".join(f"<li>{esc(d)}</li>" for d in f["done"])
    demo_cls = "real" if f["demo"].startswith("실제") else "fake"
    seen = "".join(f"<li>{esc(x)}</li>" for x in SEEN.get(f["id"], []))
    body = f"""
<div class="kicker">기능 {f['id'][1:]} / P0 {len(FEATURES)}개</div>
<div class="fhead"><span class="fid">{f['id']}</span><span class="fname">{esc(f['name'])}</span>
<span class="chip p0">{f['pri']} 데모 필수</span><span class="chip {demo_cls}">데모: {esc(f['demo'])}</span></div>
<p class="fpurpose">{esc(f['purpose'])}</p>
<div class="fimg" style="height:{f.get('imgh', 104)}mm"><img src="{img(f['img'])}" alt=""></div>
<div class="fcap">장면 그림 — 박 부장(접수) · 김 사장(정비소) · 이 기사(출고)와 장면 속 거래처 · 차 정보는 모두 지어낸 것이다. 그림 속 화면은 모양만 나타낸 것이다.</div>
<div class="fcols">
  <div>
    <h4>왜 필요한가</h4><ul class="why">{why}</ul>
    <h4>언제 쓰나 — 장면</h4><div class="scene">{esc(f['scene'])}</div>
  </div>
  <div>
    <h4>화면 흐름</h4><ol class="steps">{flow}</ol>
    <h4>완료 기준 (눈으로 확인)</h4><ul class="checks">{done}</ul>
  </div>
</div>
<div class="box gray seen"><h4>조사에서 본 것</h4><ul>{seen}</ul></div>
<div class="refline">{esc(f['ref'])}</div>"""
    return page(body, foot=f"{f['id']} {f['name']}")


def p1_page():
    rows = "".join(
        f"<tr><td><b>{p['id']}</b></td><td><b>{esc(p['name'])}</b><br><span class='small'>{esc(p['purpose'])}</span></td>"
        f"<td>{esc(p['scene'])}</td><td>{esc(p['demo'])}</td><td>{esc(p['done'])}</td></tr>" for p in P1)
    body = f"""
<div class="kicker">기능 · P1</div><h2 class="sec">있으면 좋은 기능 (P1)</h2>
<p class="lead">P0 를 받쳐 주는 기능이다. 사이트에 들어간 것만 이 쪽에 남기고, 못 들어간 것은 부록 「다음 단계」로 옮긴다.</p>
<table><tr><th style="width:9%">ID</th><th style="width:22%">기능 · 목적</th><th style="width:27%">장면</th><th style="width:14%">데모 범위</th><th>완료 기준</th></tr>{rows}</table>
{sections.P1_NOTE}"""
    return page(body, foot="P1 기능")


def toc(pages):
    import re
    want = [("문제와 사용자", "문제와 사용자"), ("조사 요약", "조사: 서비스"), ("대리점 생태계", "조사: 부품 대리점"), ("차별점", "차별점"),
            ("기능 한눈에", "기능 목록"), ("F01 녹음 올리기", "기능 쪽 F01~F10"), ("P1 기능", "P1 기능 F11~F15"), ("사이트에서 확인", "사이트에서 확인"),
            ("전체 시스템 구조", "시스템 구조"), ("데이터 · 보안 · 개인정보", "데이터 · 보안"), ("일정 · 미결 · 아침 질문", "일정 · 아침 질문"),
            ("부록 A · 다음 단계", "부록 A 다음 단계"), ("부록 B · 출처", "부록 B 출처"), ("부록 C · 만든 과정", "부록 C 만든 과정")]
    feet = [re.search(r'<div class="foot"><span>(.*?)</span>', x) for x in pages]
    feet = [m.group(1) if m else "" for m in feet]
    items = []
    for key, label in want:
        for i, f in enumerate(feet):
            if f == key:
                items.append(f"<div><span>{label}</span><b>{i + 1}</b></div>")
                break
    return '<h3>목차</h3><div class="toc2">' + "".join(items) + "</div><div style='height:3mm'></div>"


def prepare_images():
    from PIL import Image
    out = BUILD / "img"
    out.mkdir(parents=True, exist_ok=True)
    for p in IMG_SRC.glob("*.png"):
        im = Image.open(p).convert("RGB")
        w = 1500 if not p.stem.startswith("s00") else 1800
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im.save(out / f"{p.stem}.jpg", quality=80, optimize=True, progressive=True)
    for p in (IMG_SRC / "사이트").glob("*.png"):
        im = Image.open(p).convert("RGB")
        im.save(out / f"site-{p.stem}.jpg", quality=85, optimize=True, progressive=True)


def build_html():
    pages = []
    pages += sections.front_pages(page, img)
    pages += sections.research_pages(page, img)
    pages += sections.overview_pages(page, img, FEATURES, P1)
    pages += [feature_page(f) for f in FEATURES]
    if P1:
        pages.append(p1_page())
    import sitepages  # 사이트에서 확인 쪽 (대조표 · 화면)
    pages += sitepages.pages(page)
    pages += sections.back_pages(page, img)
    pages = [x.replace("@@TOC@@", toc(pages)) for x in pages]
    doc = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>AI 전화 주문 받아쓰기 기획서 {VERSION}</title>
<link rel="stylesheet" href="style.css"></head><body>{''.join(pages)}</body></html>"""
    BUILD.mkdir(exist_ok=True)
    for f in ["style.css"]:
        shutil.copy(HERE / f, BUILD / f)
    if (BUILD / "fonts").exists():
        shutil.rmtree(BUILD / "fonts")
    shutil.copytree(HERE / "fonts", BUILD / "fonts")
    (BUILD / "index.html").write_text(doc, encoding="utf-8")
    return BUILD / "index.html"


def find_browser():
    for p in [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Google\Chrome\Application\chrome.exe"]:
        if os.path.exists(p):
            return p
    raise SystemExit("Edge/Chrome 을 찾지 못했다")


def print_pdf(src, pdf):
    tmp = BUILD / "raw.pdf"
    tmp.unlink(missing_ok=True)
    prof = BUILD / "profile"
    subprocess.run([find_browser(), "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    f"--user-data-dir={prof}", "--virtual-time-budget=15000", "--run-all-compositor-stages-before-draw",
                    f"--print-to-pdf={tmp}", src.as_uri()], check=True, timeout=180,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    import time
    for _ in range(120):  # Edge 가 넘겨받은 프로세스에서 늦게 쓸 때가 있다
        if tmp.exists() and tmp.stat().st_size > 0:
            time.sleep(1); break
        time.sleep(0.5)
    import fitz
    doc = fitz.open(tmp)
    doc.set_metadata({"title": f"AI 전화 주문 받아쓰기 기획서 {VERSION} (제품명: 투표로 정함)",
                      "author": "AI 초안 · 돌린 사람: 배*결 · 검토 전", "subject": "T07 7번 아이템 기능 요청 · 기획서",
                      "creator": "Claude Code(Opus 5.5) · 남희(기획) 작업방"})
    doc.save(pdf, garbage=4, deflate=True)
    n = doc.page_count
    prev = BUILD / "preview"
    if prev.exists():
        shutil.rmtree(prev)
    prev.mkdir()
    for i, pg in enumerate(fitz.open(pdf)):
        pg.get_pixmap(dpi=60).save(prev / f"p{i+1:02d}.png")
    return n


if __name__ == "__main__":
    prepare_images()
    src = build_html()
    pdf = HERE.parent / f"기획서-{VERSION}.pdf"
    n = print_pdf(src, pdf)
    print(f"{pdf.name}: {n}쪽, {pdf.stat().st_size/1e6:.1f}MB · 미리보기 {BUILD / 'preview'}")

# 데모 사이트 화면을 Edge 헤드리스로 찍는다 → ../../자료/그림/사이트/<id>.png (가로 1280 → 저장소용으로 줄임)
# 쓰는 법: python shots.py   (사이트 주소는 SITE 환경변수로 바꿀 수 있다)
import os, subprocess, sys, tempfile, time, urllib.parse
from pathlib import Path
from PIL import Image

SITE = os.environ.get("SITE", "https://t07.3-39-67-126.sslip.io")
OUT = Path(__file__).resolve().parent.parent.parent / "자료" / "그림" / "사이트"
TMP = Path(tempfile.gettempdir()) / "t07-shots"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

DETAIL = os.environ.get("DETAIL", "fx-c43")      # 카드 · 근거가 잘 보이는 가짜 통화
CUSTOMER = os.environ.get("CUSTOMER", "새한카센터")
CROP_Y = {"F02-F05-call": (560, 1560), "F05-listen": (600, 1560)}
SHOTS = [  # (파일 이름, 해시 주소, 가로, 세로)
    ("F10-today", "#/", 1280, 1000),
    ("F08-calls", "#/calls?q=" + urllib.parse.quote("앞범퍼"), 1280, 1000),
    ("F02-F05-call", f"#/calls/{DETAIL}", 1280, 1700),
    ("F05-listen", "#/calls/fx-c51", 1280, 1900),
    ("F06-board", "#/board", 1280, 1000),
    ("F03-live", "#/live", 1280, 1000),
    ("F01-upload", "#/upload", 1280, 1000),
    ("F09-ask", "#/ask", 1280, 1000),
    ("F07-glossary", "#/glossary", 1280, 1000),
    ("F13-customer", "#/customers/" + urllib.parse.quote(CUSTOMER), 1280, 1000),
    ("F14-shipping", "#/shipping", 1280, 1000),
    ("M-today", "#/", 390, 844),
    ("M-call", f"#/calls/{DETAIL}", 390, 1400),
]


def shot(name, route, w, h):
    TMP.mkdir(exist_ok=True)
    raw = TMP / f"{name}.png"
    raw.unlink(missing_ok=True)
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={TMP / 'profile'}",
                    f"--window-size={w},{h}", "--virtual-time-budget=12000", f"--screenshot={raw}", SITE + "/" + route],
                   timeout=90, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        if raw.exists() and raw.stat().st_size > 0:
            break
        time.sleep(0.5)
    im = Image.open(raw).convert("RGB")
    if w >= 1000:  # 데스크톱: 왼쪽 메뉴(약 248px)를 잘라 본문을 크게
        im = im.crop((248, 0, im.width, im.height))
    if name in CROP_Y:  # 긴 화면은 보여 줄 부분만
        y0, y1 = CROP_Y[name]
        im = im.crop((0, y0, im.width, min(y1, im.height)))
    if im.width > 1100:
        im = im.resize((1100, round(im.height * 1100 / im.width)), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / f"{name}.png"
    im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(dst, optimize=True)
    print(name, im.size, dst.stat().st_size // 1024, "KB")


# 주의: 미리 넣은 가짜 통화는 서버가 날마다 「오늘」로 다시 잡는다. 자정 직후에는 오늘 브리핑이 0건으로 보이니
#       F10-today · M-today 는 낮이나 저녁에 찍는다(python shots.py F10-today M-today).
if __name__ == "__main__":
    only = sys.argv[1:]
    for s in SHOTS:
        if not only or s[0] in only:
            shot(*s)

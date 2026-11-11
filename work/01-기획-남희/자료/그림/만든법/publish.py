# 그린 원본(1536px)을 저장소용으로 줄인다: 가로 1400px · 256색 PNG
import sys
from pathlib import Path
from PIL import Image
DST = Path(r"C:\Users\pc\T07-genai-project\.claude\worktrees\nam-plan-548ea6\work\01-기획-남희\자료\그림")
DST.mkdir(parents=True, exist_ok=True)
srcs = [Path("ref/char-sheet.png")] + sorted(Path("out").glob("*.png"))
for p in srcs:
    d = DST / p.name
    if d.exists() and d.stat().st_mtime > p.stat().st_mtime and d.stat().st_size < 900_000:
        continue
    im = Image.open(p).convert("RGB")
    if im.width > 1400:
        im = im.resize((1400, round(im.height * 1400 / im.width)), Image.LANCZOS)
    im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(d, optimize=True)
    print(d.name, d.stat().st_size // 1024, "KB")

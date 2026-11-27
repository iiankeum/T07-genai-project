"""단어장 효과 재기(명령줄).

    .venv\\Scripts\\python tools\\eval.py samples\\부품주문-전화 glossary_stt\\examples\\자동차부품-예시.csv --model large-v3-turbo

녹음 폴더에는 audio.* 와 reference.txt(정답 글)가 있어야 한다.
결과는 표로 찍고, 같은 폴더에 result-<모델>.json 으로 남긴다.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from glossary_stt.engine import load_engine, load_audio  # noqa: E402
from glossary_stt.evaluate import compare  # noqa: E402
from glossary_stt.glossary import Glossary  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("glossary")
    ap.add_argument("--model", default="large-v3-turbo")
    ap.add_argument("--device", default="auto")
    ap.add_argument("--context", default="")
    ap.add_argument("--show-text", action="store_true")
    a = ap.parse_args()

    folder = Path(a.folder)
    audio_path = next(p for p in folder.iterdir() if p.stem == "audio")
    reference = (folder / "reference.txt").read_text(encoding="utf-8")
    glossary = Glossary.load(Path(a.glossary))
    engine = load_engine(a.model, a.device)
    print(f"엔진: {engine.label} · 단어장 {len(glossary.entries)}개 · {audio_path.name}")
    res = compare(engine, load_audio(str(audio_path)), reference, glossary, a.context)
    print(f"녹음 {res['duration']}초 · 힌트에 들어간 낱말 {len(res['hints']['included'])}개 / {res['hints']['tokens']}토큰")
    print(f"{'방식':<22}{'글자 오류율':>10}{'낱말 맞힘':>12}{'듣기':>6}{'걸린 시간':>10}")
    for r in res["rows"]:
        print(f"{r['label']:<22}{r['cer'] * 100:>9.1f}%{r['termHit']:>7}/{r['termTotal']:<4}"
              f"{r['passes']:>5}번{r['elapsed']:>9.1f}초")
        if r["missed"]:
            print(f"{'':<22}놓친 낱말: {', '.join(r['missed'])}")
        if a.show_text:
            print(f"{'':<22}{r['text']}")
    out = folder / f"result-{a.model}.json"
    out.write_text(json.dumps({"engine": engine.label, **res}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"저장: {out}")


if __name__ == "__main__":
    main()

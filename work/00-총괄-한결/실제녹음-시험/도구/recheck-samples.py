# 올릴 파일 자체를 다시 받아써서(설정을 바꿔 두 번) 가림 검사를 한 번 더 한다. 출력은 숫자만.
#   ACHA_PC_AGENT_DIR=<아차 코드>/src/pc-agent  <받아쓰기용 파이썬> recheck-samples.py
import os
import sys
from pathlib import Path
PC_AGENT = Path(os.environ["ACHA_PC_AGENT_DIR"])
sys.path.insert(0, str(PC_AGENT))
import masking as mk
import callnote_agent as ca
import subprocess
import numpy as np


def decode(path):
    """ffmpeg 로 16kHz 한 채널 소리로 푼다."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

REAL = Path(os.environ.get("ACHA_REAL_HOME") or Path.home() / ".t07-real")
out = Path(os.environ.get("ACHA_SAMPLE_DIR") or REAL / "samples" / "work") / "out"
tr = ca.WhisperTranscriber("large-v3", "auto", 5)
print("엔진:", tr.engine)
masker = mk.Masker()
PASSES = [("소리 구간 찾기 끔", dict(vad_filter=False, beam_size=5, temperature=0.0)),
          ("소리 구간 찾기 끔 · 넓게 탐색", dict(vad_filter=False, beam_size=10, temperature=0.0, patience=2.0))]
for f in sorted(out.glob("sample-*.mp3")):
    audio = decode(f)
    for label, kw in PASSES:
        segs, _ = tr.model.transcribe(audio, language="ko", condition_on_previous_text=False, word_timestamps=True, **kw)
        segs = list(segs)
        table = mk.AliasTable()
        lines = masker.mask_lines([s.text for s in segs], table)
        problems = mk.find_leaks("\n".join(lines), table, masker)
        low = sum(1 for s in segs for w in (s.words or []) if w.probability < 0.5)
        tot = sum(len(s.words or []) for s in segs)
        print(f"=== {f.name} · {label} · 가린 곳 {len(table.entries)} · 남은 문제 {len(problems)} · 자신 없는 낱말 {low}/{tot}")

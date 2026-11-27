# 고른 통화의 원본 녹음에서 첫머리를 잘라 내고, 파일에 붙은 꼬리표(메타데이터)를 지워 예시 파일을 만든다.
# 소리는 다시 압축하지 않는다(-c copy). 출력은 숫자만.
#   ACHA_INBOX_DIR=<원본 녹음 폴더>  python build-samples.py 3:1.6 11:0 9:0   (후보 번호:앞에서 자를 초)
import hashlib, json, os, subprocess, sys
from pathlib import Path
REAL = Path(os.environ.get("ACHA_REAL_HOME") or Path.home() / ".t07-real")          # 실제 녹음을 두는 비밀 폴더
home = Path(os.environ.get("ACHA_TEST_HOME") or REAL / "acha-v16")                   # 시험 서버의 자료 폴더
work = Path(os.environ.get("ACHA_SAMPLE_DIR") or REAL / "samples" / "work")          # 고른 목록 · 만든 파일(저장소 밖)
inbox = Path(os.environ["ACHA_INBOX_DIR"])                                           # 원본 녹음이 있는 폴더(저장소 밖)

out = work / "out"; out.mkdir(parents=True, exist_ok=True)
picks = {p["n"]: p for p in json.loads((work / "pick.json").read_text(encoding="utf-8"))}
# (후보 번호, 앞에서 잘라 낼 초) — 받아쓴 글이 「.」뿐인 첫 대목은 잘라 낸다
PLAN = [(int(a.split(":")[0]), float(a.split(":")[1])) for a in sys.argv[1:]]
if not PLAN:
    sys.exit("쓰는 법: python build-samples.py <후보 번호>:<자를 초> ...")

by_sha = {}
for f in inbox.iterdir():
    if f.is_file():
        by_sha[hashlib.sha256(f.read_bytes()).hexdigest()[:12]] = f

def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,bit_rate:format_tags:stream=sample_rate,channels,codec_name:stream_tags",
                        "-of", "json", str(p)], capture_output=True, text=True, encoding="utf-8")
    j = json.loads(r.stdout or "{}")
    fmt = j.get("format", {}); st = (j.get("streams") or [{}])[0]
    return dict(초=round(float(fmt.get("duration", 0)), 1), kbps=round(int(fmt.get("bit_rate", 0)) / 1000),
                Hz=st.get("sample_rate"), 채널=st.get("channels"), 꼬리표=len(fmt.get("tags") or {}) + len(st.get("tags") or {}))

index = []
for i, (n, cut) in enumerate(PLAN, 1):
    sha = picks[n]["orig"].split("rec-")[1][:12]
    src = by_sha.get(sha)
    if not src:
        print("원본을 찾지 못함"); sys.exit(1)
    dst = out / f"sample-{i:02d}.mp3"
    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", str(cut), "-i", str(src), "-map", "0:a:0", "-c", "copy",
           "-map_metadata", "-1", "-map_chapters", "-1", "-fflags", "+bitexact", "-write_xing", "0", "-id3v2_version", "0", str(dst)]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        print("ffmpeg 실패", r.returncode, len(r.stderr)); sys.exit(1)
    b = dst.read_bytes()
    a, z = probe(src), probe(dst)
    index.append({"file": dst.name, "callId": picks[n]["callId"], "cand": n, "cut": cut})
    print(json.dumps({"파일": dst.name, "원본": a, "예시": z, "자른초": cut, "KB": round(len(b) / 1024),
                      "ID3머리": b[:3] == b"ID3", "ID3꼬리": b[-128:-125] == b"TAG"}, ensure_ascii=False))
(work / "samples.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

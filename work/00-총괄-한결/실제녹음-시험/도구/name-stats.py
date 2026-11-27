# 녹음 파일 이름에서 무엇을 얻을 수 있는지 개수로만 본다.
# 통신사 녹취 서비스가 붙이는 이름 「<받은 내선 끝 4자리>-<건 사람 번호>_<날짜시각 14자리>_<꼬리>」 을 읽어
#   (1) 통화 시각 · 내선 · 건 사람 번호의 종류와 되풀이를 세고
#   (2) 시험 서버의 카드와 이어서, 같은 번호에서 AI 가 적은 거래처 이름이 같았는지 센다.
# 전화번호 · 거래처 이름 · 파일 이름 · 받아쓴 글은 출력하지 않는다. 개수만 낸다.
#
# 쓰는 법:
#   ACHA_INBOX_DIR=<원본 녹음 폴더>  python name-stats.py [시험 폴더 A] [시험 폴더 B]
#   시험 폴더를 주지 않으면 파일 이름만 센다. 시험 폴더는 compare-models.mjs 와 같은 꼴(workspace-id.txt · data/).
#   이름 규칙이 다르면 ACHA_NAME_RULE 에 정규식(무리 4개: 내선 · 번호 · 날짜시각 · 꼬리)을 준다.
import hashlib
import os
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
INBOX = Path(os.environ["ACHA_INBOX_DIR"])
RULE = re.compile(os.environ.get("ACHA_NAME_RULE") or r"^(\d{4})-(\d+)_(\d{14})_([A-Za-z]+)$")
HOMES = [Path(p) for p in sys.argv[1:3]]


def kind(num: str) -> str:
    if re.fullmatch(r"01[016789]\d{7,8}", num):
        return "휴대폰"
    if re.fullmatch(r"070\d{7,8}", num):
        return "인터넷 전화(070)"
    if re.fullmatch(r"1[5-8]\d{6}", num):
        return "대표 번호(15xx 따위)"
    if re.fullmatch(r"0(2|[3-6]\d)\d{7,8}", num):
        return "유선(지역 번호)"
    if len(num) <= 4:
        return "네 자리 이하(내선끼리로 보임)"
    return "그 밖"


rows = []
bad = 0
for f in sorted(INBOX.iterdir()):
    if not f.is_file():
        continue
    m = RULE.match(f.stem)
    if not m:
        bad += 1
        continue
    ext, num, ts, tail = m.groups()
    try:
        when = datetime.strptime(ts, "%Y%m%d%H%M%S")
    except ValueError:
        bad += 1
        continue
    sha = hashlib.sha256(f.read_bytes()).hexdigest()
    rows.append({"ext": ext, "num": num, "when": when, "tail": tail.lower(), "sha12": sha[:12]})

print(f"파일 {len(rows) + bad} · 규칙에 맞고 날짜시각이 읽힌 것 {len(rows)} · 안 맞는 것 {bad}")
if not rows:
    sys.exit(0)
days = sorted({r["when"].date() for r in rows})
print(f"통화한 날 {len(days)}일")
print("시간대별 통화 수:", dict(sorted(Counter(r["when"].hour for r in rows).items())))
print("내선 가짓수:", len({r["ext"] for r in rows}), "· 내선별 통화 수:", sorted(Counter(r["ext"] for r in rows).values(), reverse=True))
print("꼬리말:", dict(Counter(r["tail"] for r in rows)))
print("건 사람 번호의 종류:", dict(Counter(kind(r["num"]) for r in rows)))

by_num = defaultdict(list)
for r in rows:
    by_num[r["num"]].append(r)
counts = sorted((len(v) for v in by_num.values()), reverse=True)
repeat = [c for c in counts if c >= 2]
print(f"서로 다른 번호 {len(counts)} · 한 번만 건 번호 {counts.count(1)} · 두 번 이상 건 번호 {len(repeat)}(그 통화 {sum(repeat)}건)")
print("많이 건 순서로 통화 수(번호는 안 보임):", counts[:10])

norm = lambda s: re.sub(r"[\s.,()\-·]", "", s or "").lower()  # noqa: E731
for label, home in zip("AB", HOMES):
    ws = (home / "workspace-id.txt").read_text(encoding="utf-8").split()[0]
    db = home / "data" / "workspaces" / ws / "callnote.sqlite"
    con = sqlite3.connect(f"file:{db.as_posix()}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    calls = {}
    for c in con.execute("SELECT c.original_name, c.recorded_at, c.transcript, k.customer, k.ai_model FROM calls c JOIN cards k ON k.call_id = c.id"):
        m = re.match(r"rec-([0-9a-f]{12})", c["original_name"] or "")  # 보내는 프로그램이 rec-<sha256 앞 12자> 로 바꿔 보낸다
        if m:
            calls[m.group(1)] = c
    joined = [(r, calls[r["sha12"]]) for r in rows if r["sha12"] in calls]
    print(f"\n[{label}] 파일과 이어진 통화 {len(joined)}")
    off = 0
    for r, c in joined:
        try:
            rec = datetime.fromisoformat(c["recorded_at"]).replace(tzinfo=None)
        except Exception:
            off += 1
            continue
        if abs((rec - r["when"]).total_seconds()) > 3600:
            off += 1
    print(f" 서버에 적힌 통화 시각이 파일 이름의 시각과 1시간 넘게 다른 통화: {off}/{len(joined)}")
    short = [r for r, c in joined if len(re.sub(r"[\s.,!?~·]", "", c["transcript"] or "")) < 20]
    print(" 말이 거의 없는 통화의 번호 종류:", dict(Counter(kind(r["num"]) for r in short)))
    names = defaultdict(list)
    filled = 0
    for r, c in joined:
        if c["ai_model"] and (c["customer"] or "").strip():
            filled += 1
            names[r["num"]].append(norm(c["customer"]))
    print(f" AI 가 거래처를 채운 통화 {filled}")
    multi = {n: v for n, v in names.items() if len(v) >= 2}
    same = sum(1 for v in multi.values() if len(set(v)) == 1)
    loose = sum(1 for v in multi.values() if len(set(v)) > 1 and any(a != b and (a in b or b in a) for a in set(v) for b in set(v)))
    print(f" 같은 번호에서 거래처가 두 번 이상 채워진 번호 {len(multi)} · 이름이 모두 같은 번호 {same} · 한쪽이 다른 쪽을 품는 번호 {loose} · 서로 다른 이름이 섞인 번호 {len(multi) - same - loose}")
    covered = sum(len(by_num[n]) for n in names)
    print(f" AI 가 한 번이라도 거래처를 적은 번호들의 통화를 모두 합치면 {covered}건(이름이 맞는지는 모름)")
    con.close()

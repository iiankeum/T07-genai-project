# 「상호 · 사람 이름 · 번호 · 주소가 안 나오는 통화」를 자동으로 고른다.
# 출력은 개수 · 길이 · 예/아니오만. 받아쓴 글 · 카드 값 · 원래 파일 이름은 출력하지 않는다.
#   ACHA_PC_AGENT_DIR=<아차 코드>/src/pc-agent  python pick-samples.py [뽑을 개수=8]
# PC 안 모델(Ollama qwen3:4b · 127.0.0.1)이 켜져 있어야 한다.
import json
import os
import re
import sqlite3
import sys
import urllib.request
from pathlib import Path

PC_AGENT = Path(os.environ["ACHA_PC_AGENT_DIR"])   # 아차 코드의 src/pc-agent — 팀의 가림 코드(masking.py)를 쓴다
sys.path.insert(0, str(PC_AGENT))
import masking as mk  # noqa: E402

REAL = Path(os.environ.get("ACHA_REAL_HOME") or Path.home() / ".t07-real")          # 실제 녹음을 두는 비밀 폴더
home = Path(os.environ.get("ACHA_TEST_HOME") or REAL / "acha-v16")                   # 시험 서버의 자료 폴더
work = Path(os.environ.get("ACHA_SAMPLE_DIR") or REAL / "samples" / "work")          # 고른 목록 · 만든 파일(저장소 밖)
ws = (home / "workspace-id.txt").read_text(encoding="utf-8").strip()
dbfile = home / "data" / "workspaces" / ws / "callnote.sqlite"
db = sqlite3.connect(f"file:{dbfile.as_posix()}?mode=ro", uri=True)
out_dir = work
want = int(sys.argv[1]) if len(sys.argv) > 1 else 8


def J(s, default):
    try:
        v = json.loads(s)
        return default if v is None else v
    except Exception:
        return default


def norm(s):
    return re.sub(r"[\s.,!?~·\"'“”‘’()\-]", "", str(s or "")).lower()


def filled(v):
    return v is not None and str(v).strip() != ""


# 상호에 자주 붙는 말(팀 가림 코드가 목록 없이는 못 잡는 것까지 넓게) — 개수만 센다
BIZ_RX = re.compile(r"[가-힣A-Za-z0-9]{2,8}\s?(?:대리점|지점|영업소|주식회사|상사|상회|모비스|파츠|렌트카|렌터카|캐피탈|화재|보험|물류|운수|산업|상운|통운)")

SCREEN_PROMPT = """다음은 전화 통화를 받아쓴 글이다. 글 안에 실제로 나온 표현 가운데 아래에 해당하는 것을 글자 그대로 뽑아라.
- 상호: 가게 · 회사 · 정비소 · 대리점 · 택배사 이름. 자동차 제조사 · 차종 · 부품 이름은 상호가 아니다.
- 사람: 사람 이름, 또는 성과 직함(김 사장, 박대리). 성 없이 「사장님」만 있으면 뽑지 않는다.
- 번호: 전화번호 · 차량번호 · 계좌번호. 부품 번호 · 수량 · 값은 뽑지 않는다.
- 주소: 동네 · 도로 · 도시 · 지역 이름.
없으면 빈 목록으로 둔다. JSON 으로만 답하라: {"상호":[],"사람":[],"번호":[],"주소":[]}"""


# 모델이 「상호」로 뽑아도 통화한 사람을 가리키지 않는 말
CARRIER = "경동 대신 로젠 한진 대한통운 통운 롯데 우체국 천일 건영 합동 일양 택배 화물 퀵 용달 다마스 오토바이 고속버스 버스 터미널 정기화물".split()
MAKER = ("현대 기아 모비스 쌍용 케이지 르노 삼성 쉐보레 지엠 대우 벤츠 비엠 아우디 폭스바겐 토요타 렉서스 혼다 닛산 볼보 제네시스 테슬라 "
         "만도 보쉬 한온 순정 정품 재생 중고 애프터 비품 대리점 본사 센터 공장 부품 카센터 공업사 정비소 우리 저희 거래처").split()
TITLE_ONLY = re.compile(r"^(?:사장|부장|과장|실장|대리|팀장|주임|기사|공장장|대표|이사|차장|소장|반장|점장|매니저|형|형님|사모|여사|손님|고객|선생|언니|삼촌|아저씨|아줌마|직원|담당|담당자)(?:님)?$")
PHONE_SHAPE = re.compile(r"^(?:0\d{8,10}|1[5-9]\d{6})$")
PLATE_SHAPE = re.compile(r"^\d{2,3}[가-힣]\d{4}$")
CACHE = out_dir / "screen-cache.json"   # 모델이 뽑은 말(이 PC 안에만 둔다)


def generic_biz(v):
    n = norm(v)
    for w in sorted(CARRIER + MAKER, key=len, reverse=True):
        n = n.replace(w, "")
    return len(n) < 2          # 택배사 · 제조사 같은 말을 빼고 남는 게 없으면 상호가 아님


def classify(ans, text):
    tx = norm(text)
    out = {"상호": [], "사람": [], "번호": [], "주소": []}
    for kind in out:
        vals = ans.get(kind) if isinstance(ans, dict) else None
        for v in (vals if isinstance(vals, list) else []):
            if not isinstance(v, str) or len(norm(v)) < 2 or norm(v) not in tx:
                continue                       # 글에 없는 말(지어낸 것)은 버림
            n = norm(v)
            if kind == "상호" and generic_biz(v):
                continue
            if kind == "사람" and TITLE_ONLY.match(n):
                continue
            if kind == "번호":
                d = re.sub(r"\D", "", n)
                if not (PHONE_SHAPE.match(d) or PLATE_SHAPE.match(n)):
                    continue                   # 부품 번호 · 수량 · 값
            out[kind].append(v)
    return out


def llm_screen(cid, text, cache):
    if str(cid) not in cache:
        body = json.dumps({
            "model": "qwen3:4b", "stream": False, "think": False, "format": "json",
            "options": {"temperature": 0, "num_predict": 500},
            "messages": [{"role": "system", "content": SCREEN_PROMPT}, {"role": "user", "content": text[:4000]}],
        }).encode("utf-8")
        req = urllib.request.Request("http://127.0.0.1:11434/api/chat", data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=180) as r:
            cache[str(cid)] = J(json.loads(r.read().decode("utf-8")).get("message", {}).get("content", ""), {})
    return classify(cache[str(cid)], text)


rows = db.execute("""SELECT c.id, c.duration_sec, c.original_name, c.transcript, c.segments, c.caller_number,
  k.call_type, k.items, k.unsure, k.customer, k.contact, k.car_model, k.plate, k.customer_by_phone
  FROM calls c JOIN cards k ON k.call_id = c.id WHERE k.ai_model IS NOT NULL""").fetchall()

masker = mk.Masker()
stage = {"전체": len(rows), "품질 기준 통과": 0, "카드에 이름 · 번호 없음": 0, "팀 가림 코드가 찾은 것 0": 0, "넓은 상호 꼴 0": 0}
pool = []
for (cid, dur, orig, tx_raw, seg_raw, caller, ctype, items_raw, unsure_raw, cust, contact, car, plate, cbp) in rows:
    text = str(tx_raw or "").strip()
    tx = norm(text)
    chars = len(text)
    dur = dur or 0
    per_min = chars * 60 / dur if dur > 0 else 0
    items = J(items_raw, [])
    grounded = sum(1 for it in items if isinstance(it, dict) and norm(it.get("part")) and norm(it.get("part")) in tx
                   and (not norm(it.get("quote")) or norm(it.get("quote")) in tx))
    qty = sum(1 for it in items if isinstance(it, dict) and filled(it.get("qty")))
    warns = len(J(unsure_raw, []))
    if not (ctype == "주문" and 30 <= dur <= 240 and chars >= 120 and 130 <= per_min <= 360
            and 1 <= len(items) <= 5 and grounded == len(items)):
        continue
    stage["품질 기준 통과"] += 1
    # customer_by_phone 은 0/1 표시 칸이라 0 이 아닐 때만 본다
    if filled(cust) or filled(contact) or filled(plate) or (cbp not in (None, 0, "0", "")) or filled(caller):
        continue
    stage["카드에 이름 · 번호 없음"] += 1
    lines = [str(s.get("text") or "") for s in J(seg_raw, []) if isinstance(s, dict)] or [text]
    table = mk.AliasTable()
    masked = masker.mask_lines(lines, table)
    problems = mk.find_leaks("\n".join(masked), table, masker)
    if table.entries or problems:
        continue
    stage["팀 가림 코드가 찾은 것 0"] += 1
    if BIZ_RX.search(text):
        continue
    stage["넓은 상호 꼴 0"] += 1
    score = (2 if filled(car) else 0) + min(qty, 2) + min(len(items), 3) - min(warns, 4) * 0.5
    pool.append(dict(id=cid, orig=orig, dur=round(dur), chars=chars, items=len(items), qty=qty, car=filled(car), warns=warns,
                     score=score, text=text, first2=norm(" ".join(lines[:2]))))

for k, v in stage.items():
    print(f"{k}: {v}")

# PC 안 모델에게 한 번 더 묻는다(상호 · 사람 · 번호 · 주소). 개수만 본다.
out_dir.mkdir(parents=True, exist_ok=True)
cache = J(CACHE.read_text(encoding="utf-8"), {}) if CACHE.exists() else {}
clean = []
flag = {"상호": 0, "사람": 0, "번호": 0, "주소": 0}
biz_calls = {}       # 상호로 걸린 말 → 나온 통화 수
biz_first = 0        # 그 말이 통화 첫 두 대목에 있는 통화 수
for p in sorted(pool, key=lambda x: (-x["score"], x["dur"])):
    c = llm_screen(p["id"], p["text"], cache)
    for k in flag:
        flag[k] += 1 if c[k] else 0
    for v in set(norm(x) for x in c["상호"]):
        biz_calls[v] = biz_calls.get(v, 0) + 1
    if any(norm(x) in p["first2"] for x in c["상호"]):
        biz_first += 1
    if not any(c.values()):
        clean.append(p)
CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
top = sorted(biz_calls.values(), reverse=True)[:5]
print(f"PC 안 모델 검사: 대상 {len(pool)} · 깨끗함 {len(clean)} · 걸린 통화 수(상호 {flag['상호']} · 사람 {flag['사람']} · 번호 {flag['번호']} · 주소 {flag['주소']})")
print(f"상호로 걸린 말: 서로 다른 말 {len(biz_calls)}개 · 가장 자주 나온 말들이 나온 통화 수 {top} · 통화 첫머리에 있는 통화 {biz_first}")

# 길이가 한쪽에 몰리지 않게 1분 미만 · 1~2분 · 2~3분에서 번갈아 뽑는다
band = lambda s: 0 if s < 60 else 1 if s < 120 else 2
pools = [[x for x in clean if band(x["dur"]) == b] for b in range(3)]
picked = []
while len(picked) < want and any(pools):
    for p in pools:
        if p and len(picked) < want:
            picked.append(p.pop(0))

out_dir.mkdir(parents=True, exist_ok=True)
(out_dir / "pick.json").write_text(json.dumps(
    [{"n": i + 1, "callId": p["id"], "orig": p["orig"]} for i, p in enumerate(picked)], ensure_ascii=False, indent=2), encoding="utf-8")
for i, p in enumerate(picked):
    print(json.dumps({"n": i + 1, "길이초": p["dur"], "글자수": p["chars"], "품목": p["items"], "수량있는품목": p["qty"],
                      "차종칸": "참" if p["car"] else "빔", "경고": p["warns"]}, ensure_ascii=False))
print(f"고른 후보 {len(picked)}개 · 목록은 PC 안 {out_dir.name} 폴더에 저장")

"""가짜 통화 음성을 데모 서버의 녹음 넣기 API(POST /api/ingest)로 보낸다.

녹음 PC 프로그램이 하는 일을 흉내 낸다 → 서버가 받아쓰기 일꾼에게 넘기고 → 카드가 만들어진다.
녹음 시각은 calls.json 의 days_ago · time 을 **오늘(한국 시간) 기준**으로 옮겨 붙인다.

    set INGEST_TOKEN=...            (값은 저장소 · 채팅에 쓰지 않는다)
    python send_ingest.py --only c02                      # 한 건 시험
    python send_ingest.py --all                           # 54건 전부(빈도 제한을 지키며 천천히)
    python send_ingest.py --only c02 --dry-run            # 보낼 내용만 출력
    python send_ingest.py --all --export ~/.t07-demo-audio/ingest
        # 보내지 않고, 녹음 폴더 감시 프로그램(tools/folder-sender.mjs)이 먹는 모양으로 복사만 한다:
        # fx-cNN_01000000101.wav (밑줄 뒤 = 걸려 온 번호), 파일 수정 시각 = 오늘 기준 통화 시각

토큰은 환경변수 INGEST_TOKEN, 또는 --token-file(기본 ~/.t07-secrets/ingest.env)의 `INGEST_TOKEN=...` 줄에서 읽는다.
그 파일에 `SERVER_URL=...` 이 있으면 --url 을 주지 않았을 때 그 주소로 보낸다.
"""
import argparse
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).parent
KST = timezone(timedelta(hours=9))
DEFAULT_URL = "https://t07.3-39-67-126.sslip.io"


def read_env(token_file: str | None) -> dict:
    env = {}
    path = Path(token_file) if token_file else Path.home() / ".t07-secrets" / "ingest.env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    if os.environ.get("INGEST_TOKEN"):
        env["INGEST_TOKEN"] = os.environ["INGEST_TOKEN"].strip()
    return env


def multipart(fields: dict, file_field: str, path: Path) -> tuple[bytes, str]:
    b = uuid.uuid4().hex
    out = []
    for k, v in fields.items():
        out.append(f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    out.append(f"--{b}\r\nContent-Disposition: form-data; name=\"{file_field}\"; filename=\"{path.name}\"\r\n"
               f"Content-Type: {ctype}\r\n\r\n".encode())
    out.append(path.read_bytes())
    out.append(f"\r\n--{b}--\r\n".encode())
    return b"".join(out), f"multipart/form-data; boundary={b}"


def recorded_at(call: dict, today) -> str:
    h, m = map(int, call["time"].split(":"))
    d = today - timedelta(days=call["days_ago"])
    return datetime(d.year, d.month, d.day, h, m, tzinfo=KST).isoformat()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="")
    ap.add_argument("--audio", default=str(Path.home() / ".t07-demo-audio"), help="make_audio.py 의 --out")
    ap.add_argument("--kind", default="phone", choices=["phone", "noisy", "web", "clean"])
    ap.add_argument("--only", default="")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--token-file")
    ap.add_argument("--gap", type=float, default=2.0, help="보내기 사이 쉬는 초(빈도 제한)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--export", default="", help="보내지 않고 이 폴더에 fx-cNN_번호.wav 로 복사")
    args = ap.parse_args()
    if not args.only and not args.all:
        raise SystemExit("--only c02,c03 또는 --all 을 주세요.")

    calls = json.loads((HERE / "calls.json").read_text(encoding="utf-8"))["calls"]
    if args.only:
        keep = set(args.only.split(","))
        calls = [c for c in calls if c["id"] in keep]
    today = datetime.now(KST).date()
    ext = "mp3" if args.kind == "web" else "wav"
    if args.export:
        dest = Path(args.export).expanduser()
        dest.mkdir(parents=True, exist_ok=True)
        for c in calls:
            src = Path(args.audio) / args.kind / f"{c['id']}.{ext}"
            if not src.exists():
                print(f"{c['id']}: 파일 없음 {src}")
                continue
            out = dest / f"fx-{c['id']}_{c['phone'].replace('-', '')}.{ext}"
            out.write_bytes(src.read_bytes())
            t = datetime.fromisoformat(recorded_at(c, today)).timestamp()
            os.utime(out, (t, t))
        print(f"{len(calls)}건 → {dest}")
        return
    env = read_env(args.token_file)
    url = args.url or env.get("SERVER_URL") or DEFAULT_URL
    token = env.get("INGEST_TOKEN")
    if not token and not args.dry_run:
        raise SystemExit("INGEST_TOKEN 이 없습니다(환경변수 또는 --token-file).")

    for c in calls:
        path = Path(args.audio) / args.kind / f"{c['id']}.{ext}"
        if not path.exists():
            print(f"{c['id']}: 파일 없음 {path}")
            continue
        fields = {
            "recordedAt": recorded_at(c, today),
            "deviceName": "fake-demo-data",
            "callerNumber": c["phone"],
            "title": f"[가짜] {c['customer'] or '모르는 번호'} · {c['id']}",
            "fake": "true",
        }
        if args.dry_run:
            print(c["id"], path.name, fields)
            continue
        body, ctype = multipart(fields, "file", path)
        req = urllib.request.Request(f"{url.rstrip('/')}/api/ingest", data=body, method="POST",
                                     headers={"Authorization": f"Bearer {token}", "Content-Type": ctype})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    print(c["id"], r.status, r.read().decode("utf-8", "replace")[:200], flush=True)
                break
            except urllib.error.HTTPError as e:
                msg = e.read().decode("utf-8", "replace")[:200]
                if e.code == 429 and attempt < 3:
                    time.sleep(20 * (attempt + 1))
                    continue
                print(c["id"], e.code, msg, flush=True)
                break
        time.sleep(args.gap)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

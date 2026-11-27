#!/usr/bin/env python3
"""콜노트(가칭) T07 데모 — dev 가지 자동 배포.

진짜 파일은 서버의 /usr/local/lib/callnote-deploy/deploy.py (root 소유, 배포 사용자가 못 고침)이고,
저장소의 ops/server/deploy.py 는 기록용 사본이다. 저장소에 푸시한 코드가 배포 장치를 바꾸지 못하게 하려는 것.

흐름: 1분마다(systemd timer) origin/dev 끝 커밋을 보고 → 새 커밋이면 받아서 releases/<sha> 에 풀고
→ (lock 파일이 있으면) npm ci --omit=dev --ignore-scripts → current 를 새 버전으로 바꾸고 앱 재시작
→ 30초 안에 /healthz 200 이 안 나오면 앞 버전으로 되돌린다. 결과는 public/status.json 으로 공개한다.

수동 실행(서버에서):
  sudo systemctl start callnote-deploy.service                      # 지금 한 번 확인
  sudo -u callnote-deploy HOME=/var/lib/callnote-deploy/home \
       python3 -I /usr/local/lib/callnote-deploy/deploy.py --force   # 같은 커밋이라도 다시 배포
  ... --ref <커밋>   # 서버 안 저장소의 특정 커밋을 배포(되돌리기 시험용, 원격 확인 안 함)
"""
import argparse
import datetime as dt
import fcntl
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request

REPO_URL = "https://github.com/iiankeum/T07-genai-project.git"
BRANCH = "dev"
BASE = "/srv/callnote"
REPO = f"{BASE}/repo.git"
RELEASES = f"{BASE}/releases"
CURRENT = f"{BASE}/current"
STATE_DIR = "/var/lib/callnote-deploy"
PUBLIC = f"{STATE_DIR}/public"
STATE_FILE = f"{STATE_DIR}/state.json"
STATUS_FILE = f"{PUBLIC}/status.json"
LOCK_FILE = f"{STATE_DIR}/deploy.lock"
HEALTH_URL = "http://127.0.0.1:5600/healthz"
HEALTH_TIMEOUT = 30
KEEP_RELEASES = 5
PUBLIC_URL = "https://t07.3-39-67-126.sslip.io"
SUDO = ["/usr/bin/sudo", "-n"]
RESTART = SUDO + ["/usr/bin/systemctl", "restart", "callnote-app.service"]
APPLOG = SUDO + ["/usr/local/lib/callnote-deploy/applog.sh"]

LOG: list[str] = []

SECRET_PATTERNS = [
    re.compile(r"sk-ant-[A-Za-z0-9_\-]+"),
    re.compile(r"\bA(KIA|SIA)[0-9A-Z]{16}\b"),
    re.compile(r"\b[0-9a-fA-F]{32,}\b"),
    re.compile(r"(?i)(token|secret|password|passcode|api[_-]?key)(\s*[=:]\s*)\S+"),
]


def redact(line: str) -> str:
    for pat in SECRET_PATTERNS:
        if pat.groups >= 2:
            line = pat.sub(lambda m: m.group(1) + m.group(2) + "[가림]", line)
        else:
            line = pat.sub("[가림]", line)
    return line


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).astimezone(dt.timezone(dt.timedelta(hours=9))).isoformat(timespec="seconds")


def log(msg: str) -> None:
    for part in str(msg).splitlines() or [""]:
        line = f"{dt.datetime.now().strftime('%H:%M:%S')} {redact(part)}"
        LOG.append(line)
        print(line, flush=True)


def run(cmd, *, cwd=None, timeout=120, input_bytes=None, quiet=False, check=True):
    p = subprocess.run(cmd, cwd=cwd, timeout=timeout, input=input_bytes,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    out = p.stdout.decode("utf-8", "replace")
    if not quiet and out.strip():
        for line in out.strip().splitlines()[-40:]:
            log("  | " + line)
    if check and p.returncode != 0:
        raise RuntimeError(f"명령 실패({p.returncode}): {' '.join(cmd[:3])} …")
    return out


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json_atomic(path, data):
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)


def remote_head() -> str:
    out = run(["git", "ls-remote", REPO_URL, f"refs/heads/{BRANCH}"], timeout=40, quiet=True)
    sha = out.split()[0] if out.strip() else ""
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise RuntimeError("원격 dev 가지를 읽지 못했다")
    return sha


def ensure_repo():
    if not os.path.isdir(REPO):
        run(["git", "init", "--bare", "-q", REPO])


def fetch():
    ensure_repo()
    run(["git", "-C", REPO, "fetch", "-q", "--depth", "50", REPO_URL,
         f"+refs/heads/{BRANCH}:refs/heads/{BRANCH}"], timeout=180)


def commit_info(sha: str) -> dict:
    out = run(["git", "-C", REPO, "log", "-1", "--format=%H%x00%h%x00%s%x00%an%x00%cI", sha], quiet=True)
    full, short, subject, author, committed = (out.strip().split("\x00") + [""] * 5)[:5]
    return {"commit": full, "short": short, "message": subject[:200], "author": author[:80], "committedAt": committed}


def current_target():
    try:
        return os.path.realpath(CURRENT) if os.path.islink(CURRENT) else None
    except OSError:
        return None


def point_current(target):
    if target is None:
        if os.path.islink(CURRENT):
            os.unlink(CURRENT)
        return
    tmp = f"{CURRENT}.tmp"
    if os.path.lexists(tmp):
        os.unlink(tmp)
    os.symlink(target, tmp)
    os.replace(tmp, CURRENT)


def health_ok(timeout=HEALTH_TIMEOUT) -> bool:
    deadline = time.time() + timeout
    last = ""
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(HEALTH_URL, timeout=3) as r:
                if r.status == 200:
                    log(f"헬스체크 200 ({HEALTH_TIMEOUT - int(deadline - time.time())}초)")
                    return True
                last = f"HTTP {r.status}"
        except Exception as e:  # noqa: BLE001
            last = type(e).__name__ + ": " + str(e)[:120]
        time.sleep(1)
    log(f"헬스체크 실패: {last}")
    return False


def restart_app():
    run(RESTART, timeout=90)


def app_log() -> list[str]:
    try:
        out = run(APPLOG, timeout=30, quiet=True, check=False)
        return [redact(l) for l in out.splitlines()[-60:]]
    except Exception as e:  # noqa: BLE001
        return [f"(앱 로그를 읽지 못함: {type(e).__name__})"]


def build_release(sha: str) -> tuple[str, bool]:
    # 같은 커밋을 다시 배포해도 지금 돌고 있는 폴더를 지우지 않게, 폴더 이름에 시각을 붙인다.
    rel = os.path.join(RELEASES, f"{sha[:12]}-{time.strftime('%Y%m%d%H%M%S')}")
    os.makedirs(rel)
    archive = subprocess.run(["git", "-C", REPO, "archive", "--format=tar", sha],
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120)
    if archive.returncode != 0:
        raise RuntimeError("git archive 실패: " + archive.stderr.decode("utf-8", "replace")[:300])
    run(["tar", "-x", "-C", rel], input_bytes=archive.stdout, timeout=120)
    with open(os.path.join(rel, "REVISION"), "w", encoding="utf-8") as f:
        f.write(sha + "\n")
    app_dir = os.path.join(rel, "src", "app")
    has_app = os.path.isfile(os.path.join(app_dir, "server.mjs"))
    if has_app:
        lock = os.path.join(app_dir, "package-lock.json")
        pkg = os.path.join(app_dir, "package.json")
        npm_env_cmd = ["nice", "-n", "10", "npm"]
        common = ["--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=warn"]
        if os.path.isfile(lock):
            log("npm ci 시작 (--omit=dev --ignore-scripts)")
            run(npm_env_cmd + ["ci"] + common, cwd=app_dir, timeout=420)
        elif os.path.isfile(pkg):
            deps = load_json(pkg, {}).get("dependencies") or {}
            if deps:
                log("경고: package-lock.json 이 없어 npm install 로 대신한다(lock 파일을 커밋해 주세요)")
                run(npm_env_cmd + ["install"] + common, cwd=app_dir, timeout=420)
    else:
        log("src/app/server.mjs 가 아직 없다 → 「준비 중」 안내 페이지로 띄운다")
    return rel, has_app


def prune(keep_paths):
    try:
        rels = sorted((os.path.join(RELEASES, d) for d in os.listdir(RELEASES)),
                      key=os.path.getmtime, reverse=True)
    except FileNotFoundError:
        return
    keep = set(rels[:KEEP_RELEASES]) | {os.path.realpath(p) for p in keep_paths if p}
    for r in rels:
        if os.path.realpath(r) not in keep:
            shutil.rmtree(r, ignore_errors=True)


def publish(state, last=None):
    status = {
        "service": "콜노트(가칭) T07 데모",
        "url": PUBLIC_URL,
        "branch": BRANCH,
        "repo": "iiankeum/T07-genai-project",
        "lastCheckedAt": state.get("lastCheckedAt"),
        "live": state.get("live"),
        "last": state.get("lastRun"),
        "history": state.get("history", [])[:15],
        "note": "dev 가지에 푸시하면 1분 안팎에 배포된다. 30초 안에 /healthz 200 이 안 나오면 앞 버전으로 되돌린다.",
    }
    write_json_atomic(STATUS_FILE, status)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--ref", help="서버 안 저장소의 커밋을 배포(원격 확인 안 함 · 시험용)")
    args = ap.parse_args()

    os.makedirs(PUBLIC, exist_ok=True)
    os.makedirs(RELEASES, exist_ok=True)
    lock = open(LOCK_FILE, "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("다른 배포가 진행 중", flush=True)
        return 0

    state = load_json(STATE_FILE, {"history": []})
    state["lastCheckedAt"] = now_iso()

    try:
        if args.ref:
            ensure_repo()
            sha = run(["git", "-C", REPO, "rev-parse", "--verify", args.ref + "^{commit}"], quiet=True).strip()
        else:
            sha = remote_head()
            if sha == state.get("lastAttempted") and not args.force:
                write_json_atomic(STATE_FILE, state)
                publish(state)
                return 0
            fetch()
    except Exception as e:  # noqa: BLE001
        log(f"원격 확인 실패: {e}")
        state["lastCheckError"] = {"at": now_iso(), "error": str(e)[:200]}
        write_json_atomic(STATE_FILE, state)
        publish(state)
        return 1

    started = time.time()
    info = commit_info(sha)
    log(f"배포 시작: {info['short']} {info['message']}")
    state["lastAttempted"] = sha
    prev = current_target()
    result = "failed"
    applog = []
    has_app = False
    try:
        rel, has_app = build_release(sha)
        point_current(rel)
        restart_app()
        if health_ok():
            result = "success"
            state["live"] = {**info, "deployedAt": now_iso(), "hasApp": has_app}
            log("배포 성공")
        else:
            applog = app_log()
            raise RuntimeError("새 버전이 30초 안에 /healthz 200 을 주지 않았다")
    except Exception as e:  # noqa: BLE001
        log(f"배포 실패: {e}")
        if not applog:
            applog = app_log()
        if prev and os.path.isdir(prev) and prev != current_target():
            log(f"앞 버전으로 되돌린다: {os.path.basename(prev)}")
        elif prev and os.path.isdir(prev):
            log("앞 버전과 같은 폴더라 그대로 재시작한다")
        else:
            log("앞 버전이 없다 → 「준비 중」 안내 페이지로 되돌린다")
            prev = None
        try:
            point_current(prev)
            restart_app()
            result = "rolled_back" if health_ok() else "rollback_failed"
        except Exception as e2:  # noqa: BLE001
            log(f"되돌리기 실패: {e2}")
            result = "rollback_failed"
        log(f"결과: {result}")

    finished = time.time()
    state["lastRun"] = {
        **info,
        "result": result,
        "startedAt": dt.datetime.fromtimestamp(started, dt.timezone(dt.timedelta(hours=9))).isoformat(timespec="seconds"),
        "durationSec": round(finished - started, 1),
        "hasApp": has_app,
        "log": LOG[-60:],
        "appLog": applog,
    }
    hist = state.get("history", [])
    hist.insert(0, {"commit": info["short"], "message": info["message"][:80], "result": result, "at": now_iso()})
    state["history"] = hist[:30]
    write_json_atomic(STATE_FILE, state)
    publish(state)
    prune([CURRENT, prev])
    return 0 if result == "success" else 2


if __name__ == "__main__":
    sys.exit(main())

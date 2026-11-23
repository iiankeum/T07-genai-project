#!/bin/bash
# 콜노트(가칭) T07 데모 — 서버 설치기 (root 로, 여러 번 돌려도 같은 결과)
# 사용: sudo bash install.sh <이 폴더 경로> [ANTHROPIC 키 파일]
#   - 실서비스(nolmeok · /etc/nolmeok.env · /opt/nolmeok)는 건드리지 않는다.
#   - Caddyfile 에는 맨 끝에 import 한 줄만 더한다(백업 → validate → reload).
#   - 비밀값은 /etc/callnote/app.env (root 0600)에만 둔다. 이 스크립트는 값을 화면에 찍지 않는다.
set -euo pipefail
SRC=${1:?설치 파일 폴더}
KEYFILE=${2:-}
LIB=/usr/local/lib/callnote-deploy
ENVF=/etc/callnote/app.env
TS=$(date +%Y%m%d-%H%M%S)

echo "[1] 사용자"
id callnote >/dev/null 2>&1 || useradd --system --home-dir /var/lib/callnote --no-create-home --shell /usr/sbin/nologin callnote
id callnote-deploy >/dev/null 2>&1 || useradd --system --home-dir /var/lib/callnote-deploy/home --no-create-home --shell /usr/sbin/nologin callnote-deploy

echo "[2] 폴더"
install -d -o callnote -g callnote -m 0750 /var/lib/callnote
install -d -o callnote-deploy -g callnote-deploy -m 0755 /srv/callnote /srv/callnote/releases
install -d -o callnote-deploy -g callnote-deploy -m 0755 /var/lib/callnote-deploy /var/lib/callnote-deploy/public
install -d -o callnote-deploy -g callnote-deploy -m 0700 /var/lib/callnote-deploy/home
install -d -o root -g root -m 0755 "$LIB" /etc/callnote

echo "[3] 배포 장치 파일(root 소유 — 배포 사용자·앱이 못 고침)"
install -o root -g root -m 0755 "$SRC/deploy.py" "$LIB/deploy.py"
install -o root -g root -m 0755 "$SRC/run-app.sh" "$LIB/run-app.sh"
install -o root -g root -m 0755 "$SRC/applog.sh" "$LIB/applog.sh"
install -o root -g root -m 0644 "$SRC/placeholder.mjs" "$LIB/placeholder.mjs"
install -o root -g root -m 0644 "$SRC/placeholder.html" "$LIB/placeholder.html"
install -o callnote-deploy -g callnote-deploy -m 0644 "$SRC/placeholder.html" /var/lib/callnote-deploy/public/placeholder.html
# 윈도우에서 올리면 줄 끝에 CR 이 붙어 셸 스크립트가 안 돈다 → 떼어 낸다
sed -i 's/\r$//' "$LIB"/*.py "$LIB"/*.sh "$LIB"/*.mjs

echo "[4] 비밀값 파일 $ENVF"
if [ ! -f "$ENVF" ]; then
  umask 077
  {
    echo "# 콜노트 데모 앱 환경변수 — root 0600. 값은 여기에만 있다. 저장소·채팅에 내지 않는다."
    echo "PORT=5600"
    echo "HOST=127.0.0.1"
    echo "DATA_DIR=/var/lib/callnote"
    echo "PUBLIC_BASE_URL=https://t07.3-39-67-126.sslip.io"
    echo "ANTHROPIC_API_KEY="
    echo "WORKER_TOKEN=$(openssl rand -hex 24)"
    echo "INGEST_TOKEN=$(openssl rand -hex 24)"
    echo "ADMIN_PASSCODE=t07-$(openssl rand -hex 4)"
    echo "S3_BUCKET="
    echo "AWS_REGION=ap-northeast-2"
    echo "AWS_ACCESS_KEY_ID="
    echo "AWS_SECRET_ACCESS_KEY="
  } > "$ENVF"
  umask 022
fi
if [ -n "$KEYFILE" ] && [ -f "$KEYFILE" ]; then
  python3 -I - "$ENVF" "$KEYFILE" <<'PY'
import sys, re
envf, keyf = sys.argv[1], sys.argv[2]
key = None
for line in open(keyf, encoding="utf-8"):
    m = re.match(r"\s*ANTHROPIC_API_KEY\s*=\s*(\S+)", line)
    if m:
        key = m.group(1).strip().strip("\"'")
if not key or not key.startswith("sk-ant-"):
    sys.exit("키 파일 형식이 맞지 않음")
lines = open(envf, encoding="utf-8").read().splitlines()
out, done = [], False
for l in lines:
    if l.startswith("ANTHROPIC_API_KEY="):
        out.append("ANTHROPIC_API_KEY=" + key); done = True
    else:
        out.append(l)
if not done:
    out.append("ANTHROPIC_API_KEY=" + key)
open(envf, "w", encoding="utf-8").write("\n".join(out) + "\n")
print("ANTHROPIC_API_KEY 넣음(값은 출력 안 함)")
PY
  shred -u "$KEYFILE" 2>/dev/null || rm -f "$KEYFILE"
fi
chown root:root "$ENVF"; chmod 0600 "$ENVF"

echo "[5] sudoers"
install -o root -g root -m 0440 "$SRC/sudoers-callnote-deploy" /etc/sudoers.d/callnote-deploy.new
if visudo -cf /etc/sudoers.d/callnote-deploy.new >/dev/null; then
  mv /etc/sudoers.d/callnote-deploy.new /etc/sudoers.d/callnote-deploy
else
  rm -f /etc/sudoers.d/callnote-deploy.new; echo "sudoers 검사 실패"; exit 1
fi

echo "[6] systemd"
install -o root -g root -m 0644 "$SRC/systemd/callnote-app.service" /etc/systemd/system/callnote-app.service
install -o root -g root -m 0644 "$SRC/systemd/callnote-deploy.service" /etc/systemd/system/callnote-deploy.service
install -o root -g root -m 0644 "$SRC/systemd/callnote-deploy.timer" /etc/systemd/system/callnote-deploy.timer
systemctl daemon-reload
systemctl enable --now callnote-app.service
systemctl enable --now callnote-deploy.timer

echo "[7] Caddy (import 한 줄 추가 · 백업 → validate → reload)"
install -o root -g root -m 0644 "$SRC/t07.caddy" /etc/caddy/t07.caddy
cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak-$TS"
if ! grep -q '^import /etc/caddy/t07.caddy' /etc/caddy/Caddyfile; then
  printf '\n# T07 콜노트 데모(별도 파일) — %s 추가\nimport /etc/caddy/t07.caddy\n' "$TS" >> /etc/caddy/Caddyfile
fi
if caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/tmp/caddy-validate.log 2>&1; then
  systemctl reload caddy
  echo "caddy reload 완료"
else
  echo "caddy validate 실패 → 원래 파일로 되돌림"; tail -5 /tmp/caddy-validate.log
  cp -a "/etc/caddy/Caddyfile.bak-$TS" /etc/caddy/Caddyfile
  exit 1
fi
echo "설치 끝"

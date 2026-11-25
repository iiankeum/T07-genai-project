#!/bin/bash
# 배포 실패 때 앱 로그 마지막 60줄을 비밀값을 가린 채 보여 준다(root 로 실행 · 인자 없음).
# 서버 /usr/local/lib/callnote-deploy/applog.sh — sudoers 로 callnote-deploy 사용자만 부를 수 있다.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
journalctl -u callnote-app.service -n 60 --no-pager -o short-iso 2>/dev/null \
| /usr/bin/python3 -I -c '
import re, sys
vals = []
try:
    for line in open("/etc/callnote/app.env", encoding="utf-8"):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            v = line.split("=", 1)[1].strip().strip("\"'"'"'")
            if len(v) >= 6:
                vals.append(v)
except OSError:
    pass
vals.sort(key=len, reverse=True)
for line in sys.stdin:
    for v in vals:
        line = line.replace(v, "[가림]")
    line = re.sub(r"sk-ant-[A-Za-z0-9_\-]+", "[가림]", line)
    sys.stdout.write(line)
'

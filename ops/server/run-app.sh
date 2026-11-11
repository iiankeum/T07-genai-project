#!/bin/sh
# 콜노트 데모 앱 실행기 — 서버 /usr/local/lib/callnote-deploy/run-app.sh (저장소 사본은 기록용)
# src/app/server.mjs 가 있으면 그것을, 없으면 「준비 중」 안내 서버를 띄운다.
# 작업 폴더(cwd)는 저장소 뿌리(/srv/callnote/current). 진입점은 node src/app/server.mjs.
set -e
if [ -f /srv/callnote/current/src/app/server.mjs ]; then
  cd /srv/callnote/current
  exec /usr/bin/node src/app/server.mjs
fi
cd /usr/local/lib/callnote-deploy
exec /usr/bin/node placeholder.mjs

// 시험 자료가 어디 있는지를 한곳에서 정한다. 내 PC 의 경로와 작업공간 번호는 저장소에 적지 않는다.
//   ACHA_TEST_HOME  비공개 시험 서버의 자료 폴더. 기본값은 사용자 홈의 .t07-real/acha-v16
//   ACHA_WS_ID      작업공간 번호. 기본값은 시험 폴더의 workspace-id.txt 첫 줄
//   ACHA_APP_DIR    시험하는 아차 코드의 src/app 폴더(make-cards · grounding 에만 필요)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const home = process.env.ACHA_TEST_HOME || path.join(os.homedir(), '.t07-real', 'acha-v16');

function stop(message) {
  console.error(message);
  process.exit(1);
}

export function workspaceId() {
  let id = process.env.ACHA_WS_ID || '';
  if (!id) {
    try { id = fs.readFileSync(path.join(home, 'workspace-id.txt'), 'utf8').split(/\r?\n/)[0].trim(); } catch { /* 아래에서 멈춘다 */ }
  }
  if (!/^ws_[a-z0-9]+$/.test(id)) stop('작업공간 번호를 찾지 못했다. setup-account.mjs 를 먼저 돌리거나 ACHA_WS_ID 를 준다.');
  return id;
}

export const workspaceDir = () => path.join(home, 'data', 'workspaces', workspaceId());
export const dbFile = () => path.join(workspaceDir(), 'callnote.sqlite');

export function appDir() {
  const dir = process.env.ACHA_APP_DIR || '';
  if (!dir || !fs.existsSync(path.join(dir, 'lib', 'pipeline.mjs'))) stop('ACHA_APP_DIR 에 시험하는 아차 코드의 src/app 폴더를 준다.');
  return dir;
}

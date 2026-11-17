// 시스템: /healthz (배포 확인용) · /api/meta (화면이 처음에 읽는 상태)
import { config } from '../lib/config.mjs';
import { db, globalDb } from '../lib/db.mjs';
import { sendJson } from '../lib/http.mjs';
import { aiStatus } from '../lib/ai.mjs';
import { accountDb, mailAvailable } from '../lib/auth.mjs';

export function workerStatus() {
  const d = db();
  const w = d.prepare('SELECT name, engine, gpu, version, last_seen FROM workers ORDER BY last_seen DESC LIMIT 1').get();
  const waiting = d.prepare("SELECT COUNT(*) AS n FROM jobs WHERE state = 'queued'").get().n;
  const working = d.prepare("SELECT COUNT(*) AS n FROM jobs WHERE state = 'leased'").get().n;
  const online = Boolean(w && Date.now() - Date.parse(w.last_seen) < config.workerOnlineSec * 1000);
  return {
    online,
    lastSeen: w?.last_seen ?? null,
    worker: w?.name ?? null,
    engine: w?.engine ?? null,
    gpu: w?.gpu ?? null,
    queue: { waiting, working },
  };
}

export function register(router) {
  router.get('/healthz', ({ res }) => {
    let dbOk = false;
    try {
      dbOk = globalDb().prepare('SELECT 1 AS ok').get().ok === 1
        && accountDb().prepare('SELECT 1 AS ok').get().ok === 1;
    } catch { dbOk = false; }
    sendJson(res, dbOk ? 200 : 503, {
      ok: dbOk,
      commit: config.commit,
      startedAt: config.startedAt,
      uptimeSec: Math.round(process.uptime()),
      memMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    });
  });

  router.get('/api/meta', ({ access }) => ({
    product: '아맞다',
    access,
    demo: Boolean(access?.demo),
    demoAvailable: config.demoMode,
    accountMailAvailable: mailAvailable(),
    fakeDataNotice: access?.demo ? '가짜 통화 데모입니다. 화면의 거래처, 차번호, 전화번호, 품번은 모두 지어낸 것입니다.' : null,
    ...(access ? aiStatus() : { aiEnabled: false, model: null }),
    worker: access ? workerStatus() : { online: false, queue: { waiting: 0, working: 0 } },
    limits: {
      maxUploadMB: Math.round(config.maxUploadBytes / 1024 / 1024),
      maxAudioSec: config.maxAudioSec,
    },
    commit: config.commit.slice(0, 7),
  }));
}

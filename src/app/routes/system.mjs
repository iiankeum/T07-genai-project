// 시스템: /healthz (배포 확인용) · /api/meta (화면이 처음에 읽는 상태)
import { config, hasSecret } from '../lib/config.mjs';
import { db } from '../lib/db.mjs';
import { sendJson } from '../lib/http.mjs';

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
    try { dbOk = db().prepare('SELECT 1 AS ok').get().ok === 1; } catch { dbOk = false; }
    sendJson(res, dbOk ? 200 : 503, {
      ok: dbOk,
      commit: config.commit,
      startedAt: config.startedAt,
      uptimeSec: Math.round(process.uptime()),
      memMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    });
  });

  router.get('/api/meta', () => ({
    product: '콜노트(가칭)',
    demo: config.demoMode,
    fakeDataNotice: '가짜 통화 데모 — 화면의 거래처·차번호·전화번호·품번은 모두 지어낸 것입니다.',
    aiEnabled: hasSecret('ANTHROPIC_API_KEY'),
    model: config.model,
    worker: workerStatus(),
    limits: {
      maxUploadMB: Math.round(config.maxUploadBytes / 1024 / 1024),
      maxAudioSec: config.maxAudioSec,
    },
    commit: config.commit.slice(0, 7),
  }));
}

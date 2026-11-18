// 관리자: 암호 로그인 · 체험 신청 보기 · 사용량 · 데모 초기화 · 통화 지우기. 시작할 때 가짜 데모 데이터를 넣는다.
// 로그에는 동작 이름만 남긴다(암호 · 신청 내용 · IP 는 남기지 않는다).
import { rmSync } from 'node:fs';
import path from 'node:path';
import { config, hasSecret } from '../lib/config.mjs';
import { db, nowIso } from '../lib/db.mjs';
import { HttpError, readJson } from '../lib/http.mjs';
import {
  limit, adminLogin, adminCookie, adminLogout, adminLogoutCookie, isAdmin, requireAdmin, kstDay, usageCount,
} from '../lib/security.mjs';
import { seedDemo, placeSeed } from '../lib/seed.mjs';
import { removeAudio } from '../lib/audio.mjs';
import { workerStatus } from './system.mjs';
import { visitStats } from '../lib/visits.mjs';
import { parseJson } from '../lib/db.mjs';

const ROLL_EVERY_MS = 10 * 60_000; // 10분마다(새벽에 미래가 된 시드 통화를 고치려고)
let rollTimer = null;

/** 서버가 뜰 때: 비어 있으면 가짜 데모 데이터를 넣고, 오늘 통화가 없으면 시드 날짜를 오늘로 */
export async function start() {
  try {
    const seeded = await seedDemo({ reset: false });
    if (seeded) console.log(`[seed] 가짜 통화 ${seeded}건을 넣었습니다`);
  } catch (e) {
    // seed 파일이 깨져도 서버와 날짜 굴리기는 돈다
    console.error('[seed] 가짜 데이터 넣기 실패:', e?.message || e);
  }
  const roll = () => {
    try {
      const n = placeSeed();
      if (n) console.log(`[seed] 시드 통화 ${n}건의 날짜 · 시각을 다시 잡았습니다`);
    } catch (e) {
      console.error('[seed] 날짜 옮기기 실패:', e?.message || e);
    }
  };
  roll();
  if (rollTimer) clearInterval(rollTimer);
  rollTimer = setInterval(roll, ROLL_EVERY_MS);
  rollTimer.unref();
}

function countBy(sql) {
  const out = {};
  for (const r of db().prepare(sql).all()) out[r.k ?? 'null'] = r.n;
  return out;
}

/** calls.audio_file(DATA_DIR 기준 상대 경로) → 지워도 되는 절대 경로(DATA_DIR/audio 밖이면 null) */
function safeAudioPath(rel) {
  if (!rel) return null;
  const base = path.resolve(config.dataDir, 'audio');
  const abs = path.resolve(config.dataDir, rel);
  return abs.startsWith(base + path.sep) ? abs : null;
}

export function register(router) {
  router.post('/api/admin/login', async ({ req, res, ip }) => {
    limit('login', ip);
    const body = await readJson(req, 4 * 1024);
    let token;
    try {
      token = adminLogin(body.passcode);
    } catch (e) {
      console.log('[admin] login-failed');
      throw e;
    }
    res.setHeader('Set-Cookie', adminCookie(token, req));
    console.log('[admin] login');
    return { ok: true };
  });

  router.post('/api/admin/logout', ({ req, res }) => {
    adminLogout(req);
    res.setHeader('Set-Cookie', adminLogoutCookie());
    return { ok: true };
  });

  router.get('/api/admin/me', ({ req }) => ({ admin: isAdmin(req) }));

  router.get('/api/admin/trials', ({ req }) => {
    requireAdmin(req);
    const rows = db().prepare('SELECT id, created_at, name, org, contact, role, message, consent_at, extra FROM trials ORDER BY created_at DESC, rowid DESC LIMIT 1000').all();
    const trials = rows.map((r) => {
      const x = parseJson(r.extra, {}) || {};
      return {
        id: r.id, createdAt: r.created_at, name: r.name, org: r.org ?? null, contact: r.contact,
        role: r.role ?? null, message: r.message ?? null, consentAt: r.consent_at,
        source: x.source ?? null, industry: x.industry ?? null, callsPerDay: x.callsPerDay ?? null, region: x.region ?? null,
        recordingSetup: x.recordingSetup ?? null, heardFrom: x.heardFrom ?? null, interviewOk: Boolean(x.interviewOk),
        consentMarketing: Boolean(x.consentMarketing), consentMarketingAt: x.consentMarketingAt ?? null, form: x.form ?? null,
      };
    });
    // 묶음 숫자(연락처 없이): 출처 · 업종 · 날짜별
    const tally = (key) => trials.reduce((m, t) => { const k = (typeof key === 'function' ? key(t) : t[key]) || '(없음)'; m[k] = (m[k] || 0) + 1; return m; }, {});
    return {
      trials,
      total: db().prepare('SELECT COUNT(*) AS n FROM trials').get().n,
      counts: {
        bySource: tally('source'),
        byIndustry: tally('industry'),
        byDay: tally((t) => kstDay(new Date(t.createdAt))),
        consentMarketing: trials.filter((t) => t.consentMarketing).length,
      },
    };
  });

  // 파기 요청 · 보유 기간 끝에 하나씩 지운다
  router.delete('/api/admin/trials/:id', ({ req, params }) => {
    requireAdmin(req);
    const r = db().prepare('DELETE FROM trials WHERE id = ?').run(params.id);
    if (!r.changes) throw new HttpError(404, 'not_found', '없는 신청입니다.');
    console.log('[admin] delete-trial');
    return { ok: true, id: params.id };
  });

  router.get('/api/admin/stats', ({ req }) => {
    requireAdmin(req);
    const d = db();
    const day = kstDay();
    const dayStartMs = Date.parse(`${day}T00:00:00.000Z`) - 9 * 3600_000;
    const today = d.prepare('SELECT COUNT(*) AS n FROM calls WHERE recorded_at >= ? AND recorded_at < ?')
      .get(new Date(dayStartMs).toISOString(), new Date(dayStartMs + 86_400_000).toISOString()).n;
    // 숫자는 묶음 { 이름: 숫자 } 꼴로 둔다(관리자 화면이 묶음별 숫자 칸으로 그대로 그린다)
    return {
      day,
      serverTime: nowIso(),
      aiEnabled: hasSecret('ANTHROPIC_API_KEY'),
      usage: { ai: usageCount('ai', day), upload: usageCount('upload', day) },
      limits: { ai: config.dailyAiLimit, upload: config.dailyUploadLimit },
      calls: {
        total: d.prepare('SELECT COUNT(*) AS n FROM calls').get().n,
        today,
        bySource: countBy('SELECT source AS k, COUNT(*) AS n FROM calls GROUP BY source'),
        byStatus: countBy('SELECT status AS k, COUNT(*) AS n FROM calls GROUP BY status'),
      },
      cards: {
        total: d.prepare('SELECT COUNT(*) AS n FROM cards').get().n,
        byStatus: countBy('SELECT status AS k, COUNT(*) AS n FROM cards GROUP BY status'),
      },
      glossary: d.prepare('SELECT COUNT(*) AS n FROM glossary').get().n,
      trials: d.prepare('SELECT COUNT(*) AS n FROM trials').get().n,
      visits: visitStats(14),
      worker: workerStatus(),
    };
  });

  router.post('/api/admin/reset', async ({ req }) => {
    requireAdmin(req);
    const body = await readJson(req, 4 * 1024);
    if (body.confirm !== '초기화') throw new HttpError(400, 'confirm_required', '확인 칸에 「초기화」라고 적어야 초기화합니다.');
    // 올린 · 보낸 · 실시간 통화의 녹음 파일은 행이 지워지면 지울 길이 없으므로 먼저 모아 두었다가 지운다(시드 음성은 남김)
    const files = db().prepare("SELECT DISTINCT audio_file FROM calls WHERE (source IS NULL OR source <> 'seed') AND audio_file IS NOT NULL")
      .all().map((r) => r.audio_file);
    const seeded = await seedDemo({ reset: true });
    const stillUsed = db().prepare('SELECT 1 AS x FROM calls WHERE audio_file = ? LIMIT 1');
    for (const f of files) {
      if (!stillUsed.get(f)) removeAudio(f); // 다시 넣은 시드 통화가 같은 파일을 쓰면 남긴다 · DATA_DIR/audio 밖은 removeAudio 가 막음
    }
    console.log('[admin] reset');
    return { ok: true, seeded };
  });

  // 통화 지우기(카드 · 일감은 함께 지워짐). 녹음 파일도 지운다.
  router.delete('/api/calls/:id', ({ req, params }) => {
    requireAdmin(req);
    const row = db().prepare('SELECT id, audio_file FROM calls WHERE id = ?').get(params.id);
    if (!row) throw new HttpError(404, 'not_found', '없는 통화입니다.');
    db().prepare('DELETE FROM calls WHERE id = ?').run(row.id);
    const file = safeAudioPath(row.audio_file);
    if (file) {
      try { rmSync(file, { force: true }); } catch (e) { console.error('[admin] 녹음 파일 지우기 실패:', e?.code || e?.message); }
    }
    console.log('[admin] delete-call');
    return { ok: true, id: row.id };
  });
}

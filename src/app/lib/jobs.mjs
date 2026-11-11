// 받아쓰기 일감 줄(jobs 표): 줄 세우기 · 일꾼에게 임대 · 끝냄 · 실패 · 임대 만료 되돌리기.
// 녹음을 받아 통화 행 + 일감을 만드는 일(acceptRecording)도 여기서 한다(올리기 · ingest 공통).
import { config } from './config.mjs';
import { db, tx, newId, nowIso } from './db.mjs';
import { convertToWav, removeAudio } from './audio.mjs';
import { makeTitle, customerByPhone } from './repo.mjs';

/** 이미 트랜잭션 안이면 그대로, 아니면 tx() 로 묶는다(겹쳐 부를 수 있게) */
function atomic(fn) {
  const d = db();
  return d.isTransaction ? fn(d) : tx(fn);
}

const ACTIVE = "state IN ('queued', 'leased')";

/** 오류 글 정리: 길이 · 제어문자 · 파일 경로 · 토큰 가리기 */
export function safeError(v, max = 500) {
  if (v == null) return null;
  let s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim();
  s = s.replace(/[A-Za-z]:[\\/][^\s'"]*/g, '[경로]')
    .replace(/(^|[\s'"(=])\/(?:[^\s'"/]+\/)+[^\s'"]*/g, '$1[경로]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [가림]')
    .replace(/[A-Za-z0-9_\-+/=]{32,}/g, '[가림]');
  s = s.slice(0, max).trim();
  return s || null;
}

export function getJob(jobId) {
  return db().prepare('SELECT * FROM jobs WHERE id = ?').get(String(jobId)) ?? null;
}

/** 통화 하나를 줄에 세운다. 이미 줄에 있거나 받아쓰는 중이면 그 일감 id. */
export function enqueue(callId) {
  return atomic((d) => {
    const active = d.prepare(`SELECT id FROM jobs WHERE call_id = ? AND ${ACTIVE} ORDER BY created_at DESC LIMIT 1`).get(callId);
    if (active) return active.id;
    const id = newId('job');
    d.prepare("INSERT INTO jobs(id, call_id, state, attempts, created_at) VALUES(?, ?, 'queued', 0, ?)").run(id, callId, nowIso());
    d.prepare("UPDATE calls SET status = 'queued', error = NULL WHERE id = ?").run(callId);
    return id;
  });
}

/**
 * 가장 오래 기다린 일감 하나를 이 일꾼에게 임대한다. 없으면 null.
 * 다시 줄에 선 일감은 마지막으로 가져간 시각 기준으로 줄 뒤에 선다.
 * @returns {object|null} jobs 행(임대 뒤 값)
 */
export function claim(worker) {
  sweepExpired();
  return atomic((d) => {
    const job = d.prepare("SELECT * FROM jobs WHERE state = 'queued' ORDER BY COALESCE(leased_at, created_at), id LIMIT 1").get();
    if (!job) return null;
    const now = nowIso();
    const until = new Date(Date.now() + config.jobLeaseSec * 1000).toISOString();
    const r = d.prepare("UPDATE jobs SET state = 'leased', worker = ?, leased_at = ?, lease_until = ?, attempts = attempts + 1 WHERE id = ? AND state = 'queued'")
      .run(worker, now, until, job.id);
    if (r.changes !== 1) return null;
    d.prepare("UPDATE calls SET status = 'transcribing', error = NULL WHERE id = ?").run(job.call_id);
    return d.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id);
  });
}

/** 그 일꾼이 임대 중인 일감인지(기한 안). worker 는 꼭 넣는다 — 비우면 false. */
export function isLeasedBy(job, worker) {
  if (!job || job.state !== 'leased') return false;
  if (!worker || job.worker !== worker) return false;
  return !job.lease_until || job.lease_until > nowIso();
}

/**
 * 받아쓰기 끝. 그 일꾼이 임대한 일감이 아니면 null.
 * 통화 상태는 'extracting'(카드 정리 중)으로 바꾼다 — 이어서 lib/pipeline.mjs 가 맡는다.
 */
export function complete(jobId, worker) {
  return atomic((d) => {
    const now = nowIso();
    const r = d.prepare("UPDATE jobs SET state = 'done', finished_at = ?, lease_until = NULL, error = NULL WHERE id = ? AND state = 'leased' AND worker = ?")
      .run(now, String(jobId), worker);
    if (r.changes !== 1) return null;
    const job = d.prepare('SELECT * FROM jobs WHERE id = ?').get(String(jobId));
    d.prepare("UPDATE calls SET status = 'extracting', error = NULL WHERE id = ?").run(job.call_id);
    return job;
  });
}

function failCall(d, callId, reason) {
  d.prepare("UPDATE calls SET status = 'failed', error = ? WHERE id = ?").run(reason, callId);
}

/**
 * 받아쓰기 실패. retryable 이고 시도 횟수가 남았으면 줄 뒤로, 아니면 실패로 끝낸다.
 * @returns {{state:'queued'|'failed', attempts:number, callId:string}|null} 그 일꾼의 임대가 아니면 null
 */
export function fail(jobId, worker, error, retryable = true) {
  const reason = safeError(error) || '이유를 알 수 없음';
  return atomic((d) => {
    const job = d.prepare("SELECT * FROM jobs WHERE id = ? AND state = 'leased' AND worker = ?").get(String(jobId), worker);
    if (!job) return null;
    if (retryable && job.attempts < config.jobMaxAttempts) {
      d.prepare("UPDATE jobs SET state = 'queued', worker = NULL, lease_until = NULL, error = ? WHERE id = ?").run(reason, job.id);
      d.prepare("UPDATE calls SET status = 'queued' WHERE id = ?").run(job.call_id);
      return { state: 'queued', attempts: job.attempts, callId: job.call_id };
    }
    d.prepare("UPDATE jobs SET state = 'failed', finished_at = ?, lease_until = NULL, error = ? WHERE id = ?").run(nowIso(), reason, job.id);
    failCall(d, job.call_id, `받아쓰기에 실패했습니다: ${reason}`.slice(0, 500));
    return { state: 'failed', attempts: job.attempts, callId: job.call_id };
  });
}

/** 임대 기한이 지난 일감을 줄로 되돌리거나(시도 남음) 실패로 끝낸다 */
export function sweepExpired() {
  return atomic((d) => {
    const now = nowIso();
    const rows = d.prepare("SELECT id, call_id, attempts FROM jobs WHERE state = 'leased' AND lease_until IS NOT NULL AND lease_until < ?").all(now);
    let requeued = 0;
    let failed = 0;
    for (const j of rows) {
      if (j.attempts >= config.jobMaxAttempts) {
        d.prepare("UPDATE jobs SET state = 'failed', finished_at = ?, lease_until = NULL, error = ? WHERE id = ?")
          .run(now, '받아쓰기 일꾼이 제시간에 답하지 않음', j.id);
        failCall(d, j.call_id, `받아쓰기 일꾼이 ${j.attempts}번 모두 제시간에 답하지 않았습니다.`);
        failed += 1;
      } else {
        d.prepare("UPDATE jobs SET state = 'queued', worker = NULL, lease_until = NULL, error = ? WHERE id = ?")
          .run('임대 시간이 지나 다시 줄에 섬', j.id);
        d.prepare("UPDATE calls SET status = 'queued' WHERE id = ?").run(j.call_id);
        requeued += 1;
      }
    }
    return { requeued, failed };
  });
}

/** 줄 상태: 기다리는 것 · 받아쓰는 중 */
export function queueStats() {
  const d = db();
  return {
    waiting: d.prepare("SELECT COUNT(*) AS n FROM jobs WHERE state = 'queued'").get().n,
    working: d.prepare("SELECT COUNT(*) AS n FROM jobs WHERE state = 'leased'").get().n,
  };
}

// ── 녹음 받기(올리기 · ingest 공통) ─────────────────────────────────

/** 같은 원본(SHA-256)으로 이미 들어온 통화 */
export function findCallBySha(sha) {
  if (!sha) return null;
  return db().prepare('SELECT * FROM calls WHERE audio_sha256 = ? ORDER BY created_at LIMIT 1').get(sha) ?? null;
}

/** 걸려 온 번호 정리: 숫자만(앞의 + 는 둠), 7~15자리가 아니면 null */
export function normalizePhone(v) {
  if (v == null) return null;
  const s = String(v).slice(0, 40);
  const digits = s.replace(/[^0-9]/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return (s.trim().startsWith('+') ? '+' : '') + digits;
}

/** 녹음 시각: 올바른 날짜(2000년 ~ 내일)면 ISO, 아니면 null */
export function parseRecordedAt(v) {
  if (v == null || String(v).trim() === '') return null;
  const t = Date.parse(String(v).trim());
  if (!Number.isFinite(t)) return null;
  if (t < Date.UTC(2000, 0, 1) || t > Date.now() + 24 * 3600_000) return null;
  return new Date(t).toISOString();
}

/**
 * 녹음 하나를 받는다: 16k WAV 로 바꿔 저장 → 통화 행(status='queued') + 일감.
 * 이미 같은 원본이 있으면 { duplicate:true, callId } (실패했던 통화면 다시 줄에 세운다).
 * @param {{buf:Buffer, sha256?:string, source:'upload'|'ingest', recordedAt?:string, callerNumber?:string|null, deviceName?:string|null,
 *          title?:string|null, originalName?:string|null, uploader?:string|null, isFake?:boolean}} input
 * @returns {Promise<{duplicate:boolean, callId:string, jobId:string|null, requeued?:boolean}>}
 */
export async function acceptRecording(input) {
  const callId = newId('call');
  const conv = await convertToWav(input.buf, callId);
  const recordedAt = input.recordedAt || nowIso();
  const callerNumber = input.callerNumber || null;
  const customer = callerNumber ? customerByPhone(callerNumber) : null;
  const title = input.title || makeTitle({ customer, items: [], recordedAt, durationSec: conv.durationSec, source: input.source });
  try {
    return atomic((d) => {
      const dup = d.prepare('SELECT * FROM calls WHERE audio_sha256 = ? ORDER BY created_at LIMIT 1').get(conv.sha256);
      if (dup) {
        removeAudio(conv.audioFile);
        return { duplicate: true, ...retryIfFailed(dup) };
      }
      d.prepare(`INSERT INTO calls(id, created_at, recorded_at, source, status, title, customer, caller_number, device_name,
                   duration_sec, audio_file, audio_sha256, original_name, is_fake, uploader)
                 VALUES(?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(callId, nowIso(), recordedAt, input.source, title, customer, callerNumber, input.deviceName || null,
          conv.durationSec, conv.audioFile, conv.sha256, input.originalName || null, input.isFake === false ? 0 : 1, input.uploader || null);
      const jobId = enqueue(callId);
      return { duplicate: false, callId, jobId };
    });
  } catch (e) {
    removeAudio(conv.audioFile);
    throw e;
  }
}

/** 중복으로 들어온 통화가 받아쓰기에 실패해 있었으면 다시 줄에 세운다 */
export function retryIfFailed(row) {
  if (row.status === 'failed' && row.audio_file && !row.transcript) {
    const jobId = enqueue(row.id);
    return { callId: row.id, jobId, requeued: true };
  }
  return { callId: row.id, jobId: null };
}

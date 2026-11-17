// 계정, 초대, 워크스페이스 및 설정 API.
import {
  me, login, logout, signup, verify, resendVerification, requestReset, resetPassword, inviteInfo, acceptInvite,
  createWorkspace, switchWorkspace, updateProfile, changePassword, updatePreferences, updateWorkspace,
  listMembers, changeMember, inviteMember, cancelInvite, integrationSettings, updateAiSettings, rotateIngestToken,
  updateRetention, requestAccess, requireRole, forEachWorkspace,
} from '../lib/auth.mjs';
import { db, nowIso, tx, parseJson } from '../lib/db.mjs';
import { HttpError, readJson, sendJson } from '../lib/http.mjs';
import { rateLimit } from '../lib/security.mjs';
import { callView } from '../lib/repo.mjs';
import { removeAudio } from '../lib/audio.mjs';
import { purgeCallReferences } from '../lib/call-retention.mjs';

const MIN = 60_000;
const DAY = 86_400_000;
const HOUR = 3_600_000;
function control(route, max = 10, windowMs = 10 * MIN) {
  return ({ req, res, ip, params }) => {
    rateLimit('account', ip, 60, 10 * MIN);
    rateLimit('account:' + route.name, ip, max, windowMs);
    return readJson(req, 8 * 1024).then((body) => route(body, req, res, params));
  };
}

function adminDataAccess() {
  const access = requireRole('admin');
  if (access.demo) throw new HttpError(403, 'account_required', '계정 워크스페이스에서 설정해 주세요.');
  return access.workspace;
}

function purgeWorkspace() {
  const { retentionDays } = requestAccess()?.workspace ?? {};
  if (!retentionDays) return;
  const cutoff = new Date(Date.now() - retentionDays * DAY).toISOString();
  const expired = tx((d) => {
    const rows = d.prepare('SELECT id, audio_file FROM calls WHERE recorded_at < ?').all(cutoff);
    if (rows.length) {
      purgeCallReferences(d, rows.map((r) => r.id));
      d.prepare('DELETE FROM calls WHERE recorded_at < ?').run(cutoff);
    }
    return rows;
  });
  const used = db().prepare('SELECT 1 FROM calls WHERE audio_file = ? LIMIT 1');
  for (const row of expired) if (row.audio_file && !used.get(row.audio_file)) removeAudio(row.audio_file);
}

function notifications() {
  const access = requestAccess();
  const prefs = access.user.notifications;
  const d = db();
  const read = new Set(d.prepare('SELECT notification_id FROM notification_reads WHERE user_id = ?').all(access.user.id).map((r) => r.notification_id));
  const rows = d.prepare(`SELECT c.id, c.title, c.source, c.status, c.created_at, k.urgent, k.status AS card_status
    FROM calls c LEFT JOIN cards k ON k.call_id = c.id
    WHERE c.created_at >= ? ORDER BY c.created_at DESC LIMIT 30`).all(new Date(Date.now() - 7 * DAY).toISOString());
  const items = [];
  const add = (row, kind, message) => {
    if (!prefs[kind]) return;
    const id = `${kind}:${row.id}:${kind === 'upload' ? row.status : row.card_status}`;
    items.push({ id, callId: row.id, kind, title: row.title ?? '통화', message, createdAt: row.created_at, read: read.has(id) });
  };
  for (const row of rows) {
    if (row.source === 'upload' && row.status === 'ready') add(row, 'upload', '올린 녹음 정리가 끝났어요.');
    if (row.source === 'upload' && row.status === 'failed') add(row, 'upload', '올린 녹음을 정리하지 못했어요.');
    if (row.urgent && ['draft', 'confirmed'].includes(row.card_status)) add(row, 'urgent', '급한 주문의 다음 단계를 확인해 주세요.');
    else if (row.card_status === 'draft') add(row, 'review', '주문 카드 확인이 필요해요.');
  }
  return { items, unread: items.filter((item) => !item.read).length };
}

export function register(router) {
  router.get('/api/auth/me', ({ req }) => me(req));
  router.post('/api/auth/signup', control(function signupAccount(body) { return signup(body); }));
  router.post('/api/auth/login', control(function loginAccount(body, req, res) { return login(req, res, body); }, 30));
  router.post('/api/auth/logout', ({ req, res }) => logout(req, res));
  router.post('/api/auth/verify', control(function verifyAccount(body) { return verify(body); }, 20));
  router.post('/api/auth/verify/request', control(function verifyRequest(body) { return resendVerification(body); }, 5));
  router.post('/api/auth/password/request', control(function resetRequest(body) { return requestReset(body); }, 5));
  router.post('/api/auth/password/reset', control(function resetComplete(body) { return resetPassword(body); }));
  router.post('/api/auth/invite/info', control(function inviteDetails(body) { return inviteInfo(body.token); }, 25));
  router.post('/api/auth/invite/accept', control(function inviteAccept(body, req) { return acceptInvite(req, body); }));
  router.post('/api/auth/workspaces', control(function addWorkspace(body, req) { return createWorkspace(req, body); }));
  router.post('/api/auth/workspaces/switch', control(function selectWorkspace(body, req) { return switchWorkspace(req, body); }, 40));
  router.patch('/api/auth/profile', control(function profileUpdate(body, req) { return updateProfile(req, body); }));
  router.patch('/api/auth/preferences', control(function prefsUpdate(body, req) { return updatePreferences(req, body); }, 30));
  router.post('/api/auth/password/change', control(function changeOwnPassword(body, req) { return changePassword(req, body); }, 5));

  router.patch('/api/settings/workspace', async ({ req }) => updateWorkspace(await readJson(req, 8 * 1024)));
  router.get('/api/settings/members', () => listMembers());
  router.patch('/api/settings/members/:id', async ({ req, params }) => changeMember(params.id, await readJson(req, 8 * 1024)));
  router.post('/api/settings/invites', control(function sendInvite(body) { return inviteMember(body); }));
  router.post('/api/settings/invites/:id/resend', control(function resendInvite(body, req, res, params) { return inviteMember(body, params.id); }));
  router.delete('/api/settings/invites/:id', ({ params }) => cancelInvite(params.id));
  router.get('/api/settings/integrations', () => integrationSettings());
  router.patch('/api/settings/integrations', async ({ req }) => updateAiSettings(await readJson(req, 8 * 1024)));
  router.post('/api/settings/ingest-token', () => rotateIngestToken());
  router.delete('/api/settings/ingest-token', () => rotateIngestToken(true));
  router.patch('/api/settings/data', async ({ req }) => {
    adminDataAccess();
    return updateRetention(await readJson(req, 8 * 1024));
  });
  router.get('/api/settings/data/export', ({ res }) => {
    const workspace = adminDataAccess();
    const data = db();
    const calls = data.prepare('SELECT * FROM calls ORDER BY recorded_at DESC').all()
      .map((c) => ({ ...callView(c, { withDetail: true }), audioUrl: c.audio_file ? `/api/calls/${encodeURIComponent(c.id)}/audio?download=1` : null }));
    const changes = data.prepare(`SELECT entity, entity_id AS entityId, action, actor_id AS actorId, actor_name AS actorName,
      occurred_at AS occurredAt, before_json AS before, after_json AS after FROM audit_log
      WHERE entity IN ('card', 'call') ORDER BY occurred_at DESC`).all()
      .map((r) => ({ ...r, before: parseJson(r.before, null), after: parseJson(r.after, null) }));
    sendJson(res, 200, { workspace, exportedAt: nowIso(), calls, changes },
      { 'Content-Disposition': 'attachment; filename="ahmatda-workspace.json"' });
  });

  router.get('/api/notifications', () => notifications());
  router.post('/api/notifications/read', async ({ req }) => {
    const { ids } = await readJson(req, 8 * 1024);
    if (!Array.isArray(ids) || ids.length > 100) throw new HttpError(400, 'bad_notifications', '읽은 알림을 확인해 주세요.');
    const allowed = new Set(notifications().items.map((item) => item.id));
    const userId = requestAccess().user.id;
    tx((d) => {
      const stmt = d.prepare('INSERT OR IGNORE INTO notification_reads(user_id, notification_id, read_at) VALUES (?, ?, ?)');
      for (const id of ids) if (allowed.has(id)) stmt.run(userId, id, nowIso());
    });
    return notifications();
  });
}

export function start() {
  const run = () => forEachWorkspace(purgeWorkspace, (err) => console.error('[retention]', err?.code || err?.message));
  run();
  setInterval(run, HOUR).unref();
}

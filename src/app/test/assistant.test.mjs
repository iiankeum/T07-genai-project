import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { startServer } from './fixtures/worker-helpers.mjs';

const dataDir = mkdtempSync(path.join(os.tmpdir(), 'ahmatda-assistant-'));
process.env.DATA_DIR = dataDir;
process.env.DEMO_MODE = '1';
process.env.AI_PROVIDER = 'fixture';
process.env.ALLOW_PAID_AI = '0';
process.env.ADMIN_PASSCODE = 'assistant-test-passcode';
const { db, nowIso } = await import('../lib/db.mjs');
const { adminLogin } = await import('../lib/security.mjs');
const { assistantHistoryEpoch } = await import('../lib/assistant-history.mjs');
const modules = await Promise.all([
  import('../routes/assistant.mjs'), import('../routes/glossary.mjs'), import('../routes/admin.mjs'),
]);

let server;
let browser;
const callId = 'call_test_oil';
const primary = '샛별오일필터';
const secondary = '기준오일필터';
const note = '입력할 주문 정보를 다시 확인해 주세요.';
before(async () => {
  const now = nowIso();
  const insertCall = db().prepare(`INSERT INTO calls(id, title, customer, created_at, recorded_at, source, status, transcript, segments)
    VALUES (?, ?, ?, ?, ?, 'seed', 'ready', ?, ?)`);
  const transcript = `${primary} ${secondary} 세 개 요청합니다.`;
  insertCall.run(callId, '가짜별정비소 통화', '가짜별정비소', now, now, transcript, JSON.stringify([{ start: 0, end: 3, text: transcript }]));
  const insertCard = db().prepare(`INSERT INTO cards(call_id, customer, items, ask_back, fixes, callback, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)`);
  insertCard.run(callId, '가짜별정비소', JSON.stringify([{ part: primary, qty: 3 }]), JSON.stringify([note]),
    JSON.stringify([{ heard: primary, fixed: '샛별 오일 필터' }]), now, now);
  server = await startServer(modules);
  browser = (await request('/api/assistant')).cookie;
});
after(async () => {
  await server?.close();
  rmSync(dataDir, { recursive: true, force: true });
});

async function request(url, { cookie, method = 'GET', body } = {}) {
  const headers = { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) };
  const response = await fetch(server.base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

function ask(message, extra = {}) {
  return request('/api/assistant', { cookie: browser, method: 'POST', body: { message, ...extra } });
}

test('업무 제안은 지정된 작업만 제공하며 재연락 문안은 카드 근거를 사용한다', async () => {
  const context = await request('/api/assistant?callId=' + callId, { cookie: browser });
  assert.equal(context.status, 200);
  assert.equal(context.body.selected.id, callId);
  assert.equal(context.body.questionLimit, 300);
  assert.ok(context.body.suggestions.length <= context.body.suggestionLimit);
  assert.ok(context.body.suggestions.some((item) => item.action === 'open_call' && item.callId === callId));
  assert.ok(context.body.suggestions.some((item) => item.action === 'draft_callback' && item.callId === callId));
  assert.ok(context.body.suggestions.every((item) => ['open_call', 'open_knowledge', 'draft_callback'].includes(item.action)));
  assert.equal(context.body.knowledgeDraft.sourceSegIndex, 0);

  const draft = await request('/api/assistant/callback?callId=' + callId, { cookie: browser });
  assert.equal(draft.status, 200);
  assert.equal(draft.body.call.id, callId);
  assert.ok(draft.body.text.includes(note));
  assert.equal((await request('/api/assistant/callback?callId=unknown', { cookie: browser })).status, 404);
  assert.equal((await ask('가'.repeat(301))).status, 400);
});

test('대화 이력을 이어 저장하고 다른 브라우저에서는 조회·삭제할 수 없다', async () => {
  const answer = await ask(primary, { callId });
  assert.equal(answer.status, 200, JSON.stringify(answer.body));
  assert.equal(answer.body.mode, 'fixture');
  assert.equal(answer.body.citations[0].callId, callId);
  assert.equal(answer.body.citations[0].segIndex, 0);
  assert.equal(answer.body.citations[0].at, 0);
  const id = answer.body.thread.id;
  const followup = await ask(secondary, { threadId: id, callId });
  assert.equal(followup.body.thread.id, id);
  assert.equal(followup.body.thread.messages.length, 4);

  const url = '/api/assistant/threads/' + id;
  const other = await request('/api/assistant');
  assert.notEqual(other.cookie, browser);
  assert.deepEqual(other.body.threads, []);
  assert.equal((await request(url, { cookie: other.cookie })).status, 404);
  assert.equal((await request(url, { cookie: other.cookie, method: 'DELETE' })).status, 404);
  assert.equal((await request(url, { cookie: browser })).body.thread.messages.length, 4);
  assert.equal((await request(url, { cookie: browser, method: 'DELETE' })).status, 200);
  assert.equal((await request(url, { cookie: browser })).status, 404);
});

test('승인된 지식만 근거가 되고 관련 통화 삭제 시 출처와 관련 대화만 지워진다', async () => {
  const term = '출고여닫이절차';
  const proposal = await request('/api/knowledge', {
    cookie: browser, method: 'POST', body: { kind: '업무 절차', term, note: '종료 후 출고문 확인', evidenceNote: '통화 참고', sourceCallId: callId, sourceSegIndex: 0 },
  });
  assert.equal(proposal.status, 200, JSON.stringify(proposal.body));
  const beforeApproval = await ask(term);
  assert.equal(beforeApproval.body.found, false);
  const { id, revisionId } = proposal.body;
  const approval = await request(`/api/knowledge/${id}/revisions/${revisionId}/review`, { cookie: browser, method: 'POST', body: { decision: 'approve' } });
  assert.equal(approval.status, 200);
  const knowledge = await ask(term);
  assert.equal(knowledge.body.found, true, JSON.stringify(knowledge.body));
  assert.equal(knowledge.body.citations[0].knowledgeId, id);
  const linked = await ask(term, { callId });
  assert.equal(linked.body.citations[0].knowledgeId, id);
  assert.ok(linked.body.thread.messages.at(-1).contextCallIds.includes(callId));

  // 인용이 지식이더라도 제공된 문맥에 원본 통화가 있으면 삭제 대상이다.
  assert.ok(knowledge.body.thread.messages.at(-1).contextCallIds.includes(callId));
  const unrelatedId = 'thread_unrelated_fixture';
  const threadOwner = db().prepare('SELECT user_id FROM assistant_threads WHERE id = ?').get(knowledge.body.thread.id).user_id;
  db().prepare('INSERT INTO assistant_threads(id, user_id, title, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(unrelatedId, threadOwner, '통화와 무관한 가짜 대화', JSON.stringify([
      { role: 'assistant', text: '가짜 일반 안내', contextCallIds: [], citations: [] },
    ]), nowIso(), nowIso());

  const epoch = assistantHistoryEpoch(db());
  const admin = `cn_admin=${adminLogin('assistant-test-passcode')}`;
  const removed = await request('/api/calls/' + callId, { cookie: admin, method: 'DELETE' });
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.notEqual(assistantHistoryEpoch(db()), epoch);
  assert.equal((await request('/api/assistant/threads/' + linked.body.thread.id, { cookie: browser })).status, 404);
  assert.equal((await request('/api/assistant/threads/' + knowledge.body.thread.id, { cookie: browser })).status, 404);
  assert.equal((await request('/api/assistant/threads/' + unrelatedId, { cookie: browser })).status, 200);
  const saved = (await request('/api/knowledge/' + id, { cookie: browser })).body.item;
  assert.equal(saved.sourceCallId, null);
  assert.equal(saved.revisions[0].content.sourceSegIndex, null);
  assert.equal(saved.evidenceNote, null);
  assert.equal(saved.note, '종료 후 출고문 확인');
});

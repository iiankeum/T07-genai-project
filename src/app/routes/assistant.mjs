import { randomUUID } from 'node:crypto';
import { assistantHistoryEpoch } from '../lib/assistant-history.mjs';
import { requestAccess } from '../lib/auth.mjs';
import { config } from '../lib/config.mjs';
import { db, newId, nowIso, parseJson, tx } from '../lib/db.mjs';
import { cleanText, HttpError, readJson } from '../lib/http.mjs';
import { approvedKnowledge } from '../lib/knowledge.mjs';
import { cardView, getCallRow, getCardRow } from '../lib/repo.mjs';
import { limit } from '../lib/security.mjs';
import { askGrounded } from './insights.mjs';

export const QUESTION_LIMIT = 300;
const SUGGESTION_LIMIT = 4;
const MAX_THREADS = 50;
const MAX_MESSAGES = 40;

function owner({ req, res }) {
  const { user, demo } = requestAccess();
  if (!demo) return user.id;
  const cookie = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('cn_demo_chat='));
  const token = cookie?.slice('cn_demo_chat='.length);
  if (token && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(token)) return 'demo:' + token;
  const id = randomUUID();
  const secure = req.socket.encrypted || config.publicBaseUrl.startsWith('https:');
  res.appendHeader('Set-Cookie', `cn_demo_chat=${id}; HttpOnly; SameSite=Lax; Path=/api/assistant; Max-Age=2592000${secure ? '; Secure' : ''}`);
  return 'demo:' + id;
}

function callSummary(row) {
  return { id: row.id, title: row.title, customer: row.customer ?? null, recordedAt: row.recorded_at };
}

function recentCalls() {
  return db().prepare(`SELECT c.id, c.title, c.recorded_at, COALESCE(k.customer, c.customer) AS customer
    FROM calls c LEFT JOIN cards k ON c.id = k.call_id WHERE c.status = 'ready'
    ORDER BY c.recorded_at DESC LIMIT 25`).all().map(callSummary);
}

function needCall(id) {
  const row = typeof id === 'string' && getCallRow(id);
  if (!row) throw new HttpError(404, 'not_found', '선택한 통화를 찾지 못했어요.');
  return row;
}

function suggestions(selected, knowledge) {
  const out = [];
  if (selected) {
    const card = cardView(getCardRow(selected.id));
    const customer = card?.customer || selected.customer || '선택한 거래처';
    if (card?.callback || card?.askBack?.length || card?.unsure?.length) {
      out.push({ action: 'draft_callback', callId: selected.id, title: `${customer}에 보낼 확인 문안 준비`, description: '주문 카드에 적힌 다시 확인할 내용을 담습니다.' });
    }
    out.push({ action: 'open_call', callId: selected.id, title: `${customer} 통화 열기`, description: '통화 원문과 주문 카드를 확인합니다.' });
  }
  const callback = db().prepare(`SELECT k.call_id AS id, COALESCE(k.customer, c.customer, '거래처 확인 필요') AS customer
    FROM cards k JOIN calls c ON c.id = k.call_id
    WHERE k.callback = 1 AND k.call_id <> ? ORDER BY k.updated_at DESC LIMIT 1`).get(selected?.id || '');
  if (callback) out.push({ action: 'draft_callback', callId: callback.id, title: `${callback.customer} 재연락 준비`, description: '다시 연락할 목록에 있는 거래처입니다.' });
  if (knowledge.length) {
    const relevant = knowledge.find((item) => item.sourceCallId && item.sourceCallId === selected?.id) ?? knowledge[0];
    out.push({ action: 'open_knowledge', knowledgeId: relevant.id, title: `「${relevant.term}」 지식 보기`, description: '팀에서 승인한 용어와 사용 맥락을 봅니다.' });
  }
  return out.slice(0, SUGGESTION_LIMIT);
}

function knowledgeDraft(row, knowledge) {
  if (!row) return null;
  const card = cardView(getCardRow(row.id));
  const segments = parseJson(row.segments, []);
  const fix = card?.fixes?.find((entry) => entry?.heard && entry.fixed && entry.heard !== entry.fixed &&
    !knowledge.some((item) => item.term === entry.heard && item.standard === entry.fixed) &&
    segments.some((segment) => segment?.text?.includes(entry.heard)));
  if (!fix) return null;
  const segIndex = segments.findIndex((segment) => segment?.text?.includes(fix.heard));
  return { kind: '오인식', term: fix.heard, standard: fix.fixed, sourceCallId: row.id, sourceSegIndex: segIndex };
}

function assistantContext(callId) {
  const calls = recentCalls();
  const selected = callId ? callSummary(needCall(callId)) : calls[0] ?? null;
  const knowledge = approvedKnowledge();
  return {
    calls: selected && !calls.some((call) => call.id === selected.id) ? [selected, ...calls] : calls,
    selected, approvedCount: knowledge.length, suggestions: suggestions(selected, knowledge),
    knowledgeDraft: knowledgeDraft(selected && getCallRow(selected.id), knowledge),
    questionLimit: QUESTION_LIMIT, suggestionLimit: SUGGESTION_LIMIT,
  };
}

function callbackDraft(id) {
  const row = needCall(id);
  const card = cardView(getCardRow(id));
  const customer = card?.customer || row.customer;
  const item = card?.items?.find((entry) => entry?.part);
  const order = [card?.carModel, item?.side, item?.part].filter(Boolean).join(' ');
  const salutation = customer ? `안녕하세요, ${customer} 담당자님.` : '안녕하세요, 담당자님.';
  const opening = order ? `${order} 건으로 확인차 연락드립니다.` : '지난 통화 내용을 다시 확인하려고 연락드립니다.';
  const followups = [...new Set((card?.askBack ?? []).filter((line) => typeof line === 'string' && line.trim()))].slice(0, 4);
  if (!followups.length && item) {
    const quantity = Number.isSafeInteger(item.qty) && item.qty > 0 ? ` ${item.qty}개` : '';
    followups.push(`${item.part}${quantity} 요청이 맞으실까요?`);
  }
  if (!followups.length) followups.push('요청하신 내용 중 다시 확인할 사항이 있는지 알려 주세요.');
  if (card?.due) followups.push(`${card.due}까지 요청하신 건은 가능 여부를 확인한 뒤 안내드리겠습니다.`);
  const text = [`${salutation} ${opening}`, '', ...followups.map((line, i) => `${i + 1}. ${line}`), '', '감사합니다.'].join('\n');
  return { call: { ...callSummary(row), customer }, text };
}

function getThread(actor, id) {
  const row = db().prepare('SELECT * FROM assistant_threads WHERE user_id = ? AND id = ?').get(actor, id);
  if (!row) throw new HttpError(404, 'not_found', '저장된 대화를 찾지 못했어요.');
  return row;
}
function threadView(row) {
  return { id: row.id, title: row.title, messages: parseJson(row.messages, []), createdAt: row.created_at, updatedAt: row.updated_at };
}

async function answer(ctx) {
  const { req, res, ip } = ctx;
  const actor = owner(ctx);
  const body = await readJson(req, 4096);
  const raw = typeof body.message === 'string' ? body.message.trim() : '';
  if (raw.length > QUESTION_LIMIT) throw new HttpError(400, 'too_long', `질문은 ${QUESTION_LIMIT}자 안으로 써 주세요.`);
  const question = cleanText(raw, QUESTION_LIMIT);
  if (!question) throw new HttpError(400, 'empty_question', '물어볼 말을 써 주세요.');
  const old = body.threadId ? getThread(actor, body.threadId) : null;
  if (!old && db().prepare('SELECT COUNT(*) AS n FROM assistant_threads WHERE user_id = ?').get(actor).n >= MAX_THREADS) {
    throw new HttpError(409, 'too_many_threads', '저장된 대화 중 하나를 지운 뒤 새 대화를 시작해 주세요.');
  }
  const selectedCallId = body.callId ? needCall(body.callId).id : null;
  const history = parseJson(old?.messages, []).slice(-6);
  const epoch = assistantHistoryEpoch(db());
  const contextCallIds = new Set(selectedCallId ? [selectedCallId] : []);
  for (const message of history) {
    for (const id of message.contextCallIds ?? []) contextCallIds.add(id);
    for (const citation of message.citations ?? []) if (citation.callId) contextCallIds.add(citation.callId);
  }
  const controller = new AbortController();
  const stop = () => controller.abort();
  res.once('close', stop);
  const timeout = AbortSignal.timeout(55_000);
  const signal = AbortSignal.any([controller.signal, timeout]);
  try {
    const out = await askGrounded({ question, history }, ip, {
      signal, allowKnowledge: true, selectedCallId,
      onCallContext: (ids) => ids.forEach((id) => contextCallIds.add(id)),
    });
    signal.throwIfAborted();
    const messages = [
      ...parseJson(old?.messages, []),
      { role: 'user', text: question },
      { role: 'assistant', text: out.answer, found: out.found, citations: out.citations, mode: out.mode || 'ai', contextCallIds: [...contextCallIds] },
    ].slice(-MAX_MESSAGES);
    const now = nowIso();
    const id = old?.id ?? newId('chat');
    const data = JSON.stringify(messages);
    return tx((d) => {
      if (assistantHistoryEpoch(d) !== epoch) {
        throw new HttpError(409, 'deleted_context', '통화 기록이 바뀌었어요. 질문을 다시 보내 주세요.');
      }
      if (old) {
        const { changes } = d.prepare('UPDATE assistant_threads SET messages = ?, updated_at = ? WHERE id = ? AND user_id = ? AND messages = ?')
          .run(data, now, id, actor, old.messages);
        if (!changes) throw new HttpError(409, 'changed_thread', '대화가 바뀌었어요. 다시 열어 주세요.');
      } else {
        const { changes } = d.prepare(`INSERT INTO assistant_threads(id, user_id, title, messages, created_at, updated_at)
          SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM assistant_threads WHERE user_id = ?) < ?`)
          .run(id, actor, question.slice(0, 54), data, now, now, actor, MAX_THREADS);
        if (!changes) throw new HttpError(409, 'too_many_threads', '저장된 대화 중 하나를 지운 뒤 새 대화를 시작해 주세요.');
      }
      return { ...out, thread: threadView(getThread(actor, id)) };
    });
  } catch (err) {
    if (controller.signal.aborted || res.destroyed) return;
    if (timeout.aborted) throw new HttpError(504, 'assistant_timeout', '답변을 받는 데 시간이 걸려요. 잠시 뒤 다시 해 주세요.');
    throw err;
  } finally {
    res.removeListener('close', stop);
  }
}

export function register(router) {
  router.get('/api/assistant', (ctx) => {
    const actor = owner(ctx);
    const threads = db().prepare('SELECT id, title, updated_at AS updatedAt FROM assistant_threads WHERE user_id = ? ORDER BY updated_at DESC').all(actor);
    return { ...assistantContext(ctx.query.callId), threads };
  });
  router.get('/api/assistant/callback', ({ query }) => callbackDraft(query.callId));
  router.get('/api/assistant/threads/:id', (ctx) => ({ thread: threadView(getThread(owner(ctx), ctx.params.id)) }));
  router.delete('/api/assistant/threads/:id', (ctx) => {
    const actor = owner(ctx);
    limit('write', ctx.ip);
    const thread = getThread(actor, ctx.params.id);
    db().prepare('DELETE FROM assistant_threads WHERE id = ? AND user_id = ?').run(thread.id, actor);
    return { ok: true };
  });
  router.post('/api/assistant', answer);
}

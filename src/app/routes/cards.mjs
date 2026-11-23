// 주문 카드 API: 칸 고치기 · 확정 · 출고 · 다시 열기 · 취소 · 다시 전화 표시 · 다시 정리(F06 · F07).
import { takeAiDaily } from '../lib/ai.mjs';
import { forEachWorkspace } from '../lib/auth.mjs';
import { HttpError, readJson } from '../lib/http.mjs';
import { limit } from '../lib/security.mjs';
import { getCallRow, callView } from '../lib/repo.mjs';
import { updateCardFields, reviewCardWarning, setCardStatus, setCallback } from '../lib/cards.mjs';
import { reextract, resumeStuck } from '../lib/pipeline.mjs';

const ACTIONS = ['confirm', 'reopen', 'ship', 'unship', 'cancel'];

export function register(router) {
  router.patch('/api/cards/:callId', async ({ req, params, ip }) => {
    limit('write', ip);
    const body = await readJson(req, 64 * 1024);
    return { card: updateCardFields(params.callId, body) };
  });

  for (const action of ACTIONS) {
    router.post(`/api/cards/:callId/${action}`, async ({ req, params, ip }) => {
      limit('write', ip);
      const body = await readJson(req, 4 * 1024);
      return setCardStatus(params.callId, action, { reason: body?.reason, expectedRevision: body?.expectedRevision });
    });
  }

  router.post('/api/cards/:callId/callback', async ({ req, params, ip }) => {
    limit('write', ip);
    const body = await readJson(req, 4 * 1024);
    return { card: setCallback(params.callId, { on: body?.on, reason: body?.reason }) };
  });

  router.post('/api/cards/:callId/review', async ({ req, params, ip }) => {
    limit('write', ip);
    const body = await readJson(req, 4 * 1024);
    if (typeof body?.id !== 'string' || !body.id) throw new HttpError(400, 'bad_review', '확인할 항목을 골라 주세요.');
    return { card: reviewCardWarning(params.callId, body.id, body.expectedRevision) };
  });

  router.post('/api/calls/:id/reextract', async ({ req, params, ip }) => {
    limit('write', ip);
    await readJson(req, 4 * 1024);
    limit('ai', ip);
    await reextract(params.id, { beforeAi: takeAiDaily });
    return { call: callView(getCallRow(params.id), { withDetail: true }) };
  });
}

/** 서버가 뜰 때: 카드 정리 중에 멈춘 통화를 뒤에서 다시 정리(기다리지 않는다) */
export async function start() {
  const onError = (e) => console.error('[cards] 멈춘 통화 다시 정리 실패:', e?.message || e);
  setTimeout(() => {
    try {
      forEachWorkspace(() => {
        resumeStuck()
          .then((n) => { if (n) console.log(`[cards] 멈춘 통화 ${n}건 다시 정리`); })
          .catch(onError);
      }, onError);
    } catch (e) {
      onError(e);
    }
  }, 2000).unref();
}

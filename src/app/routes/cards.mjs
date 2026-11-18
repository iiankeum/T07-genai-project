// 주문 카드 API: 칸 고치기 · 확정 · 출고 · 다시 열기 · 취소 · 다시 전화 표시 · 다시 정리(F06 · F07).
import { config } from '../lib/config.mjs';
import { readJson } from '../lib/http.mjs';
import { limit, takeDaily } from '../lib/security.mjs';
import { getCallRow, getCardRow, cardView, callView } from '../lib/repo.mjs';
import { updateCardFields, setCardStatus, setCallback } from '../lib/cards.mjs';
import { reextract, resumeStuck } from '../lib/pipeline.mjs';

const ACTIONS = ['confirm', 'reopen', 'ship', 'cancel'];

export function register(router) {
  router.patch('/api/cards/:callId', async ({ req, params, ip }) => {
    limit('write', ip);
    const body = await readJson(req, 64 * 1024);
    updateCardFields(params.callId, body);
    return { card: cardView(getCardRow(params.callId)) };
  });

  for (const action of ACTIONS) {
    router.post(`/api/cards/:callId/${action}`, async ({ req, params, ip }) => {
      limit('write', ip);
      await readJson(req, 4 * 1024); // JSON 요청만 받는다(교차 사이트 폼 막기)
      const out = setCardStatus(params.callId, action);
      const res = { card: cardView(getCardRow(params.callId)) };
      if (out.warnings?.length) res.warnings = out.warnings;
      return res;
    });
  }

  router.post('/api/cards/:callId/callback', async ({ req, params, ip }) => {
    limit('write', ip);
    const body = await readJson(req, 4 * 1024);
    setCallback(params.callId, { on: body.on, reason: body.reason });
    return { card: cardView(getCardRow(params.callId)) };
  });

  router.post('/api/calls/:id/reextract', async ({ req, params, ip }) => {
    limit('write', ip);
    await readJson(req, 4 * 1024);
    limit('ai', ip);
    await reextract(params.id, { beforeAi: () => takeDaily('ai', config.dailyAiLimit) });
    return { call: callView(getCallRow(params.id), { withDetail: true }) };
  });
}

/** 서버가 뜰 때: 카드 정리 중에 멈춘 통화를 뒤에서 다시 정리(기다리지 않는다) */
export async function start() {
  setTimeout(() => {
    resumeStuck()
      .then((n) => { if (n) console.log(`[cards] 멈춘 통화 ${n}건 다시 정리`); })
      .catch((e) => console.error('[cards] 멈춘 통화 다시 정리 실패:', e?.message || e));
  }, 2000).unref();
}

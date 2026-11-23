// 가짜 SDK 오류/시각만 사용한다. 실제 제공업체 요청·자동 재시도를 하지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-rate-limit-'));
process.env.AI_PROVIDER = 'off';
const { AiError, aiHttpError, retryAfterSeconds } = await import('../lib/ai-error.mjs');
const ai = await import('../lib/ai.mjs');
const { default: Anthropic } = await import('@anthropic-ai/sdk');
const now = Date.parse('Thu, 19 Nov 2026 12:00:00 GMT');
const parse = (value) => retryAfterSeconds(new Headers({ 'retry-after': value }), now);

test('Retry-After 초와 HTTP-date: 올림, 0, 공백', () => {
  assert.equal(parse('120'), 120);
  assert.equal(parse('  0  '), 0);
  assert.equal(parse('Thu, 19 Nov 2026 12:01:30 GMT'), 90);
  assert.equal(retryAfterSeconds(new Headers({ 'retry-after': 'Thu, 19 Nov 2026 12:01:30 GMT' }), now + 1), 90);
});
test('모름/잘못된 값/지난 날짜/모호한 reset은 시간을 만들지 않는다', () => {
  for (const value of ['', '-1', '+1', '1.5', 'Infinity', '1e3', '999999999999999999999', '2026-11-19', 'Thu, 19 Nov 2026 11:59:59 GMT', 'Fri, 19 Nov 2026 12:01:30 GMT', '120, 240', '<b>60</b>']) assert.equal(parse(value), undefined, value);
  assert.equal(retryAfterSeconds(undefined, now), undefined);
  assert.equal(retryAfterSeconds(new Headers({ 'anthropic-ratelimit-requests-reset': '2026-11-19T12:02:00Z' }), now), undefined);
});
test('HTTP 계약 유지: 429 ai_busy, 숫자 안내만 공개, 일반 오류 불변', () => {
  const h = aiHttpError(new AiError('rate_limited', '가짜 비공개 원문', { retryAfterSeconds: 12 }));
  assert.equal(h.status, 429); assert.equal(h.code, 'ai_busy');
  assert.match(h.publicMessage, /12초 후 직접 다시 시도/);
  assert.doesNotMatch(h.publicMessage, /비공개/);
  for (const seconds of [undefined, -1, NaN, '60']) assert.doesNotMatch(aiHttpError(new AiError('rate_limited', undefined, { retryAfterSeconds: seconds })).publicMessage, /초/);
  assert.equal(aiHttpError(new AiError('no_key')).status, 503);
});
test('실제 SDK 오류 모양을 보존: 종료 후 새 사용자 호출 전까지 추가 요청 없음', async () => {
  let count = 0;
  const create = async () => { count++; throw new Anthropic.RateLimitError(429, { error: { message: '가짜 비밀 본문' } }, '', new Headers({ 'retry-after': '60', 'request-id': 'fake-private-id' })); };
  ai.setClientForTest({ beta: { messages: { create } }, messages: { create } });
  try {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await assert.rejects(ai.extractCard({ transcript: '가짜 통화', segments: [], glossary: [], customers: [], carModels: [] }), e => {
        assert.equal(e.code, 'rate_limited'); assert.equal(e.retryAfterSeconds, 60);
        assert.match(aiHttpError(e).publicMessage, /60초/);
        assert.equal(e.headers, undefined); assert.doesNotMatch(e.message, /비밀|private/); return true;
      });
      await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(count, attempt);
    }
  } finally { ai.setClientForTest(null); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); }
});

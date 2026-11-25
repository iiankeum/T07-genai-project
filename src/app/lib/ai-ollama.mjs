import http from 'node:http';
import { AiError } from './ai-error.mjs';
import { config } from './config.mjs';

const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_TIMEOUT_MS = 120_000;

async function postJson(path, payload, signal) {
  signal.throwIfAborted();
  const body = JSON.stringify(payload);
  const response = await new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: config.ollamaPort,
      path,
      method: 'POST',
      agent: false, // 환경의 전역 HTTP 프록시를 사용하지 않는다.
      signal,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    }, resolve);
    request.once('error', reject);
    request.end(body);
  });
  const status = response.statusCode;
  // Node HTTP는 리다이렉트를 따라가지 않는다. 오류 응답 본문은 읽거나 기록하지 않는다.
  if (status !== 200) {
    response.destroy();
    if (status === 404) throw new AiError('local_model_unavailable');
    if (status === 429) throw new AiError('rate_limited');
    throw new AiError('local_unavailable');
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response) {
    bytes += chunk.length;
    if (bytes > MAX_RESPONSE_BYTES) throw new AiError('bad_output');
    chunks.push(chunk);
  }
  signal.throwIfAborted();
  try {
    return JSON.parse(Buffer.concat(chunks, bytes).toString('utf8'));
  } catch {
    throw new AiError('bad_output');
  }
}

function isRemoteModel(model) {
  return model?.remote_host || model?.remote_model;
}

export async function ollamaJson({ model, system, user, schema, maxTokens, timeoutMs, signal }) {
  const ms = timeoutMs > 0 ? Math.min(Math.ceil(timeoutMs), MAX_TIMEOUT_MS) : MAX_TIMEOUT_MS;
  const timeout = AbortSignal.timeout(ms);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    // 같은 이름으로 만들어 둔 원격 모델도 있을 수 있다. 통화 글을 보내기 전에 확인한다.
    const installed = await postJson('/api/show', { model }, requestSignal);
    const info = installed?.model_info;
    if (isRemoteModel(installed) || !info || typeof info !== 'object' || Array.isArray(info) || !Object.keys(info).length) {
      throw new AiError('local_model_unavailable');
    }
    const response = await postJson('/api/chat', {
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      format: schema,
      stream: false,
      think: false,
      options: { num_predict: maxTokens, temperature: 0 },
    }, requestSignal);
    if (isRemoteModel(response)) throw new AiError('local_model_unavailable');
    if (response?.done_reason === 'length') throw new AiError('bad_output', 'AI 답이 너무 길어 끊겼습니다');
    if (response?.done !== true || typeof response.message?.content !== 'string') throw new AiError('bad_output');
    let data;
    try { data = JSON.parse(response.message.content); } catch { throw new AiError('bad_output'); }
    return { data, model };
  } catch (err) {
    signal?.throwIfAborted();
    if (timeout.aborted) throw new AiError('local_timeout');
    if (err instanceof AiError) throw err;
    throw new AiError('local_unavailable');
  }
}

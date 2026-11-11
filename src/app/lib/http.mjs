// 아주 작은 HTTP 도구: 라우터 · JSON 읽기/쓰기 · multipart 읽기 · 오류.
// 프레임워크 없이 node:http 위에서 돈다(서버 RAM 1GB 를 실서비스와 나눠 쓰므로 가볍게).
import { config } from './config.mjs';

export class HttpError extends Error {
  /** @param {number} status @param {string} code 화면이 읽는 짧은 코드 @param {string} [message] 사람이 읽는 한국어 설명 */
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.publicMessage = message || '';
  }
}

export function sendJson(res, status, body, extraHeaders = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text),
    ...extraHeaders,
  });
  res.end(text);
}

export function sendEmpty(res, status = 204) {
  res.writeHead(status, { 'Cache-Control': 'no-store' });
  res.end();
}

/** 본문을 바이트로 모은다(최대 limit). 넘으면 413. */
export async function readBody(req, limit) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > limit) throw new HttpError(413, 'too_large', `너무 큽니다(최대 ${Math.round(limit / 1024 / 1024 * 10) / 10}MB).`);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'too_large', `너무 큽니다(최대 ${Math.round(limit / 1024 / 1024 * 10) / 10}MB).`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** JSON 본문 읽기. Content-Type 이 JSON 이 아니면 415 (교차 사이트 폼 위조 막기). */
export async function readJson(req, limit = 64 * 1024) {
  const type = String(req.headers['content-type'] || '');
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'json_required', 'JSON 으로 보내 주세요.');
  }
  const buf = await readBody(req, limit);
  if (buf.length === 0) return {};
  try {
    const v = JSON.parse(buf.toString('utf8'));
    if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('not object');
    return v;
  } catch {
    throw new HttpError(400, 'bad_json', 'JSON 형식이 잘못됐습니다.');
  }
}

/** multipart/form-data 읽기. 웹 표준 Request.formData() 를 쓴다(의존성 없음). */
export async function readForm(req, limit) {
  const type = String(req.headers['content-type'] || '');
  if (!type.toLowerCase().startsWith('multipart/form-data')) {
    throw new HttpError(415, 'multipart_required', '파일은 multipart/form-data 로 보내 주세요.');
  }
  const buf = await readBody(req, limit + 64 * 1024);
  const request = new Request('http://local/upload', {
    method: 'POST',
    headers: { 'content-type': type },
    body: buf,
  });
  try {
    return await request.formData();
  } catch {
    throw new HttpError(400, 'bad_form', '올린 양식을 읽지 못했습니다.');
  }
}

/** 요청한 사람의 IP. Caddy 뒤에서는 X-Forwarded-For 첫 값(서버가 127.0.0.1 에서만 받을 때). */
export function clientIp(req) {
  const remote = req.socket?.remoteAddress || '';
  if (config.trustProxy && (remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1')) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xff) return xff;
    const real = String(req.headers['x-real-ip'] || '').trim();
    if (real) return real;
  }
  return remote || 'unknown';
}

/**
 * 라우터. pattern 예: '/api/calls/:id'.
 * handler(ctx) 는 ctx = { req, res, url, params, query, ip } 를 받고,
 *  - 객체를 돌려주면 200 JSON 으로 보낸다.
 *  - res 에 직접 쓴 경우 undefined 를 돌려준다.
 */
export class Router {
  constructor() { this.routes = []; }
  add(method, pattern, handler) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    this.routes.push({ method, re, keys, handler, pattern });
    return this;
  }
  get(p, h) { return this.add('GET', p, h); }
  post(p, h) { return this.add('POST', p, h); }
  patch(p, h) { return this.add('PATCH', p, h); }
  put(p, h) { return this.add('PUT', p, h); }
  delete(p, h) { return this.add('DELETE', p, h); }

  match(method, pathname) {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method && !(method === 'HEAD' && r.method === 'GET')) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}

/** 문자열 값 정리: 앞뒤 공백 제거 · 길이 제한 · 제어문자 제거. 빈 값이면 null. */
export function cleanText(v, max = 200) {
  if (v == null) return null;
  const s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!s) return null;
  return s.slice(0, max);
}

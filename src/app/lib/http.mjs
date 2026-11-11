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

/** 본문을 바이트로 모은다(최대 limit). 넘으면 413, 보내는 중에 끊기면 400. */
export async function readBody(req, limit) {
  const tooLarge = () => new HttpError(413, 'too_large', `너무 큽니다(최대 ${Math.round(limit / 1024 / 1024 * 10) / 10}MB).`);
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > limit) throw tooLarge();
  // 크기를 알면 한 벌만 잡고 채운다(조각 모음 + Buffer.concat 로 두 벌 잡지 않게)
  const one = Number.isSafeInteger(declared) && declared > 0 ? Buffer.allocUnsafe(declared) : null;
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      if (size + chunk.length > limit) throw tooLarge();
      if (one) {
        if (size + chunk.length > one.length) throw new HttpError(400, 'bad_length', '보낸 크기가 맞지 않습니다.');
        chunk.copy(one, size);
      } else {
        chunks.push(chunk);
      }
      size += chunk.length;
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, 'aborted', '보내는 중에 연결이 끊겼습니다. 다시 해 주세요.');
  }
  return one ? one.subarray(0, size) : Buffer.concat(chunks);
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

/** 파일 크기 한도에 더해 양식 머리 · 글 칸 몫으로 허용하는 바이트 */
export const FORM_OVERHEAD = 64 * 1024;

/**
 * multipart/form-data 읽기(의존성 없음). 본문은 한 벌만 메모리에 두고,
 * 파일 칸은 그 본문을 가리키는 Buffer.subarray 로 준다(복사하지 않음 — 메모리 보호).
 * 돌려주는 값은 FormData 처럼 get(name) · getAll(name) · has(name) 을 쓴다.
 * 파일 칸: { name, type, size, buffer, arrayBuffer() }, 글 칸: 문자열.
 */
export async function readForm(req, limit) {
  const type = String(req.headers['content-type'] || '');
  if (!type.toLowerCase().startsWith('multipart/form-data')) {
    throw new HttpError(415, 'multipart_required', '파일은 multipart/form-data 로 보내 주세요.');
  }
  const boundary = formBoundary(type);
  if (!boundary) throw new HttpError(400, 'bad_form', '올린 양식을 읽지 못했습니다.');
  const buf = await readBody(req, limit + FORM_OVERHEAD);
  const form = parseMultipart(buf, boundary);
  if (!form) throw new HttpError(400, 'bad_form', '올린 양식을 읽지 못했습니다.');
  return form;
}

function formBoundary(type) {
  const m = /;\s*boundary\s*=\s*(?:"([^"]{1,200})"|([^\s;"]{1,200}))/i.exec(type);
  return m ? (m[1] ?? m[2]) : null;
}

class SimpleForm {
  constructor() { this.fields = new Map(); }
  append(name, value) {
    if (!this.fields.has(name)) this.fields.set(name, []);
    this.fields.get(name).push(value);
  }
  get(name) { return this.fields.get(name)?.[0] ?? null; }
  getAll(name) { return [...(this.fields.get(name) || [])]; }
  has(name) { return this.fields.has(name); }
}

/** 올린 파일 한 칸. buffer 는 본문을 가리킨다(복사 아님). */
class FormFile {
  constructor(buffer, name, type) {
    this.buffer = buffer;
    this.name = name;
    this.type = type;
    this.size = buffer.length;
  }
  async arrayBuffer() {
    return this.buffer.buffer.slice(this.buffer.byteOffset, this.buffer.byteOffset + this.buffer.length);
  }
}

const DISP_NAME_RE = /(?:^|;)\s*name\s*=\s*(?:"([^"]*)"|([^;\s]*))/i;
const DISP_FILENAME_RE = /(?:^|;)\s*filename\s*=\s*(?:"([^"]*)"|([^;\s]*))/i;
const DISP_FILENAME_STAR_RE = /(?:^|;)\s*filename\*\s*=\s*(?:[^';\s]*'[^';\s]*')?([^;\s]*)/i;

function partHeaders(head) {
  let name = null;
  let filename = null;
  let type = '';
  for (const line of head.split('\r\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === 'content-disposition') {
      const n = DISP_NAME_RE.exec(val);
      if (n) name = n[1] ?? n[2];
      const star = DISP_FILENAME_STAR_RE.exec(val);
      if (star) {
        try { filename = decodeURIComponent(star[1]); } catch { filename = star[1]; }
      } else {
        const f = DISP_FILENAME_RE.exec(val);
        if (f) filename = f[1] ?? f[2];
      }
    } else if (key === 'content-type') {
      type = val;
    }
  }
  return { name, filename, type };
}

const MAX_FORM_PARTS = 200;
const MAX_PART_HEAD = 16 * 1024;

/** multipart 본문 나누기. 모양이 틀리면 null. */
export function parseMultipart(buf, boundary) {
  const first = Buffer.from(`--${boundary}`, 'latin1');
  const next = Buffer.from(`\r\n--${boundary}`, 'latin1');
  let pos = buf.indexOf(first);
  if (pos < 0) return null;
  pos += first.length;
  const form = new SimpleForm();
  for (let n = 0; n <= MAX_FORM_PARTS; n += 1) {
    if (buf[pos] === 0x2d && buf[pos + 1] === 0x2d) return form; // 끝 표시 --
    while (buf[pos] === 0x20 || buf[pos] === 0x09) pos += 1; // 경계 뒤 공백
    if (buf[pos] !== 0x0d || buf[pos + 1] !== 0x0a) return null;
    pos += 2;
    let headEnd;
    let dataStart;
    if (buf[pos] === 0x0d && buf[pos + 1] === 0x0a) { // 머리 없는 칸
      headEnd = pos;
      dataStart = pos + 2;
    } else {
      headEnd = buf.indexOf('\r\n\r\n', pos, 'latin1');
      dataStart = headEnd + 4;
    }
    if (headEnd < 0 || headEnd - pos > MAX_PART_HEAD) return null;
    const dataEnd = buf.indexOf(next, dataStart);
    if (dataEnd < 0) return null;
    const p = partHeaders(buf.subarray(pos, headEnd).toString('utf8'));
    if (p.name != null) {
      const body = buf.subarray(dataStart, dataEnd);
      form.append(p.name, p.filename != null ? new FormFile(body, p.filename, p.type) : body.toString('utf8'));
    }
    pos = dataEnd + next.length;
  }
  return null; // 칸이 너무 많음
}

// ── 녹음 올리기 동시 처리 수(화면 올리기 · ingest · 시드 음성이 한 카운터를 같이 쓴다) ─────
const MAX_UPLOADS_IN_FLIGHT = 2;
let uploadsInFlight = 0;

/**
 * 녹음 올리기 한 건을 fn 으로 처리한다. 본문을 읽기 전에
 *  ① Content-Length 가 파일 한도 + 양식 몫보다 크면 바로 413
 *  ② 이미 2건을 받는 중이면 본문을 읽지 않고 바로 503 busy
 * fn 이 끝나면(성공 · 실패 모두) 자리를 돌려준다. 한 건이 본문 · 변환까지 수십 MB 를 잡으므로 메모리를 지킨다.
 */
export async function withUploadSlot(req, fn) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > config.maxUploadBytes + FORM_OVERHEAD) {
    throw new HttpError(413, 'too_large', `파일이 너무 큽니다(최대 ${Math.round(config.maxUploadBytes / 1024 / 1024)}MB).`);
  }
  if (uploadsInFlight >= MAX_UPLOADS_IN_FLIGHT) {
    throw new HttpError(503, 'busy', '지금 다른 녹음을 받는 중입니다. 잠시 뒤 다시 올려 주세요.');
  }
  uploadsInFlight += 1;
  try {
    return await fn();
  } finally {
    uploadsInFlight -= 1;
  }
}

/** 지금 받는 중인 녹음 수(시험 · 상태 보기용) */
export function uploadsInProgress() { return uploadsInFlight; }

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
      r.keys.forEach((k, i) => {
        try {
          params[k] = decodeURIComponent(m[i + 1]);
        } catch {
          throw new HttpError(400, 'bad_url', '주소가 잘못됐습니다.'); // %E0%A4%A 같은 잘못된 인코딩
        }
      });
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

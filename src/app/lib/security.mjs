// 보안: 응답 헤더(CSP 등) · IP 별 빈도 제한 · 하루 전체 상한 · 관리자 세션 · 토큰 비교.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config, secret } from './config.mjs';
import { db } from './db.mjs';
import { HttpError } from './http.mjs';

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

export function securityHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000');
}

/** 상태를 바꾸는 요청이 다른 사이트에서 왔으면 막는다(Origin 이 있을 때만 비교). */
export function checkOrigin(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.origin;
  if (!origin) return; // 일꾼·ingest 같은 서버 간 호출은 Origin 이 없다
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    const o = new URL(origin);
    if (o.host === host) return;
    if (config.publicBaseUrl && origin === config.publicBaseUrl) return;
  } catch { /* 아래에서 막음 */ }
  throw new HttpError(403, 'bad_origin', '다른 사이트에서 보낸 요청은 받지 않습니다.');
}

// ── IP 해시: 원래 IP 는 저장하지 않는다 ─────────────────────────────
const IP_SALT = createHash('sha256').update('callnote-ip:' + (secret('ADMIN_PASSCODE') || 'demo') + ':' + config.dataDir).digest();
export function ipHash(ip) {
  return createHmac('sha256', IP_SALT).update(String(ip)).digest('hex').slice(0, 16);
}

// ── IP 별 빈도 제한(메모리, 미끄러지는 창) ───────────────────────────
const buckets = new Map(); // key -> number[] (시각 ms)
/**
 * @param {string} kind 'ai' | 'upload' | 'login' | 'trial' 등
 * @param {string} ip
 * @param {number} max 창 안에서 허용할 횟수
 * @param {number} windowMs
 */
export function rateLimit(kind, ip, max, windowMs) {
  const key = kind + ':' + ip;
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    const retry = Math.ceil((windowMs - (now - arr[0])) / 1000);
    buckets.set(key, arr);
    throw new HttpError(429, 'rate_limited', `잠시 뒤에 다시 해 주세요(약 ${retry}초 뒤). 누구나 쓰는 데모라 횟수를 제한합니다.`);
  }
  arr.push(now);
  buckets.set(key, arr);
}
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of buckets) if (!arr.length || now - arr[arr.length - 1] > 3600_000) buckets.delete(k);
}, 600_000).unref();

// 빈도 제한 기본값(분당/시간당)
export const LIMITS = {
  ai: { max: 12, windowMs: 10 * 60_000 },       // AI 호출: IP 당 10분에 12번
  upload: { max: 5, windowMs: 60 * 60_000 },     // 녹음 올리기: IP 당 1시간에 5건
  live: { max: 10, windowMs: 60 * 60_000 },      // 실시간 받아쓰기 저장: 1시간 10건
  login: { max: 5, windowMs: 10 * 60_000 },      // 관리자 로그인 시도
  trial: { max: 3, windowMs: 60 * 60_000 },      // 체험 신청
  write: { max: 120, windowMs: 10 * 60_000 },    // 카드 고치기 등 일반 쓰기
};
export function limit(kind, ip) {
  const l = LIMITS[kind];
  if (l) rateLimit(kind, ip, l.max, l.windowMs);
}

// ── 하루 전체 상한(DB 에 남겨 재시작해도 유지) ─────────────────────────
export function kstDay(date = new Date()) {
  const d = new Date(date.getTime() + 9 * 3600_000);
  return d.toISOString().slice(0, 10);
}
export function usageCount(kind, day = kstDay()) {
  return db().prepare('SELECT count FROM usage WHERE day = ? AND kind = ?').get(day, kind)?.count ?? 0;
}
/** 하루 상한을 넘으면 429, 아니면 1 늘린다 */
export function takeDaily(kind, max) {
  const day = kstDay();
  const n = usageCount(kind, day);
  if (n >= max) {
    throw new HttpError(429, 'daily_limit', '오늘 데모에서 쓸 수 있는 양을 다 썼습니다. 내일 다시 해 주세요.');
  }
  db().prepare('INSERT INTO usage(day, kind, count) VALUES(?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET count = count + 1').run(day, kind);
}

// ── 토큰 비교 ─────────────────────────────────────────────────────
export function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb) && String(a).length === String(b).length;
}

/** Authorization: Bearer <토큰> 확인. 서버에 토큰이 없으면 503. */
export function requireBearer(req, secretName) {
  const expected = secret(secretName);
  if (!expected) throw new HttpError(503, 'disabled', '이 기능은 서버에서 꺼져 있습니다.');
  const h = String(req.headers.authorization || '');
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m || !safeEqual(m[1].trim(), expected)) throw new HttpError(401, 'unauthorized', '인증이 필요합니다.');
}

// ── 관리자 세션(쿠키) ──────────────────────────────────────────────
const sessions = new Map(); // token -> expiresAt
const ADMIN_COOKIE = 'cn_admin';
const SESSION_MS = 12 * 3600_000;

export function adminLogin(passcode) {
  const expected = secret('ADMIN_PASSCODE');
  if (!expected) throw new HttpError(503, 'disabled', '서버에 관리자 암호가 설정되지 않았습니다.');
  if (!safeEqual(String(passcode || ''), expected)) throw new HttpError(401, 'wrong_passcode', '암호가 맞지 않습니다.');
  const token = randomBytes(24).toString('base64url');
  sessions.set(token, Date.now() + SESSION_MS);
  return token;
}
export function adminCookie(token, req) {
  const secure = String(req.headers['x-forwarded-proto'] || '').includes('https') || config.publicBaseUrl.startsWith('https');
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}`;
}
export function adminLogoutCookie() {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
function readCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}
export function isAdmin(req) {
  const token = readCookie(req, ADMIN_COOKIE);
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(token); return false; }
  return true;
}
export function adminLogout(req) {
  const token = readCookie(req, ADMIN_COOKIE);
  if (token) sessions.delete(token);
}
export function requireAdmin(req) {
  if (!isAdmin(req)) throw new HttpError(401, 'admin_required', '관리자 암호로 들어와야 할 수 있습니다.');
}

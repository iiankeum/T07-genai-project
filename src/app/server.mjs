// T07 7번 아이템 「AI 전화 주문 받아쓰기」(가칭 콜노트) 데모 서버 진입점.
// 실행: node src/app/server.mjs   (빌드 단계 없음 · Node 24 · ESM)
// 환경변수와 API 는 src/app/README.md, 구조는 src/app/docs/설계.md 를 본다.
import http from 'node:http';
import { readdirSync, statSync, createReadStream, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { config, APP_DIR } from './lib/config.mjs';
import { db, globalDb, withWorkspace } from './lib/db.mjs';
import { Router, HttpError, sendJson, clientIp } from './lib/http.mjs';
import { securityHeaders, checkOrigin } from './lib/security.mjs';
import { countVisit, cleanSrc } from './lib/visits.mjs';
import { accountDb, me, browserAccess, productAccess, demoAccess, requireRole, workerAccess, ingestAccess } from './lib/auth.mjs';
import { domainFor } from './public/js/domain.js';

const PUBLIC_DIR = path.join(APP_DIR, 'public');
const ROUTES_DIR = path.join(APP_DIR, 'routes');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

export async function buildRouter() {
  const router = new Router();
  const files = readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.mjs')).sort();
  const starters = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(ROUTES_DIR, f)).href);
    if (typeof mod.register === 'function') mod.register(router);
    if (typeof mod.start === 'function') starters.push({ name: f, start: mod.start });
  }
  return { router, starters };
}

const ACTOR_BOUND_AUTH_MUTATIONS = new Set([
  '/api/auth/profile', '/api/auth/preferences', '/api/auth/password/change',
  '/api/auth/workspaces', '/api/auth/workspaces/switch', '/api/auth/invite/accept', '/api/auth/logout',
]);

function handleApi(route, ctx) {
  const { pattern, handler } = route;
  const { req } = ctx;
  if (req.method !== 'GET' && req.method !== 'HEAD' && ACTOR_BOUND_AUTH_MUTATIONS.has(pattern)) {
    const expectations = [req.headers['x-ahmatda-actor'], ctx.query?.actor].filter(value => value !== undefined);
    if (expectations.length && expectations.some(value => value !== me(req).user?.id)) {
      throw new HttpError(409, 'actor_changed', '다른 화면에서 로그인 계정이 바뀌었습니다. 입력 내용을 확인하고 새로고침한 뒤 다시 시도해 주세요.');
    }
  }
  if (pattern === '/healthz' || pattern.startsWith('/api/auth/') ||
      ['/api/trial', '/api/trial/policy', '/api/trial-signup'].includes(pattern)) return handler(ctx);
  if (pattern === '/api/meta') {
    const access = browserAccess(req);
    return access ? withWorkspace(access, () => handler({ ...ctx, access })) : handler({ ...ctx, access: null });
  }
  if (pattern === '/api/ingest') {
    const access = ingestAccess(req);
    return withWorkspace(access, () => handler({ ...ctx, access }));
  }
  if (pattern.startsWith('/api/worker/') && (pattern !== '/api/worker/status' || req.headers.authorization !== undefined)) {
    const access = workerAccess(req);
    return withWorkspace(access, () => handler({ ...ctx, access }));
  }
  if (pattern.startsWith('/api/admin/')) {
    if (!config.demoMode && ['/api/admin/reset', '/api/admin/seed-audio'].includes(pattern)) {
      throw new HttpError(403, 'demo_required', '데모 모드에서 할 수 있습니다.');
    }
    return config.demoMode ? withWorkspace(demoAccess(), () => handler(ctx)) : handler(ctx);
  }
  const access = productAccess(req);
  // Expectations bind an already-rendered browser view, not authentication itself.
  // Check both carriers so a fresh header cannot override an old media/export URL.
  const expectedActors = [req.headers['x-ahmatda-actor'], ctx.query?.actor].filter(value => value !== undefined);
  if (expectedActors.some(value => value !== access.user?.id)) {
    throw new HttpError(409, 'actor_changed', '다른 화면에서 로그인 계정이 바뀌었습니다. 입력 내용을 확인하고 새로고침한 뒤 다시 시도해 주세요.');
  }
  const expectedWorkspaces = [req.headers['x-ahmatda-workspace'], ctx.query?.workspace].filter(value => value !== undefined);
  if (expectedWorkspaces.some(value => value !== access.workspace.id)) {
    throw new HttpError(409, 'workspace_changed', '다른 화면에서 워크스페이스가 바뀌었습니다. 새로고침한 뒤 다시 시도해 주세요.');
  }
  return withWorkspace(access, () => {
    const readOnly = req.method === 'GET' || req.method === 'HEAD';
    if (!readOnly) {
      if (pattern.startsWith('/api/settings/') || req.method === 'DELETE' && pattern === '/api/calls/:id') requireRole('admin');
      else if (/^\/api\/cards\/:callId\/(ship|unship)$/.test(pattern)) requireRole('admin', 'shipping');
      else if (pattern.startsWith('/api/cards/') || pattern.startsWith('/api/live/') || pattern.startsWith('/api/calls/')) {
        requireRole('admin', 'reception');
      } else if (pattern === '/api/briefing') requireRole('admin', 'reception', 'shipping');
    }
    return handler({ ...ctx, access });
  });
}

function serveStatic(req, res, pathname, search = '') {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, 'bad_url', '주소가 잘못됐습니다.'); // %E0%A4%A 같은 잘못된 인코딩
  }
  if (rel === '/' || rel === '') rel = '/index.html';
  // 폴더 주소(/intro/)는 그 안의 index.html
  let file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep) && file !== PUBLIC_DIR) return false;
  try {
    let st = statSync(file);
    if (st.isDirectory()) {
      // 끝 / 가 없으면(/intro) / 를 붙인 주소로 보낸다 — 그래야 intro.js · privacy.html 같은 상대 주소가 맞게 풀린다.
      // 앞의 / 는 하나로 줄인다(//host 꼴의 다른 사이트 주소가 되지 않게).
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { Location: `/${pathname.replace(/^\/+/, '')}/${search}`, 'Cache-Control': 'no-cache' });
        res.end();
        return true;
      }
      file = path.join(file, 'index.html');
      st = statSync(file);
    }
    if (!st.isFile()) return false;
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag });
      res.end();
      return true;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      // 빌드 없이 파일을 그대로 내므로 배포 직후 옛 js · css 가 섞이지 않게 늘 다시 확인(ETag 로 304)
      'Cache-Control': ['.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff2', '.svg'].includes(ext) ? 'public, max-age=86400' : 'no-cache',
      ETag: etag,
    });
    if (req.method === 'HEAD') { res.end(); return true; }
    createReadStream(file).pipe(res);
    return true;
  } catch {
    return false;
  }
}

export function createApp(router) {
  return async function handler(req, res) {
    const started = Date.now();
    securityHeaders(res);
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      sendJson(res, 400, { error: 'bad_url' });
      return;
    }
    const pathname = url.pathname;
    try {
      if (pathname === '/healthz' || pathname.startsWith('/api/')) {
        checkOrigin(req);
        const m = router.match(req.method, pathname);
        if (!m) throw new HttpError(404, 'not_found', '없는 주소입니다.');
        if (m.methodNotAllowed) throw new HttpError(405, 'method_not_allowed', '허용하지 않는 방식입니다.');
        const ctx = {
          req, res, url, params: m.params,
          query: Object.fromEntries(url.searchParams),
          ip: clientIp(req),
        };
        const out = await handleApi(m.route, ctx);
        if (out !== undefined && !res.headersSent) sendJson(res, 200, out);
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed', '허용하지 않는 방식입니다.');
      // 방문 수(숫자만): 소개 페이지 · 데모 첫 화면
      if (req.method === 'GET') {
        if (pathname === '/intro/' || pathname === '/intro/index.html') countVisit('intro', cleanSrc(url.searchParams.get('src')), clientIp(req));
        else if (pathname === '/' || pathname === '/index.html') countVisit('demo', cleanSrc(url.searchParams.get('src')) || (url.searchParams.get('from') === 'intro' ? 'intro' : ''), clientIp(req));
      }
      if (serveStatic(req, res, pathname, url.search)) return;
      // 모르는 화면 주소는 첫 화면으로(해시 라우팅이라 보통 생기지 않음)
      if (!path.extname(pathname) && serveStatic(req, res, '/')) return;
      throw new HttpError(404, 'not_found', '없는 주소입니다.');
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (err instanceof HttpError) {
        if (status >= 500) console.warn(`[http] ${status} ${err.code} ${req.method} ${pathname}`);
      } else {
        console.error(`[error] ${req.method} ${pathname}:`, err?.stack || err);
      }
      if (!res.headersSent) {
        sendJson(res, status, {
          error: err instanceof HttpError ? err.code : 'server_error',
          message: err instanceof HttpError ? err.publicMessage : '서버에서 문제가 생겼습니다. 잠시 뒤 다시 해 주세요.',
        });
      } else {
        res.end();
      }
    } finally {
      const ms = Date.now() - started;
      if (pathname.startsWith('/api/') && !pathname.startsWith('/api/worker/') && ms > 3000) {
        console.log(`[slow] ${req.method} ${pathname} ${ms}ms`);
      }
    }
  };
}

async function main() {
  domainFor(process.env.AHMATDA_DOMAIN);
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  globalDb(); // 이전 업무 자료와 운영 통계
  accountDb(); // 계정과 워크스페이스 연결
  if (config.demoMode) db(); // 가짜 데이터 전용 저장소
  const { router, starters } = await buildRouter();
  for (const s of starters) {
    try {
      if (s.name === 'admin.mjs') {
        if (config.demoMode) await withWorkspace(demoAccess(), s.start);
      } else await s.start();
    } catch (e) { console.error(`[start] ${s.name} 실패:`, e?.message || e); }
  }
  const server = http.createServer(createApp(router));
  server.requestTimeout = 120_000;
  server.headersTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  server.listen(config.port, config.host, () => {
    console.log(`[callnote] http://${config.host}:${config.port} · commit ${config.commit.slice(0, 7)} · data ${config.dataDir}`);
  });
  const stop = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain || process.env.CALLNOTE_FORCE_MAIN === '1') {
  main().catch((e) => { console.error(e); process.exit(1); });
}

export { PUBLIC_DIR };

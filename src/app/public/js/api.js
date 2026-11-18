// 서버 API 부르기. 실패하면 ApiError(한국어 message) 를 던진다.
// 세션 쿠키는 탭 사이에 공유되지만 열린 화면의 작업공간은 페이지를 다시 열 때까지 고정한다.
let viewWorkspace = null;
let viewActor = null;
const workspaceChanged = (reason = 'workspace_changed') => window.dispatchEvent(new CustomEvent('ahmatda:workspace-changed', { detail: { reason } }));
const actorBoundAuthMutations = new Set([
  '/api/auth/profile', '/api/auth/preferences', '/api/auth/password/change',
  '/api/auth/workspaces', '/api/auth/workspaces/switch', '/api/auth/invite/accept', '/api/auth/logout',
]);
const productRequest = (path) => path.startsWith('/api/') && path !== '/api/meta' && !path.startsWith('/api/auth/') && !path.startsWith('/api/admin/');

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || '문제가 생겼습니다. 잠시 뒤 다시 해 주세요.');
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, { query, body, signal } = {}) {
  let url = path;
  if (query) {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  const opts = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin', signal };
  if (viewWorkspace && productRequest(path)) opts.headers['X-Ahmatda-Workspace'] = viewWorkspace;
  if (viewActor && (productRequest(path) || (method !== 'GET' && method !== 'HEAD' && actorBoundAuthMutations.has(path)))) opts.headers['X-Ahmatda-Actor'] = viewActor;
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(0, 'network', '인터넷 연결을 확인해 주세요.');
  }
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    const code = data?.error || 'http_' + res.status;
    if (code === 'workspace_changed' || code === 'actor_changed') workspaceChanged(code);
    const msg = data?.message || (res.status === 429 ? '잠시 뒤에 다시 해 주세요.' : res.status >= 500 ? '서버에서 문제가 생겼습니다. 잠시 뒤 다시 해 주세요.' : '요청을 처리하지 못했습니다.');
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new CustomEvent('ahmatda:session-expired', { detail: { returnTo: location.hash.slice(1) || '/today' } }));
    }
    throw new ApiError(res.status, code, msg);
  }
  return data;
}

export const api = {
  /** audio·다운로드 링크는 헤더를 넣을 수 없어 같은 작업공간 기대값을 URL에 넣는다. */
  url(path) {
    const url = new URL(path, location.origin);
    if (url.origin !== location.origin || !productRequest(url.pathname)) return path;
    if (viewWorkspace) url.searchParams.set('workspace', viewWorkspace);
    if (viewActor) url.searchParams.set('actor', viewActor);
    return url.pathname + url.search + url.hash;
  },
  get: (path, query, opts) => request('GET', path, { query, ...opts }),
  post: (path, body, opts) => request('POST', path, { body: body ?? {}, ...opts }),
  patch: (path, body, opts) => request('PATCH', path, { body: body ?? {}, ...opts }),
  del: (path, opts) => request('DELETE', path, { ...opts }),
  /** 파일 올리기(진행률 콜백). formData 는 FormData. */
  upload(path, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', path);
      xhr.timeout = 120_000;
      xhr.setRequestHeader('Accept', 'application/json');
      if (viewWorkspace && productRequest(path)) xhr.setRequestHeader('X-Ahmatda-Workspace', viewWorkspace);
      if (viewActor && productRequest(path)) xhr.setRequestHeader('X-Ahmatda-Actor', viewActor);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onerror = () => reject(new ApiError(0, 'network', '인터넷 연결을 확인해 주세요.'));
      xhr.ontimeout = () => reject(new ApiError(0, 'timeout', '전송이 지연되고 있습니다. 연결을 확인한 뒤 다시 시도해 주세요.'));
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch { data = null; }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else {
          if (data?.error === 'workspace_changed' || data?.error === 'actor_changed') workspaceChanged(data.error);
          if (xhr.status === 401) window.dispatchEvent(new CustomEvent('ahmatda:session-expired', { detail: { returnTo: location.hash.slice(1) || '/upload' } }));
          reject(new ApiError(xhr.status, data?.error || 'http_' + xhr.status, data?.message || '올리지 못했습니다.'));
        }
      };
      xhr.send(formData);
    });
  },
};

// ── 메타(데모 표시 · AI 켜짐 · 일꾼 상태) ─────────────────────────────
let metaCache = null;
let metaAt = 0;
export async function getMeta(force = false) {
  if (!force && metaCache && Date.now() - metaAt < 15_000) return metaCache;
  try {
    const incoming = await api.get('/api/meta');
    const incomingWorkspace = incoming.access?.workspace?.id;
    const incomingActor = incoming.access?.user?.id;
    if (viewActor && incomingActor !== viewActor) {
      workspaceChanged('actor_changed');
      return metaCache;
    }
    if (viewWorkspace && incomingWorkspace && incomingWorkspace !== viewWorkspace) {
      workspaceChanged();
      return metaCache;
    }
    if (!viewWorkspace && incomingWorkspace) viewWorkspace = incomingWorkspace;
    if (!viewActor && incomingActor) viewActor = incomingActor;
    metaCache = incoming;
    metaAt = Date.now();
  } catch {
    metaCache = metaCache || { aiEnabled: false, worker: { online: false, queue: { waiting: 0, working: 0 } } };
  }
  return metaCache;
}

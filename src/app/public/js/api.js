// 서버 API 부르기. 실패하면 ApiError(한국어 message) 를 던진다.

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
    const msg = data?.message || (res.status === 429 ? '잠시 뒤에 다시 해 주세요.' : res.status >= 500 ? '서버에서 문제가 생겼습니다. 잠시 뒤 다시 해 주세요.' : '요청을 처리하지 못했습니다.');
    throw new ApiError(res.status, code, msg);
  }
  return data;
}

export const api = {
  get: (path, query, opts) => request('GET', path, { query, ...opts }),
  post: (path, body, opts) => request('POST', path, { body: body ?? {}, ...opts }),
  patch: (path, body, opts) => request('PATCH', path, { body: body ?? {}, ...opts }),
  del: (path, opts) => request('DELETE', path, { ...opts }),
  /** 파일 올리기(진행률 콜백). formData 는 FormData. */
  upload(path, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', path);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onerror = () => reject(new ApiError(0, 'network', '인터넷 연결을 확인해 주세요.'));
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch { data = null; }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new ApiError(xhr.status, data?.error || 'http_' + xhr.status, data?.message || '올리지 못했습니다.'));
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
    metaCache = await api.get('/api/meta');
    metaAt = Date.now();
  } catch {
    metaCache = metaCache || { aiEnabled: false, worker: { online: false, queue: { waiting: 0, working: 0 } } };
  }
  return metaCache;
}

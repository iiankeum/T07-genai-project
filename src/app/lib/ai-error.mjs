import { HttpError } from './http.mjs';

const AI_ERROR_TEXT = {
  no_key: 'AI 키 없음',
  refused: 'AI 가 답하지 않았습니다',
  bad_output: 'AI 답을 읽지 못했습니다',
  api_error: 'AI 를 부르지 못했습니다',
  rate_limited: 'AI 사용량이 많아 잠시 뒤에 다시 해 주세요',
  fixture_unavailable: '가짜 테스트 응답이 준비된 대화가 아닙니다. 샘플 대화로 해 보세요.',
  local_unavailable: '앱 서버와 같은 기기에서 Ollama가 실행 중인지 확인해 주세요.',
  local_model_unavailable: 'Ollama에 설정된 로컬 모델이 설치되어 있는지 확인해 주세요.',
  local_timeout: '로컬 AI 응답 시간이 길어졌습니다. 다시 시도해 주세요.',
};

export class AiError extends Error {
  /** @param {keyof typeof AI_ERROR_TEXT} code */
  constructor(code, message, { retryAfterSeconds } = {}) {
    super(message || AI_ERROR_TEXT[code] || 'AI 오류');
    this.name = 'AiError';
    this.code = code;
    if (code === 'rate_limited' && Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds >= 0) {
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
}

/** AiError → 화면용 HttpError (routes 에서 throw 한다). 다른 오류는 그대로. */
export function aiHttpError(err) {
  if (err instanceof HttpError) return err;
  if (!(err instanceof AiError)) return new HttpError(502, 'ai_failed', 'AI 를 부르지 못했습니다. 잠시 뒤 다시 해 주세요.');
  switch (err.code) {
    case 'no_key': return new HttpError(503, 'ai_disabled', '서버에서 AI 기능을 켜 주세요.');
    case 'fixture_unavailable': return new HttpError(422, 'fixture_unavailable', AI_ERROR_TEXT.fixture_unavailable);
    case 'rate_limited': return new HttpError(429, 'ai_busy', Number.isSafeInteger(err.retryAfterSeconds)
      ? `AI 사용량이 많습니다. 제공업체 안내에 따라 ${err.retryAfterSeconds}초 후 직접 다시 시도해 주세요.`
      : 'AI 사용량이 많습니다. 잠시 뒤에 다시 해 주세요.');
    case 'refused': return new HttpError(422, 'ai_refused', 'AI 가 이 글에는 답하지 않았습니다.');
    case 'bad_output': return new HttpError(502, 'ai_bad_output', 'AI 답을 읽지 못했습니다. 다시 해 주세요.');
    case 'local_unavailable':
    case 'local_model_unavailable': return new HttpError(503, err.code, err.message);
    case 'local_timeout': return new HttpError(504, err.code, err.message);
    default: return new HttpError(502, 'ai_failed', 'AI 를 부르지 못했습니다. 잠시 뒤 다시 해 주세요.');
  }
}

/** 제공업체 Retry-After만 읽는다. 원문 헤더·오류 본문은 보관하거나 화면에 보내지 않는다.
 * reset 헤더는 제한 종류/남은 할당량을 모르면 재시도 가능 시각을 확정할 수 없어 사용하지 않는다.
 */
export function retryAfterSeconds(headers, now = Date.now()) {
  const raw = headers?.get?.('retry-after');
  if (typeof raw !== 'string' || !Number.isFinite(now)) return undefined;
  const value = raw.trim();
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isSafeInteger(seconds) ? seconds : undefined;
  }
  // Date.parse의 숫자/느슨한 날짜 추측을 막고 정상 IMF-fixdate만 받는다.
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toUTCString() !== value || timestamp <= now) return undefined;
  const seconds = Math.ceil((timestamp - now) / 1000);
  return Number.isSafeInteger(seconds) ? seconds : undefined;
}

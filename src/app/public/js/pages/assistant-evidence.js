// 서버가 검증한 답변 인용만 사용한다. 모델이 제안한 동작/주소/선택자는 읽지 않는다.
export function evidenceResult({ question, response, embedded, active, requestCallId, selectedCallId, viewCallId, workspaceUnchanged, routeUnchanged }) {
  if (!embedded || !active || !workspaceUnchanged || !routeUnchanged || typeof question !== 'string') return null;
  if (!/수량/u.test(question) || !/변경|바꾼|바뀐/u.test(question) || !/근거|대목/u.test(question) || !/(?:찾아|보여|열어)\s*(?:줘|주세요|봐|줄래)?[.!?]*\s*$|이동해\s*(?:줘|주세요)[.!?]*\s*$/u.test(question)) return null;
  if (/말아|말고|않|마세요|하지\s*마|찾지|보여주지|이동하지|열지/u.test(question)) return null;
  if (typeof requestCallId !== 'string' || !requestCallId || requestCallId !== selectedCallId || requestCallId !== viewCallId) return null;
  if (response?.found !== true || !Array.isArray(response.citations) || !response.citations.length) return null;
  const unique = new Map();
  for (const source of response.citations) {
    if (!source || source.kind === 'knowledge' || source.callId !== requestCallId ||
        !Number.isSafeInteger(source.segIndex) || source.segIndex < 0 ||
        typeof source.at !== 'number' || !Number.isFinite(source.at) || source.at < 0 ||
        typeof source.quote !== 'string' || !source.quote.trim() || source.quote.length > 2000) return null;
    const value = { callId: requestCallId, at: source.at, segIndex: source.segIndex, quote: source.quote, field: 'qty' };
    unique.set(JSON.stringify(value), value);
  }
  // 여러 근거 중 무엇을 열지 모델 답변 문장으로 추측하지 않는다.
  return unique.size === 1 ? [...unique.values()][0] : null;
}

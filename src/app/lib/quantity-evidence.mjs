// 명확한 「같은 품목명 + 수량 + 개」만 검사한다. 단위 환산/정정 위치 추측은 하지 않는다.
const WORDS = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10 };
const COUNT = '(?:[1-9][0-9]*|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)';
// ‘개월/개국/개씩’은 개 단위로 읽지 않는다. 허용한 조사·어미 뒤도 경계를 요구한다.
const UNIT_END = '(?=$|[\\s,.!?…]|(?:요|로|를|만|가|는|입니다|예요|에요)(?=$|[\\s,.!?…]))';
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function contradictoryQuantityEvidence({ part, qty, quote } = {}) {
  if (!part || !quote || !Number.isInteger(qty)) return null;
  // 부정·정정·범위·근사·묶음은 단일 수량으로 해석하지 않는다.
  if (/말고|아니|취소|빼고|제외|대신|정도|대략|이상|이하|세트|묶음|박스|[~～−–-]/u.test(quote)) return null;
  const mentions = [...quote.matchAll(new RegExp(`(?:^|[^\\p{L}\\p{N}_])(${COUNT})\\s*개${UNIT_END}`, 'gu'))];
  if (mentions.length !== 1) return null;
  const match = quote.match(new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escape(part.trim())}\\s+(${COUNT})\\s*개${UNIT_END}`, 'u'));
  if (!match) return null;
  const heard = WORDS[match[1]] ?? Number(match[1]);
  return Number.isSafeInteger(heard) && heard !== qty ? heard : null;
}

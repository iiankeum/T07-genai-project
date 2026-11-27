// 서버와 화면에서 같은 업종 프로필을 사용한다. 저장된 카드에는 프로필 버전이 남는다.
export const DEFAULT_DOMAIN = 'automotive@1';
export const CALL_TYPES = Object.freeze(['주문', '배송 문의', '반품·교환', '재고·단가 문의', '기타']);
export const PART_NO_RE = /^[0-9A-Z]{5}-?[0-9A-Z]{3,6}$/;
export const PLATE_RE = /^\d{2,3}[가-힣]\d{4}$/;
export const PLATE_FORMAT_MESSAGE = '차번호 형식이 맞지 않아 비웠습니다 — 들어 보세요';

const CARD_TEXT_LABELS = {
  contact: '담당자', modelYear: '연식', plate: '차량 번호', due: '요청 일정', delivery: '받는 방법',
  note: '메모', side: '위치',
};

const automotive = Object.freeze({
  id: DEFAULT_DOMAIN,
  sttContext: '자동차 부품 대리점 주문 전화입니다.',
  partNoCue: '품번',
  concepts: Object.freeze([
    { id: 'customer', label: '거래처', aliases: ['공업사', '카센터'] },
    { id: 'carModel', label: '차종', aliases: ['모델'] },
    { id: 'part', label: '부품', aliases: ['부속', '품목'] },
    { id: 'partNo', label: '품번', aliases: ['부품 번호'] },
    { id: 'qty', label: '수량', aliases: ['개수'] },
  ]),
  relations: Object.freeze([
    { source: 'part', predicate: '적용 차종', target: 'carModel' },
    { source: 'part', predicate: '품번', target: 'partNo' },
    { source: 'part', predicate: '주문 수량', target: 'qty' },
  ]),
  orderFields: Object.freeze({ customer: '거래처', carModel: '차종' }),
  itemFields: Object.freeze({ part: '부품 이름', qty: '수량', partNo: '품번' }),
  textLimits: Object.freeze({
    customer: 50, contact: 30, carModel: 30, modelYear: 4, plate: 30, due: 60,
    delivery: 60, note: 500, part: 50, side: 20, partNo: 40,
  }),
  modelYearPattern: /^[0-9]{4}$/,
  partNoPattern: /^[A-Z0-9-]+$/,
  partNoTypical: PART_NO_RE,
  platePattern: PLATE_RE,
  qtyMin: 1,
  qtyMax: 999,
});

export const DOMAINS = Object.freeze({ [automotive.id]: automotive });
export function domainFor(id) {
  const version = id || DEFAULT_DOMAIN;
  if (!Object.hasOwn(DOMAINS, version)) throw new Error('지원하는 업종 프로필을 선택해 주세요.');
  return DOMAINS[version];
}

export function extractionDomain(id) {
  const domain = domainFor(id);
  return { context: domain.sttContext, concepts: domain.concepts, relations: domain.relations };
}

export const normalizePartNo = (value) => String(value ?? '').toUpperCase().replace(/\s+/g, '');
export const warningId = (warning, index) => warning?.id || 'warning-' + index;
export const itemId = (item, index) => item?.id || 'legacy-' + index;
export function reviewKey(warning, items) {
  if (Number.isInteger(warning?.item) && items[warning.item]) return 'item:' + itemId(items[warning.item], warning.item);
  return warning?.field || 'other';
}

export function pendingWarnings(card) {
  return (card?.unsure || []).filter((entry) => entry && !entry.reviewedAt && entry.blocking !== false
    && !(entry.field === 'plate' && entry.reason === PLATE_FORMAT_MESSAGE));
}

export function isShipTarget(card) {
  return Boolean(card && ['주문', '반품·교환'].includes(card.callType || '주문') && card.items?.some((item) => item?.part));
}

export function acceptsPartNo(value, domain) {
  return domain.partNoPattern.test(value) && /[A-Z0-9]/.test(value);
}

export function textIssue(field, value, domain) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (field === 'modelYear' && domain.modelYearPattern && !domain.modelYearPattern.test(text)) {
    return { code: 'bad_year', message: '연식은 네 자리 연도로 입력해 주세요.' };
  }
  const limit = domain.textLimits[field];
  if (limit === undefined || text.length <= limit) return null;
  const label = domain.orderFields[field] || domain.itemFields[field] || CARD_TEXT_LABELS[field] || field;
  return { code: 'text_too_long', message: label + ' 입력은 ' + limit + '자 이내여야 합니다.' };
}

export function confirmationIssues(card) {
  const domain = domainFor(card?.domainVersion);
  const issues = [];
  const add = (code, message, field, item) => issues.push({ code, message, field, item });
  const ask = card?.askBack?.length || 0;
  if (ask) add('ask_back_left', '다시 물어볼 것 ' + ask + '개를 해결해 주세요.', 'askBack');
  const pending = pendingWarnings(card);
  if (pending.length) add('unsure_left', '재확인 필요 ' + pending.length + '곳을 확인해 주세요.', reviewKey(pending[0], card?.items || []));

  const order = (card?.callType || '주문') === '주문';
  if (order) {
    for (const [key, label] of Object.entries(domain.orderFields)) {
      if (!String(card?.[key] ?? '').trim()) add('required_field', label + '을 입력해 주세요.', key);
    }
  }
  for (const key of Object.keys(domain.textLimits)) {
    if (['part', 'side', 'partNo'].includes(key)) continue;
    const issue = textIssue(key, card?.[key], domain);
    if (issue) add(issue.code, issue.message, key);
  }

  const items = card?.items || [];
  if (order && !items.length) add('no_items', '부품을 한 줄 이상 추가해 주세요.', 'items');
  items.forEach((item, index) => {
    const row = (index + 1) + '번째 부품의 ';
    const key = 'item:' + itemId(item, index);
    for (const field of ['part', 'side', 'partNo']) {
      const issue = textIssue(field, item?.[field], domain);
      if (issue) add(issue.code, row + issue.message, key, field);
    }
    if (order && (!String(item?.part ?? '').trim() || item.part === '(부품 이름 없음)')) {
      add('required_part', row + domain.itemFields.part + '을 입력해 주세요.', key, 'part');
    }
    const qty = item?.qty;
    if ((order || qty != null) && (!Number.isInteger(qty) || qty < domain.qtyMin || qty > domain.qtyMax)) {
      add('bad_qty', row + domain.itemFields.qty + '은 ' + domain.qtyMin + '~' + domain.qtyMax + ' 사이 정수로 입력해 주세요.', key, 'qty');
    }
    const number = normalizePartNo(item?.partNo ?? item?.part_no);
    if (order && !number) add('missing_part_no', row + domain.itemFields.partNo + '을 입력해 주세요.', key, 'partNo');
    else if (number && !acceptsPartNo(number, domain)) add('bad_part_no', row + domain.itemFields.partNo + '은 영문·숫자·하이픈으로 입력해 주세요.', key, 'partNo');
  });
  return issues;
}

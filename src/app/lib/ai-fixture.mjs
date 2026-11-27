// 네트워크 없이 API 경로를 시험하는 가짜 응답. 등록한 예시 통화에만 카드를 돌려준다.
import { LIVE_EXAMPLES, LIVE_SAMPLE } from '../public/js/live-samples.js';

export const FIXTURE_MODEL = 'fixture-v1';
export const OFFLINE_WORKER_LINES = [
  '가짜별정비소입니다. 아반떼 CN7 22년식 앞범퍼 두 개 주세요.',
  '품번은 86511-A0000이고 오늘 오후까지 배송해 주세요.',
];

function item(part, qty, quote, { side = null, partNo = null } = {}) {
  return { part, side, qty, part_no: partNo, quote };
}

function card(fields) {
  return {
    call_type: '주문', customer: null, contact: null, car_model: null, model_year: null, plate: null,
    items: [], urgent: false, due: null, delivery: null, ask_back: [], unsure: [], fixes: [], note: null,
    highlights: [], summary: '',
    ...fields,
    evidence: {
      customer: '', contact: '', car_model: '', model_year: '', plate: '', urgent: '', due: '', delivery: '',
      ...fields.evidence,
    },
  };
}

const squash = (text) => text.normalize('NFC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
const livePrefixes = LIVE_SAMPLE.map((_, i) => squash(LIVE_SAMPLE.slice(0, i + 1).map((line) => line.text).join(' ')));
const workerText = squash(OFFLINE_WORKER_LINES.join(' '));
const exampleTexts = LIVE_EXAMPLES.map(squash);

function liveCard(n) {
  const qty = n >= 5 ? 3 : n >= 3 ? 2 : null;
  const qtyQuote = n >= 5 ? '세 개로 해 주세요' : n >= 3 ? '두 개요' : '';
  const urgent = n >= 7;
  return card({
    call_type: qty ? '주문' : '재고·단가 문의',
    customer: '새한카센터', car_model: '아반떼 CN7', model_year: n >= 3 ? '2022' : null,
    plate: n >= 5 ? '12가3456' : null,
    items: qty ? [item('앞범퍼', qty, n >= 8 ? '앞범퍼 세 개' : qtyQuote)] : [],
    urgent, due: urgent ? '오늘 오후 3시까지' : null, delivery: n >= 8 ? '배송' : null,
    summary: qty ? `아반떼 CN7 앞범퍼 ${qty}개` : '아반떼 CN7 앞범퍼 재고 문의',
    evidence: {
      customer: '새한카센터인데요', car_model: '아반떼 CN7',
      model_year: n >= 3 ? '22년식' : '', plate: n >= 5 ? '12가 3456' : '',
      urgent: urgent ? '리프트에 올라가 있어서 급해요' : '', due: urgent ? '오늘 오후 세 시까지' : '',
      delivery: n >= 8 ? '배송해 드릴게요' : '',
    },
    highlights: [
      { text: '새한카센터', kind: 'customer' },
      { text: '아반떼 CN7', kind: 'car' },
      { text: '앞범퍼', kind: 'part' },
      ...(qtyQuote ? [{ text: qtyQuote, kind: 'qty' }] : []),
      ...(urgent ? [{ text: '오늘 오후 세 시까지', kind: 'urgent' }] : []),
    ],
  });
}

function extractFixture(transcript) {
  const text = squash(transcript);
  const n = livePrefixes.indexOf(text) + 1;
  if (n) return liveCard(n);
  if (text === workerText) {
    return card({
      customer: '가짜별정비소', car_model: '아반떼 CN7', model_year: '2022',
      items: [item('앞범퍼', 2, '앞범퍼 두 개 주세요', { partNo: '86511-A0000' })],
      due: '오늘 오후까지', delivery: '배송', summary: '가짜별정비소 앞범퍼 2개',
      evidence: {
        customer: '가짜별정비소입니다', car_model: '아반떼 CN7', model_year: '22년식',
        due: '오늘 오후까지', delivery: '배송해 주세요',
      },
      highlights: [{ text: '앞범퍼', kind: 'part' }, { text: '두 개 주세요', kind: 'qty' }],
    });
  }
  if (text === exampleTexts[0]) {
    return card({
      car_model: '아반떼', items: [item('앞범퍼', 2, '앞범퍼 두 개')], urgent: true,
      evidence: { car_model: '아반떼', urgent: '급해요' }, summary: '아반떼 앞범퍼 2개',
    });
  }
  if (text === exampleTexts[1]) {
    return card({
      car_model: '쏘렌토 MQ4', items: [item('뒷쇼바', 2, '뒷쇼바 좌우로 하나씩', { side: '좌우' })],
      due: '내일 오전까지', evidence: { car_model: '쏘렌토 엠큐포', due: '내일 오전까지' },
      summary: '쏘렌토 MQ4 뒷쇼바 좌우 1개씩',
    });
  }
  return null;
}

function briefingFixture(cards) {
  const open = cards.filter((c) => c?.callId && !['출고 완료', '취소'].includes(c.status));
  const urgent = open.filter((c) => c.urgent);
  const pending = open.filter((c) => c.callback || c.askBack?.length);
  const queue = [...new Set([...urgent, ...pending, ...open])];
  return {
    paragraph: queue.length ? '저장된 카드에서 급한 주문과 다시 물어볼 내용을 먼저 확인해 주세요.' : '현재 검토할 열린 카드가 없습니다.',
    todos: queue.slice(0, 5).map((c) => ({
      title: `${c.customer || '거래처'} ${pending.includes(c) ? '다시 연락' : '카드 확인'}`,
      why: c.askBack?.[0] || (c.urgent ? '급한 통화로 표시됐습니다.' : '저장된 카드의 처리 상태를 확인해 주세요.'),
      callId: c.callId,
    })),
  };
}

function answerFixture({ question, contexts }) {
  const terms = question.match(/[\p{L}\p{N}]+/gu) || [];
  const compactTerms = terms
    .map((word) => squash(word.replace(/(에서|에게|한테|이랑|으로|이|가|을|를|은|는|의|에)$/u, '')))
    .filter((word) => word.length >= 2);
  const source = contexts
    .map((c) => ({ c, score: compactTerms.filter((term) => squash(c.text).includes(term)).length }))
    .sort((a, b) => b.score - a.score)
    .find((entry) => entry.score > 0)?.c;
  if (!source) return { answer: '찾지 못했어요. 질문과 일치하는 문장이 없습니다.', found: false, citations: [] };
  return {
    answer: `저장된 기록에서 이 내용을 찾았습니다. 「${source.text.slice(0, 100)}」`,
    found: true,
    citations: [{ ref: source.ref, quote: source.text.slice(0, 40) }],
  };
}

export function fixtureJson(operation, input) {
  switch (operation) {
    case 'extract': return extractFixture(input);
    case 'briefing': return briefingFixture(input);
    case 'answer': return answerFixture(input);
    default: throw new RangeError('알 수 없는 테스트 기능');
  }
}
